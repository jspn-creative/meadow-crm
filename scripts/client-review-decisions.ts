import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { remoteD1Database } from "./remote-d1.ts";

// Preparation writes reviewed artifacts only; Alchemy remains the only migration writer.
const migration = "20261115010000_apply_client_review_decisions";
const sourceDirectory = "docs/misc/client-sources/";
const manifestPath = sourceDirectory + "client-review-decisions.json";
const sqlPath = `migrations/${migration}/migration.sql`;
const approvedHash = "7251d677c12a09421426cac6a0c4c8e7f3aaa7227dd4df70429073c67fa96ab2";
const databaseId = "f3dcaa0f-97ad-4403-b32d-a2164027c64d";
const testClient = "import-client-303";
const testOpportunity = "a2b8f3ee-f291-42d9-95e0-05b56f305a3f";
const decisions: Record<string, [string, number]> = {
	"notes-recent": ["Active", 30],
	"notes-older": ["Delete", 72],
	"recent-engagement": ["Active", 36],
	"older-engagement": ["Active", 91],
	"recent-unengaged": ["Archive", 197],
	"older-unengaged": ["Delete", 192],
	"opted-out": ["Delete", 96],
};
type Row = Record<string, any>;
type State = Record<string, Row[]>;
type Target = { id: string; group: string; decision: string };
type Manifest = {
	sourceHash: string;
	groupHash: string;
	protectedIds: string[];
	targets: Target[];
	exception: {
		clientId: string;
		decision: string;
		opportunityId: string;
		opportunityDecision: string;
	};
};
class ReviewFailure extends Error {}
function requireCondition(value: unknown, message: string): asserts value {
	if (!value) throw new ReviewFailure(message);
}
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const text = (value: string) => `'${value.replaceAll("'", "''")}'`;
const quoted = (value: string) => `"${value.replaceAll('"', '""')}"`;
function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value !== null && typeof value === "object")
		return `{${Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
			.join(",")}}`;
	return JSON.stringify(value) ?? "null";
}
function csv(input: string): Record<string, string>[] {
	const rows: string[][] = [];
	let row: string[] = [],
		field = "",
		quoted = false;
	for (let i = input.charCodeAt(0) === 0xfeff ? 1 : 0; i < input.length; i++) {
		const char = input[i];
		if (quoted) {
			if (char === '"' && input[i + 1] === '"') {
				field += '"';
				i++;
			} else if (char === '"') quoted = false;
			else field += char;
		} else if (char === '"' && field === "") quoted = true;
		else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && input[i + 1] === "\n") i++;
			row.push(field);
			field = "";
			if (row.some(Boolean)) rows.push(row);
			row = [];
		} else field += char;
	}
	requireCondition(!quoted, "Unterminated CSV field.");
	if (field || row.length) {
		row.push(field);
		rows.push(row);
	}
	const headers = rows.shift()!;
	requireCondition(
		headers?.length && new Set(headers).size === headers.length,
		"Invalid CSV headers.",
	);
	return rows.map((cells) => {
		requireCondition(cells.length === headers.length, "Invalid CSV row.");
		return Object.fromEntries(headers.map((header, i) => [header, cells[i]]));
	});
}
async function snapshot() {
	const db = remoteD1Database({ readOnly: true });
	requireCondition(
		process.env.MEADOW_D1_DATABASE_ID === databaseId,
		"Refusing a database other than Meadow production.",
	);
	const metadata = await db
		.prepare(
			"SELECT m.name, (SELECT json_group_array(name) FROM pragma_table_info(m.name)) AS columns FROM sqlite_schema m WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE 'auth_%' AND substr(m.name, 1, 1) <> '_' ORDER BY m.name",
		)
		.all<{ name: string; columns: string }>();
	const result = await db
		.prepare(
			`SELECT json_object(${metadata.results.flatMap((row) => [text(row.name), `(SELECT json_group_array(json_object(${(JSON.parse(row.columns) as string[]).flatMap((column) => [text(column), quoted(column)]).join(",")})) FROM ${quoted(row.name)})`]).join(",")}) AS snapshot`,
		)
		.first<{ snapshot: string }>();
	requireCondition(result, "Could not read the application snapshot.");
	return { db, state: JSON.parse(result.snapshot) as State };
}
function migrationSql(manifest: Manifest) {
	const payload = JSON.stringify(
		manifest.targets.map((target) => [
			Number(target.id.slice("import-client-".length)),
			target.group,
			target.decision,
		]),
	);
	const cohort = `WITH targets AS (SELECT 'import-client-' || json_extract(value, '$[0]') AS id, json_extract(value, '$[1]') AS review_group, json_extract(value, '$[2]') AS decision FROM json_each(${text(payload)}))`;
	const history = `SELECT record_id FROM history WHERE json_extract(data, '$.migration') = '${migration}' AND record_kind = 'client'`;
	const deleting = `${history} AND json_extract(data, '$.decision') = 'Delete'`;
	const guard = (name: string, condition: string) =>
		`INSERT INTO mutation_guards (id, passed) SELECT '${migration}:${name}', CASE WHEN ${condition} THEN 1 ELSE 0 END;`;
	const changed =
		"((t.decision = 'Active' AND c.archived_at IS NOT NULL) OR (t.decision = 'Archive' AND c.archived_at IS NULL))";
	const now = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
	return (
		[
			`-- Approved review CSV SHA-256: ${manifest.sourceHash}`,
			`-- Frozen group membership SHA-256: ${manifest.groupHash}`,
			"-- Exception: archive the test client, delete its test opportunity. Preserve all 143 previously approved clients and flags.",
			`${cohort}\n${guard("targets", `NOT EXISTS (SELECT 1 FROM clients WHERE id GLOB 'import-client-*') OR (SELECT count(*) FROM clients c JOIN targets t ON t.id = c.id) = 684`)}`,
			`${cohort}\nINSERT INTO history (id, record_kind, record_id, action, actor_user_id, effective_user_id, data, fictional, created_at)
SELECT 'migration:${migration}:' || c.id, 'client', c.id, CASE WHEN t.decision = 'Delete' THEN 'delete' WHEN ${changed} THEN CASE WHEN t.decision = 'Active' THEN 'restore' ELSE 'archive' END ELSE 'review' END, 'support-admin', 'support-admin',
json_object('migration', '${migration}', 'sourceHash', '${manifest.sourceHash}', 'groupHash', '${manifest.groupHash}', 'group', t.review_group, 'decision', t.decision,
 'before', json_object('archivedAt', c.archived_at, 'revision', c.revision, 'updatedAt', c.updated_at),
 'after', CASE WHEN t.decision = 'Delete' THEN NULL ELSE json_object('archivedAt', CASE WHEN t.decision = 'Active' THEN NULL ELSE coalesce(c.archived_at, ${now}) END, 'revision', c.revision + CASE WHEN ${changed} THEN 1 ELSE 0 END, 'updatedAt', CASE WHEN ${changed} THEN ${now} ELSE c.updated_at END) END), c.fictional, ${now}
FROM clients c JOIN targets t ON t.id = c.id;`,
			guard(
				"history",
				`(SELECT count(*) FROM history WHERE json_extract(data, '$.migration') = '${migration}' AND record_kind = 'client') IN (0, 684)`,
			),
			guard(
				"delete-links",
				`NOT EXISTS (SELECT 1 FROM opportunity_clients WHERE client_id IN (${deleting})) AND NOT EXISTS (SELECT 1 FROM tasks WHERE client_id IN (${deleting})) AND NOT EXISTS (SELECT 1 FROM clients WHERE referred_by_client_id IN (${deleting}) AND id NOT IN (${deleting})) AND NOT EXISTS (SELECT 1 FROM client_relationships WHERE (client_id IN (${deleting}) AND related_client_id NOT IN (${deleting})) OR (related_client_id IN (${deleting}) AND client_id NOT IN (${deleting}))) AND NOT EXISTS (SELECT 1 FROM record_references WHERE target_client_id IN (${deleting}) AND (client_id IS NULL OR client_id NOT IN (${deleting})))`,
			),
			guard(
				"test-links",
				`NOT EXISTS (SELECT 1 FROM clients WHERE id GLOB 'import-client-*') OR ((SELECT count(*) FROM opportunities WHERE id = '${testOpportunity}' AND revision = 5 AND archived_at IS NULL AND stage = 'new-lead') = 1 AND (SELECT count(*) FROM opportunity_clients WHERE opportunity_id = '${testOpportunity}') = 1 AND EXISTS (SELECT 1 FROM opportunity_clients WHERE opportunity_id = '${testOpportunity}' AND client_id = '${testClient}') AND NOT EXISTS (SELECT 1 FROM tasks WHERE opportunity_id = '${testOpportunity}') AND NOT EXISTS (SELECT 1 FROM checklist_items WHERE checklist_id IN (SELECT id FROM stage_checklists WHERE opportunity_id = '${testOpportunity}')) AND NOT EXISTS (SELECT 1 FROM checklist_progress WHERE checklist_id IN (SELECT id FROM stage_checklists WHERE opportunity_id = '${testOpportunity}')) AND NOT EXISTS (SELECT 1 FROM record_references WHERE target_opportunity_id = '${testOpportunity}' AND (opportunity_id IS NULL OR opportunity_id <> '${testOpportunity}')))`,
			),
			`INSERT INTO history (id, record_kind, record_id, action, actor_user_id, effective_user_id, data, fictional, created_at)
SELECT 'migration:${migration}:' || id, 'opportunity', id, 'delete', 'support-admin', 'support-admin', json_object('migration', '${migration}', 'sourceHash', '${manifest.sourceHash}', 'reason', 'Developer confirmed this was a test; archive its client and delete the opportunity.', 'before', json_object('revision', revision, 'updatedAt', updated_at, 'archivedAt', archived_at)), fictional, ${now} FROM opportunities WHERE id = '${testOpportunity}' AND EXISTS (SELECT 1 FROM history WHERE id = 'migration:${migration}:${testClient}');`,
			`UPDATE clients AS c SET archived_at = json_extract(h.data, '$.after.archivedAt'), revision = json_extract(h.data, '$.after.revision'), updated_at = json_extract(h.data, '$.after.updatedAt') FROM history h WHERE h.id = 'migration:${migration}:' || c.id AND json_extract(h.data, '$.decision') <> 'Delete' AND c.revision = json_extract(h.data, '$.before.revision') AND json_extract(h.data, '$.after.revision') > c.revision;`,
			`DELETE FROM record_references WHERE opportunity_id = '${testOpportunity}' AND EXISTS (SELECT 1 FROM history WHERE id = 'migration:${migration}:${testOpportunity}');`,
			`DELETE FROM opportunity_clients WHERE opportunity_id = '${testOpportunity}' AND EXISTS (SELECT 1 FROM history WHERE id = 'migration:${migration}:${testOpportunity}');`,
			`DELETE FROM stage_checklists WHERE opportunity_id = '${testOpportunity}' AND EXISTS (SELECT 1 FROM history WHERE id = 'migration:${migration}:${testOpportunity}');`,
			`DELETE FROM opportunities WHERE id = '${testOpportunity}' AND EXISTS (SELECT 1 FROM history WHERE id = 'migration:${migration}:${testOpportunity}' AND json_extract(data, '$.before.revision') = opportunities.revision);`,
			`DELETE FROM record_references WHERE client_id IN (${deleting});`,
			`DELETE FROM client_relationships WHERE client_id IN (${deleting}) AND related_client_id IN (${deleting});`,
			`DELETE FROM person_phones WHERE person_id IN (SELECT id FROM client_people WHERE client_id IN (${deleting}));`,
			`DELETE FROM person_emails WHERE person_id IN (SELECT id FROM client_people WHERE client_id IN (${deleting}));`,
			`DELETE FROM client_people WHERE client_id IN (${deleting});`,
			`DELETE FROM client_addresses WHERE client_id IN (${deleting});`,
			`DELETE FROM client_key_dates WHERE client_id IN (${deleting});`,
			`DELETE FROM client_tags WHERE client_id IN (${deleting});`,
			`DELETE FROM clients WHERE id IN (${deleting});`,
			guard(
				"deleted",
				`changes() = (SELECT count(*) FROM history WHERE json_extract(data, '$.migration') = '${migration}' AND record_kind = 'client' AND json_extract(data, '$.decision') = 'Delete')`,
			),
			guard(
				"states",
				`NOT EXISTS (SELECT 1 FROM history h LEFT JOIN clients c ON c.id = h.record_id WHERE json_extract(h.data, '$.migration') = '${migration}' AND h.record_kind = 'client' AND ((json_extract(h.data, '$.decision') = 'Delete' AND c.id IS NOT NULL) OR (json_extract(h.data, '$.decision') <> 'Delete' AND (c.id IS NULL OR c.archived_at IS NOT json_extract(h.data, '$.after.archivedAt') OR c.revision <> json_extract(h.data, '$.after.revision') OR c.updated_at <> json_extract(h.data, '$.after.updatedAt'))))) AND NOT EXISTS (SELECT 1 FROM opportunities WHERE id = '${testOpportunity}')`,
			),
			`DELETE FROM mutation_guards WHERE id LIKE '${migration}:%';`,
		].join("\n\n") + "\n"
	);
}
async function main() {
	const [mode, input, backupFile, ...extra] = process.argv
		.slice(2)
		.filter((arg: string) => arg !== "--");
	requireCondition(
		(mode === "prepare" && input && backupFile && !extra.length) ||
			(mode === "verify" && input && !backupFile),
		"Use prepare <approved-csv> <private-backup> or verify <private-backup>.",
	);
	const path = mode === "prepare" ? backupFile : input;
	requireCondition(((await stat(path)).mode & 0o077) === 0, "Backup permissions must be private.");
	const backup = JSON.parse(await readFile(path, "utf8")) as {
		databaseId: string;
		decisionHash: string;
		groupHash: string;
		state: State;
	};
	requireCondition(
		backup.databaseId === databaseId && backup.decisionHash === approvedHash,
		"Backup does not match the approved review.",
	);
	const groupSource = await readFile(sourceDirectory + "client-review-groups.csv");
	requireCondition(sha(groupSource) === backup.groupHash, "Frozen group membership changed.");
	const groups = csv(groupSource.toString("utf8"));
	const confirmed = csv(
		await readFile(sourceDirectory + "confirmed-client-records.csv", "utf8"),
	).map((row) => row.client_id);
	requireCondition(
		groups.length === 714 &&
			confirmed.length === 113 &&
			new Set([...groups.map((row) => row.client_id), ...confirmed]).size === 827,
		"Cohorts must be disjoint and cover 827 clients.",
	);
	for (const [group, [, count]] of Object.entries(decisions))
		requireCondition(
			groups.filter((row) => row.group === group).length === count,
			"Review group counts changed.",
		);
	const manifest: Manifest = {
		sourceHash: approvedHash,
		groupHash: backup.groupHash,
		protectedIds: [
			...confirmed,
			...groups.filter((row) => row.group === "notes-recent").map((row) => row.client_id),
		].sort(),
		targets: groups
			.filter((row) => row.group !== "notes-recent")
			.map((row) => ({
				id: row.client_id,
				group: row.group,
				decision: row.client_id === testClient ? "Archive" : decisions[row.group][0],
			}))
			.sort((a, b) => a.id.localeCompare(b.id)),
		exception: {
			clientId: testClient,
			decision: "Archive",
			opportunityId: testOpportunity,
			opportunityDecision: "Delete",
		},
	};
	requireCondition(
		manifest.targets.every((target) => /^import-client-\d+$/.test(target.id)) &&
			manifest.targets.filter((target) => target.decision === "Active").length === 127 &&
			manifest.targets.filter((target) => target.decision === "Archive").length === 198 &&
			manifest.targets.filter((target) => target.decision === "Delete").length === 359,
		"Approved final decisions changed.",
	);
	if (mode === "prepare") {
		const source = await readFile(input);
		requireCondition(sha(source) === approvedHash, "The approved decision CSV changed.");
		const answers = csv(source.toString("utf8"));
		for (const [group, [answer, count]] of Object.entries(decisions)) {
			const rows = answers.filter((row) => row["Group ID"] === group);
			requireCondition(
				rows.length === (group === "notes-recent" ? 30 : 1) &&
					rows.every((row) => row.Answer === answer) &&
					rows.reduce((sum, row) => sum + Number(row.Clients), 0) === count,
				"CSV answers do not match the approved decisions.",
			);
		}
		const current = (await snapshot()).state;
		requireCondition(
			canonical(current) === canonical(backup.state),
			"Production changed since the backup; review before preparing the migration.",
		);
		await writeFile(manifestPath, JSON.stringify(manifest, null, "\t") + "\n", { flag: "wx" });
		await writeFile(sqlPath, migrationSql(manifest), { flag: "wx" });
		console.log(
			JSON.stringify({
				prepared: migration,
				active: 270,
				archive: 198,
				delete: 359,
				deletedTestOpportunities: 1,
			}),
		);
		return;
	}
	requireCondition(
		canonical(JSON.parse(await readFile(manifestPath, "utf8"))) === canonical(manifest) &&
			(await readFile(sqlPath, "utf8")) === migrationSql(manifest),
		"Reviewed manifest or SQL changed.",
	);
	const { db, state } = await snapshot();
	const ledger = await db
		.prepare("SELECT name, hash FROM __alchemy_migrations")
		.all<{ name: string; hash: string }>();
	requireCondition(
		ledger.results.some(
			(row) =>
				[migration, `${migration}/migration.sql`].includes(row.name) &&
				row.hash === sha(migrationSql(manifest)),
		),
		"The reviewed migration is not recorded with its exact hash.",
	);
	const expected: State = structuredClone(backup.state);
	const targets = new Map(manifest.targets.map((target) => [target.id, target]));
	const deleting = new Set(
		manifest.targets.filter((target) => target.decision === "Delete").map((target) => target.id),
	);
	const people = new Set(
		expected.client_people.filter((row) => deleting.has(row.client_id)).map((row) => row.id),
	);
	const entries = state.history.filter((row) => JSON.parse(row.data).migration === migration);
	requireCondition(
		entries.length === 685 && new Set(entries.map((row) => row.id)).size === 685,
		"Expected 684 client decisions and one test-opportunity deletion in History.",
	);
	for (const entry of entries) {
		const data = JSON.parse(entry.data);
		requireCondition(
			entry.id === `migration:${migration}:${entry.record_id}` &&
				entry.actor_user_id === "support-admin" &&
				entry.effective_user_id === "support-admin" &&
				data.sourceHash === approvedHash,
			"Migration History attribution does not match.",
		);
		if (entry.record_kind === "client") {
			const target = targets.get(entry.record_id);
			const client = expected.clients.find((row) => row.id === entry.record_id);
			requireCondition(
				target &&
					client &&
					data.decision === target.decision &&
					data.group === target.group &&
					data.groupHash === manifest.groupHash,
				"Unexpected client decision.",
			);
			requireCondition(
				data.before.archivedAt === client.archived_at &&
					data.before.revision === client.revision &&
					data.before.updatedAt === client.updated_at,
				"A client changed between backup and migration.",
			);
			if (target.decision !== "Delete") {
				const changed =
					target.decision === "Active" ? client.archived_at !== null : client.archived_at === null;
				requireCondition(
					data.after.revision === client.revision + Number(changed) &&
						data.after.archivedAt ===
							(target.decision === "Active" ? null : (client.archived_at ?? entry.created_at)) &&
						data.after.updatedAt === (changed ? entry.created_at : client.updated_at) &&
						entry.action ===
							(changed ? (target.decision === "Active" ? "restore" : "archive") : "review"),
					"Unexpected client after-state.",
				);
				client.archived_at = data.after.archivedAt;
				client.revision = data.after.revision;
				client.updated_at = data.after.updatedAt;
			} else
				requireCondition(
					entry.action === "delete" && data.after === null,
					"Missing client deletion evidence.",
				);
		} else
			requireCondition(
				entry.record_kind === "opportunity" &&
					entry.record_id === testOpportunity &&
					entry.action === "delete",
				"Unexpected opportunity mutation.",
			);
	}
	expected.clients = expected.clients.filter((row) => !deleting.has(row.id));
	for (const table of ["person_phones", "person_emails"])
		expected[table] = expected[table].filter((row) => !people.has(row.person_id));
	for (const table of ["client_people", "client_addresses", "client_key_dates", "client_tags"])
		expected[table] = expected[table].filter((row) => !deleting.has(row.client_id));
	expected.client_relationships = expected.client_relationships.filter(
		(row) => !deleting.has(row.client_id) && !deleting.has(row.related_client_id),
	);
	expected.record_references = expected.record_references.filter(
		(row) => !deleting.has(row.client_id) && row.opportunity_id !== testOpportunity,
	);
	expected.opportunity_clients = expected.opportunity_clients.filter(
		(row) => row.opportunity_id !== testOpportunity,
	);
	expected.stage_checklists = expected.stage_checklists.filter(
		(row) => row.opportunity_id !== testOpportunity,
	);
	expected.opportunities = expected.opportunities.filter((row) => row.id !== testOpportunity);
	expected.history.push(...entries);
	const order = (rows: Row[]) => rows.map(canonical).sort();
	const differences = Object.keys(expected).filter(
		(table) => canonical(order(expected[table])) !== canonical(order(state[table] ?? [])),
	);
	console.log(
		JSON.stringify({
			total: state.clients.length,
			active: state.clients.filter((row) => row.archived_at === null).length,
			archived: state.clients.filter((row) => row.archived_at !== null).length,
			deleted: deleting.size,
			flagged: state.clients.filter((row) => row.flagged === 1).length,
			testOpportunityDeleted: !state.opportunities.some((row) => row.id === testOpportunity),
			historyEntries: entries.length,
			preservationDifferences: differences.length,
		}),
	);
	requireCondition(
		differences.length === 0,
		"Preservation verification found differences; inspect the private backup without replaying the migration.",
	);
}
try {
	await main();
} catch (cause) {
	console.error(
		cause instanceof ReviewFailure
			? cause.message
			: "Client review preparation or verification failed. No production data was written by this helper.",
	);
	process.exitCode = 1;
}
