import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { remoteD1Database } from "./remote-d1.ts";

const databaseId = "f3dcaa0f-97ad-4403-b32d-a2164027c64d";
const sources = "docs/misc/client-sources/";
const operations = [
	{
		name: "20261115003000_activate_review_clients",
		source: "client-review-active.json",
		hash: "f840cf5231bda5ee788a4dc1a4c61d7e04ec76fd3899341b46ba211e659f8b6f",
	},
	{
		name: "20261115003100_restore_confirmed_clients",
		source: "confirmed-client-records.csv",
		hash: "f9a6b85b37bbd057f774dba5ba2e7e2f7842811d6764cd3d7c0748f9969edef3",
	},
] as const;
const tables = [
	"clients",
	"client_people",
	"person_phones",
	"person_emails",
	"client_addresses",
	"client_relationships",
	"client_key_dates",
	"client_tags",
	"tags",
	"opportunities",
	"opportunity_clients",
	"checklist_templates",
	"stage_checklists",
	"checklist_items",
	"checklist_progress",
	"tasks",
	"record_references",
	"business_settings",
	"history",
];
type Row = Record<string, unknown>;
type State = Record<string, Row[]>;
type Before = {
	archivedAt: unknown;
	revision: number;
	updatedAt: unknown;
	flagged: boolean;
	flagNote: string;
};
type Backup = {
	version: 1;
	databaseId: string;
	capturedAt: string;
	bindings: { name: string; sourceHash: string; sqlHash: string }[];
	flagColumnsAvailable: boolean;
	clients: Record<string, Before>;
	rows: Record<string, Record<string, string>>;
};
const sha = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
class ReviewFailure extends Error {}
function requireCondition(value: unknown, message: string): asserts value {
	if (!value) throw new ReviewFailure(message);
}
function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value !== null && typeof value === "object")
		return `{${Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
			.join(",")}}`;
	return JSON.stringify(value) ?? "null";
}
const quoted = (id: string) => `"${id.replaceAll('"', '""')}"`;
const sqlText = (value: string) => `'${value.replaceAll("'", "''")}'`;
function before(row: Row): Before {
	const flagNote = row.flag_note;
	requireCondition(
		flagNote === undefined || typeof flagNote === "string",
		"A client flag note has an invalid stored type.",
	);
	return {
		archivedAt: row.archived_at,
		revision: Number(row.revision),
		updatedAt: row.updated_at,
		flagged: row.flagged === 1,
		flagNote: flagNote ?? "",
	};
}

async function main() {
	const [mode, backupFile, ...extra] = process.argv.slice(2).filter((arg: string) => arg !== "--");
	requireCondition(
		(mode === "backup" && !backupFile) || (mode === "verify" && backupFile && !extra.length),
		"Use backup or verify <backup-file>.",
	);
	const bindings = await Promise.all(
		operations.map(async (operation) => {
			const source = await readFile(sources + operation.source);
			requireCondition(
				sha(source) === operation.hash,
				"A frozen source changed. Review the plan and migrations before proceeding.",
			);
			return {
				name: operation.name,
				sourceHash: operation.hash,
				sqlHash: sha(await readFile(`migrations/${operation.name}/migration.sql`)),
			};
		}),
	);
	const manifest = JSON.parse(await readFile(sources + operations[0].source, "utf8")) as {
		expected_clients: number;
		clients: {
			client_id: string;
			case_id: string;
			decision: string;
			flagged: boolean;
			flag_note: string;
		}[];
	};
	const confirmedText = await readFile(sources + operations[1].source, "utf8");
	const [header, ...confirmed] = confirmedText.trim().split(/\r?\n/);
	const flagIds = manifest.clients.map((client) => client.client_id);
	const allIds = [...flagIds, ...confirmed];
	requireCondition(
		header === "client_id" &&
			manifest.expected_clients === 30 &&
			flagIds.length === 30 &&
			confirmed.length === 113 &&
			new Set(allIds).size === 143 &&
			allIds.every((id) => /^import-client-\d+$/.test(id)),
		"The exact 30/113 cohort boundaries changed.",
	);
	requireCondition(
		manifest.clients.every(
			(client) =>
				client.decision === "active" &&
				client.flagged === true &&
				client.flag_note.trim() === client.flag_note &&
				client.flag_note.length > 0 &&
				client.flag_note.length <= 2000,
		),
		"Invalid flagging decisions or notes.",
	);
	const cases = JSON.parse(await readFile(sources + "client-review-cases.json", "utf8")) as {
		cases: { id: string; client_ids: string[]; review_note: string }[];
	};
	requireCondition(
		cases.cases.length === 27 &&
			manifest.clients.every((client) =>
				cases.cases.some(
					(item) =>
						item.id === client.case_id &&
						item.client_ids.includes(client.client_id) &&
						item.review_note === client.flag_note,
				),
			),
		"Manifest notes do not match the curated cases.",
	);
	const flagSet = new Set(flagIds);
	const confirmedSet = new Set(confirmed);
	const db = remoteD1Database({ readOnly: true });
	requireCondition(
		process.env.MEADOW_D1_DATABASE_ID === databaseId,
		"Refusing a database other than Meadow production.",
	);
	// Metadata is read with SELECT, before asking for columns that may not exist yet.
	const metadata = await db
		.prepare(
			`SELECT m.name, (SELECT json_group_array(name) FROM pragma_table_info(m.name)) AS columns FROM sqlite_schema m WHERE m.type = 'table' AND m.name IN (${tables.map(sqlText).join(",")})`,
		)
		.all<{ name: string; columns: string }>();
	requireCondition(
		metadata.results.length === tables.length,
		"Required application tables are missing.",
	);
	const columns = new Map(
		metadata.results.map((row) => [row.name, JSON.parse(row.columns) as string[]]),
	);
	const flagColumnsAvailable =
		columns.get("clients")!.includes("flagged") && columns.get("clients")!.includes("flag_note");
	// One SELECT gives all preservation inputs one database snapshot, rather than racing separate table reads.
	const snapshotSql = `SELECT json_object(${tables
		.map(
			(table) =>
				`${sqlText(table)}, (SELECT json_group_array(json_object(${columns
					.get(table)!
					.flatMap((column) => [sqlText(column), quoted(column)])
					.join(",")})) FROM ${quoted(table)})`,
		)
		.join(",")}) AS snapshot`;
	const snapshot = await db.prepare(snapshotSql).first<{ snapshot: string }>();
	requireCondition(snapshot, "Could not capture the application snapshot.");
	const state = JSON.parse(snapshot.snapshot) as State;
	const clients = new Map(state.clients.map((row) => [String(row.id), row]));
	requireCondition(
		allIds.every((id) => clients.has(id)),
		"Production is missing approved targets. No application was attempted.",
	);
	const ledger = await db
		.prepare("SELECT name, hash FROM __alchemy_migrations")
		.all<{ name: string; hash: string }>();
	const applied = (name: string) =>
		ledger.results.some((row) =>
			[name, `${name}/migration.sql`, `migrations/${name}/migration.sql`].includes(row.name),
		);
	function rowHashes(): Backup["rows"] {
		return Object.fromEntries(
			tables.map((table) => [
				table,
				Object.fromEntries(
					state[table].map((original) => {
						const row = { ...original };
						if (table === "clients") {
							row.flagged ??= 0;
							row.flag_note ??= "";
							if (flagSet.has(String(row.id)) || confirmedSet.has(String(row.id))) {
								delete row.archived_at;
								delete row.revision;
								delete row.updated_at;
							}
							if (flagSet.has(String(row.id))) {
								delete row.flagged;
								delete row.flag_note;
							}
						}
						const key = canonical(
							original.id ??
								Object.fromEntries(Object.entries(original).filter(([field]) => field.endsWith("_id"))),
						);
						return [key, sha(canonical(row))];
					}),
				),
			]),
		);
	}
	const hashes = rowHashes();
	if (mode === "backup") {
		requireCondition(
			operations.every((operation) => !applied(operation.name)),
			"A cohort migration already applied. Use its original backup for verification; do not overwrite the baseline.",
		);
		const backup: Backup = {
			version: 1,
			databaseId,
			capturedAt: new Date().toISOString(),
			bindings,
			flagColumnsAvailable,
			clients: Object.fromEntries(allIds.map((id) => [id, before(clients.get(id)!)])),
			rows: hashes,
		};
		const directory = await mkdtemp(join(tmpdir(), "meadow-client-flags-"));
		await chmod(directory, 0o700);
		const path = join(directory, "backup.json");
		await writeFile(path, JSON.stringify(backup), { mode: 0o600, flag: "wx" });
		console.log(
			JSON.stringify({
				backup: path,
				flaggedTargets: 30,
				restorationTargets: 113,
				currentlyArchivedAmong113: confirmed.filter((id) => clients.get(id)!.archived_at !== null)
					.length,
			}),
		);
		return;
	}
	const path = resolve(backupFile!);
	requireCondition(
		((await stat(path)).mode & 0o077) === 0,
		"Backup permissions must be private (0600).",
	);
	const backup = JSON.parse(await readFile(path, "utf8")) as Backup;
	requireCondition(
		backup.version === 1 &&
			backup.databaseId === databaseId &&
			canonical(backup.bindings) === canonical(bindings) &&
			canonical(Object.keys(backup.clients).sort()) === canonical([...allIds].sort()),
		"Backup does not match this database, sources, migrations, or cohort.",
	);
	requireCondition(
		flagColumnsAvailable && operations.every((operation) => applied(operation.name)),
		"Schema or a cohort migration is still pending. Do not replay the completed operation manually.",
	);
	requireCondition(
		bindings.every((binding) =>
			ledger.results.some(
				(row) =>
					[binding.name, `${binding.name}/migration.sql`].includes(row.name) &&
					row.hash === binding.sqlHash,
			),
		),
		"Applied migration hashes do not match the reviewed SQL.",
	);
	const migrationHistory = state.history.filter((row) => String(row.id).startsWith("migration:"));
	const dataOf = (row: Row) =>
		JSON.parse(String(row.data)) as {
			migration?: string;
			sourceHash?: string;
			before: Before;
			after: Before;
		};
	let errors = 0;
	let appliedFlags = 0;
	let unchanged = 0;
	let laterEdited = 0;
	let restored = 0;
	let alreadyActive = 0;
	let needsReview = 0;
	const expectedHistory = new Set<string>();
	for (const operation of operations) {
		const isFlagging = operation === operations[0];
		const ids = isFlagging ? flagIds : confirmed;
		const rows = migrationHistory.filter((row) => dataOf(row).migration === operation.name);
		if (rows.some((row) => !ids.includes(String(row.record_id)))) errors++;
		for (const id of ids) {
			const client = clients.get(id)!;
			const current = before(client);
			const entries = rows.filter((row) => row.record_id === id);
			if (!entries.length && !isFlagging) {
				alreadyActive++;
				const baseline = backup.clients[id];
				if (current.revision === baseline.revision) {
					if (
						baseline.archivedAt !== null ||
						current.archivedAt !== null ||
						canonical(current) !== canonical(baseline)
					)
						errors++;
				} else {
					const history = state.history.filter(
						(row) =>
							row.record_kind === "client" &&
							row.record_id === id &&
							!backup.rows.history[canonical(row.id)],
					);
					if (current.revision < baseline.revision || !history.length) errors++;
					else needsReview++;
				}
				continue;
			}
			if (entries.length !== 1) {
				errors++;
				continue;
			}
			const entry = entries[0];
			expectedHistory.add(String(entry.id));
			const data = dataOf(entry);
			if (
				entry.id !== `migration:${operation.name}:${id}` ||
				entry.record_kind !== "client" ||
				entry.actor_user_id !== "support-admin" ||
				entry.effective_user_id !== "support-admin" ||
				data.sourceHash !== operation.hash ||
				data.after.revision !== data.before.revision + 1 ||
				data.after.archivedAt !== null ||
				data.after.updatedAt !== entry.created_at ||
				data.before.revision < backup.clients[id].revision
			)
				errors++;
			if (data.before.revision === backup.clients[id].revision) {
				const keys = isFlagging
					? (["archivedAt", "revision", "updatedAt", "flagged", "flagNote"] as const)
					: (["archivedAt", "revision", "updatedAt"] as const);
				if (keys.some((key) => data.before[key] !== backup.clients[id][key])) errors++;
			} else needsReview++;
			if (isFlagging) {
				appliedFlags++;
				const note = manifest.clients.find((item) => item.client_id === id)!.flag_note;
				if (
					entry.action !== "activate-review" ||
					data.after.flagged !== true ||
					data.after.flagNote !== note
				)
					errors++;
			} else {
				restored++;
				if (
					entry.action !== "restore" ||
					data.before.archivedAt === null ||
					"flagged" in data.after ||
					"flagNote" in data.after
				)
					errors++;
			}
			if (current.revision === data.after.revision) {
				const keys = isFlagging
					? (["archivedAt", "revision", "updatedAt", "flagged", "flagNote"] as const)
					: (["archivedAt", "revision", "updatedAt"] as const);
				if (keys.some((key) => current[key] !== data.after[key])) errors++;
				else unchanged++;
			} else if (current.revision > data.after.revision) {
				// Later edits are not migration corruption. Require an attributable, continuous edit chain; unfamiliar actions need human review.
				const history = state.history
					.filter(
						(row) =>
							row.record_kind === "client" &&
							row.record_id === id &&
							!String(row.id).startsWith("migration:"),
					)
					.map((row) => ({
						row,
						payload: JSON.parse(String(row.data)) as {
							revision: number;
							before?: Before;
							after?: Before;
							archivedAt?: unknown;
						},
					}))
					.filter(({ payload }) => payload.revision >= data.after.revision)
					.sort((a, b) => a.payload.revision - b.payload.revision);
				let expected = { ...data.after };
				let continuous = true;
				for (const { row, payload } of history) {
					if (payload.revision !== expected.revision || !row.actor_user_id || !row.effective_user_id) {
						continuous = false;
						break;
					}
					if (row.action === "edit" && payload.after) {
						if (isFlagging) {
							expected.flagged = payload.after.flagged;
							expected.flagNote = payload.after.flagNote;
						}
					} else if (row.action === "archive") expected.archivedAt = payload.archivedAt;
					else if (row.action === "restore") expected.archivedAt = null;
					else if (row.action !== "tag" && row.action !== "untag") {
						continuous = false;
						break;
					}
					expected.revision++;
					expected.updatedAt = row.created_at;
				}
				const keys = isFlagging
					? (["archivedAt", "revision", "updatedAt", "flagged", "flagNote"] as const)
					: (["archivedAt", "revision", "updatedAt"] as const);
				laterEdited++;
				if (!continuous || keys.some((key) => current[key] !== expected[key])) needsReview++;
			} else errors++;
		}
	}
	let preservedDifferences = 0;
	let differencesWithHistory = 0;
	const newHistory = state.history.filter(
		(row) => !backup.rows.history[canonical(row.id)] && !expectedHistory.has(String(row.id)),
	);
	for (const table of tables) {
		const baseline = backup.rows[table];
		requireCondition(baseline, "Backup is missing preservation hashes.");
		for (const key of new Set([...Object.keys(baseline), ...Object.keys(hashes[table])])) {
			if (baseline[key] === hashes[table][key]) continue;
			if (table === "history" && expectedHistory.has(String(JSON.parse(key)))) continue;
			preservedDifferences++;
			if (newHistory.length) differencesWithHistory++;
		}
	}
	// Hash differences establish differences, not their cause. Keep them blockers for focused History review instead of overwriting live work.
	console.log(
		JSON.stringify({
			appliedFlags,
			restoredAmong113: restored,
			alreadyActiveAmong113: alreadyActive,
			unchangedSinceMigration: unchanged,
			laterEdited,
			migrationMismatches: errors,
			concurrentStatesNeedingReview: needsReview,
			preservationDifferences: preservedDifferences,
			differencesWithAdditionalHistory: differencesWithHistory,
		}),
	);
	requireCondition(
		errors === 0 && needsReview === 0 && preservedDifferences === 0,
		"Verification needs review of the reported aggregate differences. No data was written.",
	);
}

try {
	await main();
} catch (cause) {
	// Never print API payloads, SQL failures, client fields, or snapshots.
	console.error(
		cause instanceof ReviewFailure
			? cause.message
			: "Client review verification failed. Check local inputs, credentials, and remote connectivity. No data was written.",
	);
	process.exitCode = 1;
}
