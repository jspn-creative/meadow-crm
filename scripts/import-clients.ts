import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { D1PreparedStatement } from "@cloudflare/workers-types";
import { normalizeImportName } from "./import-name.ts";

// One-time importer. Target selection and --apply are always explicit; a dry run opens no database.
const sourcePath = "docs/misc/client-data.csv";
const args = process.argv.slice(2).filter((arg: string) => arg !== "--");
const applying = args.includes("--apply");
const verifying = args.includes("--verify");
const remote = args.includes("--remote");
const local = args.includes("--local");
if (
	args.some((arg: string) => !["--apply", "--remote", "--local", "--verify"].includes(arg)) ||
	(remote && local)
)
	throw new Error("Usage: vp run db:import-clients [-- --local | --remote] [--apply | --verify]");
if ((applying || verifying) && !remote && !local)
	throw new Error("Choose --local or --remote explicitly for apply or verify.");
if (verifying && applying) throw new Error("Choose --apply or --verify, not both.");

function parseCsv(input: string): Record<string, string>[] {
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
			if (row.some((cell) => cell !== "")) rows.push(row);
			row = [];
		} else field += char;
	}
	if (quoted) throw new Error("CSV has an unterminated quoted field.");
	if (field || row.length) {
		row.push(field);
		rows.push(row);
	}
	const headers = rows.shift() ?? [];
	if (!headers.length || new Set(headers).size !== headers.length)
		throw new Error("CSV header is missing or duplicated.");
	return rows.map((cells, index) => {
		if (cells.length !== headers.length)
			throw new Error(`CSV row ${index + 2} has an invalid column count.`);
		return Object.fromEntries(headers.map((header, column) => [header, cells[column]]));
	});
}

type Client = {
	source: string;
	id: string;
	name: string;
	people: {
		name: string;
		phones: { label: string; value: string }[];
		emails: { label: string; value: string }[];
	}[];
	addresses: string[];
	leadSource: string | null;
	tags: string[];
	notes: string;
	importedData: { label: string; value: string }[];
	created: string;
	updated: string;
	archived: boolean;
	dnc: boolean;
	consentEmail: boolean;
};
const value = (row: Record<string, string>, key: string) => (row[key] ?? "").trim();
const relay = (email: string) => /@(?:[^@.]+\.)*kvleads\.com$/i.test(email);
const numericName = (name: string) => /^[\d\s()+.-]+$/.test(name);
const phoneKey = (phone: string) => phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
const canonicalSources: Record<string, string> = {
	referral: "Referral",
	"open house": "Open house",
	sign: "Sign",
	website: "Website",
	"walk-in": "Walk-in",
};
const contactValues = (
	rows: Record<string, string>[],
	fields: [string, string][],
	email = false,
) => {
	const seen = new Set<string>();
	return fields.flatMap(([key, label]) =>
		rows.flatMap((row) => {
			const item = value(row, key);
			const normalized = email ? item.toLowerCase() : phoneKey(item);
			if (!item || (email && relay(item)) || seen.has(normalized)) return [];
			seen.add(normalized);
			return [{ label, value: email ? normalized : item }];
		}),
	);
};
const groups = new Map<string, Record<string, string>[]>();
const csv = parseCsv(await readFile(sourcePath, "utf8"));
for (const row of csv) {
	const key = value(row, "source_row");
	if (!/^\d+$/.test(key)) throw new Error("CSV contains a missing or invalid source_row key.");
	groups.set(key, [...(groups.get(key) ?? []), row]);
}
const clients: Client[] = [];
const skipped = { testRecord: 0, noContact: 0, missingName: 0 };
const mappedColumns = new Set([
	"source_row",
	"first_name",
	"last_name",
	"OLD_spouse_first_name",
	"OLD_spouse_last_name",
	"email",
	"OLD_spouse_email",
	"phone",
	"OLD_spouse_phone",
	"OLD_cell_phone_2",
	"OLD_home_phone",
	"OLD_second_email",
	"address",
	"city",
	"state",
	"zip",
	"lead_source",
	"tags",
	"do_not_contact",
	"email_consent",
	"created_at",
	"updated_at",
	"client_archived",
	"notes",
	"import_note",
]);
for (const [source, rows] of groups) {
	if (rows.some((row) => /test record/i.test(value(row, "import_note")))) {
		skipped.testRecord++;
		continue;
	}
	const first = rows[0];
	const fullName = `${value(first, "first_name")} ${value(first, "last_name")}`.trim();
	const nameParts = fullName.split(/\s*&\s*|\s+and\s+/i);
	const couple =
		nameParts.length > 1 ||
		rows.some((row) => /couple/i.test(value(row, "import_note"))) ||
		rows.some((row) =>
			["OLD_spouse_first_name", "OLD_spouse_last_name", "OLD_spouse_email", "OLD_spouse_phone"].some(
				(key) => value(row, key),
			),
		);
	const spouseName =
		`${value(first, "OLD_spouse_first_name")} ${value(first, "OLD_spouse_last_name")}`.trim();
	let primaryName = couple && nameParts.length > 1 ? nameParts[0] : fullName;
	let secondName = couple
		? spouseName || (nameParts.length > 1 ? nameParts.slice(1).join(" & ") : "")
		: "";
	// Either person can be the one with the shared surname in a combined name.
	if (secondName) {
		const primaryParts = primaryName.trim().split(/\s+/);
		const secondParts = secondName.trim().split(/\s+/);
		const lastName = value(first, "last_name");
		const sharedSurname =
			(!/&|\band\b/i.test(lastName) ? lastName : "") ||
			(secondParts.length > 1 ? secondParts.slice(1).join(" ") : primaryParts.slice(1).join(" "));
		if (primaryParts.length === 1 && sharedSurname) primaryName += ` ${sharedSurname}`;
		if (secondParts.length === 1 && sharedSurname) secondName += ` ${sharedSurname}`;
	}
	primaryName = normalizeImportName(primaryName);
	secondName = normalizeImportName(secondName);
	const phones = contactValues(rows, [
		["phone", "Mobile"],
		["OLD_cell_phone_2", "Mobile 2"],
		["OLD_home_phone", "Home"],
	]);
	const emails = contactValues(
		rows,
		[
			["email", "Primary"],
			["OLD_second_email", "Other"],
		],
		true,
	);
	const spousePhones = contactValues(rows, [["OLD_spouse_phone", "Mobile"]]);
	const spouseEmails = contactValues(rows, [["OLD_spouse_email", "Primary"]], true);
	const misplacedPhone =
		numericName(fullName) &&
		phoneKey(value(first, "address")).length === 10 &&
		/^[\d\s()+.-]+$/.test(value(first, "address"));
	if (
		misplacedPhone &&
		!phones.some((item) => phoneKey(item.value) === phoneKey(value(first, "address")))
	)
		phones.push({ label: "Mobile", value: value(first, "address") });
	const address = misplacedPhone
		? ""
		: ["address", "city", "state", "zip"]
				.map((key) => value(first, key))
				.filter((item) => item && item !== "_")
				.join(", ");
	const hasContact = !!(
		emails.length ||
		phones.length ||
		spouseEmails.length ||
		spousePhones.length ||
		address
	);
	if (!primaryName) {
		skipped[hasContact ? "missingName" : "noContact"]++;
		continue;
	}
	if (!hasContact) {
		skipped.noContact++;
		continue;
	}
	const notes: string[] = [];
	for (const row of rows) {
		const note = value(row, "notes");
		if (note && !notes.includes(note)) notes.push(note);
	}
	const importedData = Object.keys(first)
		.filter((key) => !mappedColumns.has(key))
		.flatMap((key) => {
			const vals = [...new Set(rows.map((row) => value(row, key)).filter(Boolean))];
			return vals.length
				? [
						{
							label: key
								.replace(/^OLD_/, "Legacy ")
								.replaceAll("_", " ")
								.replace(/\b\w/g, (letter) => letter.toUpperCase()),
							value: vals.join("; "),
						},
					]
				: [];
		});
	importedData.unshift({ label: "Source row", value: source });
	for (const key of ["email", "OLD_second_email", "OLD_spouse_email"]) {
		const relays = [...new Set(rows.map((row) => value(row, key).toLowerCase()).filter(relay))];
		if (relays.length) importedData.push({ label: `Relay email (${key})`, value: relays.join("; ") });
	}
	if (fullName !== primaryName || secondName)
		importedData.push({ label: "Original name", value: fullName });
	if (numericName(fullName))
		importedData.push({
			label: "Import review",
			value: "Name contains only a phone number; identify this person. Blank names are not supported.",
		});
	if (misplacedPhone)
		importedData.push({
			label: "Address correction",
			value: "Phone number moved from address to Mobile; placeholder city discarded.",
		});
	const importNotes = [...new Set(rows.map((row) => value(row, "import_note")).filter(Boolean))];
	if (importNotes.length) importedData.push({ label: "Import note", value: importNotes.join("; ") });
	const sourceValue = rows.map((row) => value(row, "lead_source")).find(Boolean) ?? "";
	const referral = rows.some((row) =>
		value(row, "tags")
			.toLowerCase()
			.split(/[;,| ]+/)
			.includes("referral"),
	);
	const tagNames = rows
		.flatMap((row) =>
			value(row, "tags")
				.toLowerCase()
				.split(/[;,| ]+/),
		)
		.filter((tag) => tag === "sphere");
	const dnc = rows.some((row) => /^(true|yes|1)$/i.test(value(row, "do_not_contact")));
	const consentEmail =
		!dnc && rows.some((row) => value(row, "email_consent").toLowerCase() !== "no");
	const created = value(first, "created_at") || new Date(0).toISOString();
	const updated = value(first, "updated_at") || created;
	const people = [
		{ name: primaryName, phones, emails },
		...(couple && secondName
			? [{ name: secondName, phones: spousePhones, emails: spouseEmails }]
			: []),
	];
	if (!secondName) {
		for (const item of spousePhones)
			if (!phones.some((existing) => phoneKey(existing.value) === phoneKey(item.value)))
				phones.push({ ...item, label: "Spouse" });
		for (const item of spouseEmails)
			if (!emails.some((existing) => existing.value.toLowerCase() === item.value.toLowerCase()))
				emails.push({ ...item, label: "Spouse" });
	}
	if (sourceValue && !canonicalSources[sourceValue.toLowerCase()])
		throw new Error(`Unmapped lead source at source_row ${source}.`);
	const leadSource = referral ? "Referral" : canonicalSources[sourceValue.toLowerCase()] || null;
	clients.push({
		source,
		id: `import-client-${source}`,
		name: secondName
			? nameParts.length > 1
				? normalizeImportName(fullName)
				: `${primaryName} & ${secondName}`
			: primaryName,
		people,
		addresses: address ? [address] : [],
		leadSource,
		tags: [...new Set(tagNames)],
		notes: notes.join("\n"),
		importedData,
		created,
		updated,
		archived: rows.some((row) => /^(true|yes|1)$/i.test(value(row, "client_archived"))),
		dnc,
		consentEmail,
	});
}

// Flag evidence for human review, never merge identities on a shared name or phone alone.
const duplicateIndexes = [new Map<string, Set<Client>>(), new Map<string, Set<Client>>()];
for (const client of clients) {
	for (const [index, keys] of [
		[duplicateIndexes[0], [client.name.toLowerCase()]],
		[
			duplicateIndexes[1],
			client.people.flatMap((person) => person.phones.map((phone) => phoneKey(phone.value))),
		],
	] as const) {
		for (const key of keys) {
			if (!key) continue;
			const matches = index.get(key) ?? new Set<Client>();
			matches.add(client);
			index.set(key, matches);
		}
	}
}
const duplicateGroups = new Map<string, { sourceRows: string[]; reasons: string[] }>();
duplicateIndexes.forEach((index, kind) => {
	for (const matches of index.values()) {
		if (matches.size < 2) continue;
		const sourceRows = [...matches]
			.map((client) => client.source)
			.sort((a, b) => Number(a) - Number(b));
		const group = duplicateGroups.get(sourceRows.join(",")) ?? { sourceRows, reasons: [] };
		group.reasons.push(kind ? "shared phone" : "same name");
		duplicateGroups.set(sourceRows.join(","), group);
	}
});
for (const group of duplicateGroups.values()) {
	for (const source of group.sourceRows)
		clients
			.find((client) => client.source === source)!
			.importedData.push({
				label: "Possible duplicate source rows",
				value: `${group.sourceRows.join(", ")} (${group.reasons.join("; ")}); kept separate pending review.`,
			});
}

const summary = {
	rows: csv.length,
	distinctClients: groups.size,
	imported: clients.length,
	skipped,
	people: clients.reduce((sum, client) => sum + client.people.length, 0),
	emails: clients.reduce(
		(sum, client) => sum + client.people.reduce((count, person) => count + person.emails.length, 0),
		0,
	),
	phones: clients.reduce(
		(sum, client) => sum + client.people.reduce((count, person) => count + person.phones.length, 0),
		0,
	),
	addresses: clients.reduce((sum, client) => sum + client.addresses.length, 0),
	archived: clients.filter((client) => client.archived).length,
	couples: clients.filter((client) => client.people.length > 1).length,
	numericNamesFlagged: clients.filter((client) => numericName(client.name)).length,
	relayEmailsRetained: clients.reduce(
		(count, client) =>
			count + client.importedData.filter((item) => item.label.startsWith("Relay email")).length,
		0,
	),
	duplicateGroups: duplicateGroups.size,
	doNotContact: clients.filter((client) => client.dnc).length,
	tags: clients.filter((client) => client.tags.includes("sphere")).length,
	leadSources: Object.fromEntries(
		[
			...new Set(
				clients.map((client) => client.leadSource).filter((source): source is string => !!source),
			),
		].map((source) => [source, clients.filter((client) => client.leadSource === source).length]),
	),
	importedDataFilled: Object.fromEntries(
		[...new Set(csv.flatMap((row) => Object.keys(row).filter((key) => !mappedColumns.has(key))))]
			.map((field) => [
				field,
				clients.filter((client) =>
					client.importedData.some(
						(item) =>
							item.label.toLowerCase() ===
							field.replace(/^OLD_/, "Legacy ").replaceAll("_", " ").toLowerCase(),
					),
				).length,
			])
			.filter(([, count]) => count),
	),
};
console.log(`${applying ? "Apply plan" : "Dry run"}: ${JSON.stringify(summary)}`);
const proxy =
	local && (applying || verifying)
		? await (await import("./local-d1.ts")).localD1Database()
		: undefined;
try {
	const database = async () => proxy?.env.DB ?? (await import("./remote-d1.ts")).remoteD1Database();
	if (applying || verifying) {
		const db = await database();
		const tag = await db
			.prepare("SELECT id FROM tags WHERE lower(name) = 'sphere'")
			.first<{ id: string }>();
		if (clients.some((client) => client.tags.length) && !tag)
			throw new Error("The existing Sphere tag is missing; run the targeted default seed first.");
		type Row = Record<string, string | number | null>;
		const tables: Record<string, Row[]> = {
			clients: [],
			client_people: [],
			person_phones: [],
			person_emails: [],
			client_addresses: [],
			client_tags: [],
			history: [],
		};
		for (const client of clients) {
			const timestamps = { created_at: client.created, updated_at: client.updated };
			tables.clients.push({
				id: client.id,
				name: client.name,
				lead_source: client.leadSource,
				notes: client.notes,
				imported_data: JSON.stringify(client.importedData),
				consent_call: client.dnc ? 0 : 1,
				consent_text: client.dnc ? 0 : 1,
				consent_email: client.consentEmail ? 1 : 0,
				consent_mail: client.dnc ? 0 : 1,
				archived_at: client.archived ? client.updated : null,
				fictional: 0,
				...timestamps,
			});
			client.people.forEach((person, index) => {
				const personId = `${client.id}-person-${index + 1}`;
				tables.client_people.push({
					id: personId,
					client_id: client.id,
					name: person.name,
					position: index,
					revision: 1,
					...timestamps,
				});
				for (const [table, items, suffix] of [
					["person_phones", person.phones, "phone"],
					["person_emails", person.emails, "email"],
				] as const) {
					items.forEach((item, position) =>
						tables[table].push({
							id: `${personId}-${suffix}-${position + 1}`,
							person_id: personId,
							label: item.label,
							value: item.value,
							position,
							revision: 1,
							...timestamps,
						}),
					);
				}
			});
			client.addresses.forEach((address, position) =>
				tables.client_addresses.push({
					id: `${client.id}-address-${position + 1}`,
					client_id: client.id,
					label: "Home",
					address,
					owned: 0,
					position,
					revision: 1,
					...timestamps,
				}),
			);
			if (client.tags.includes("sphere") && tag)
				tables.client_tags.push({ client_id: client.id, tag_id: tag.id });
			tables.history.push({
				id: `${client.id}-history`,
				record_kind: "client",
				record_id: client.id,
				actor_user_id: "support-admin",
				effective_user_id: "support-admin",
				action: "create",
				data: JSON.stringify({
					source: "import",
					source_row: client.source,
					mapping: 2,
					after: { name: client.name },
				}),
				fictional: 0,
				created_at: client.created,
			});
		}
		const scope: Record<string, string> = {
			clients: "id GLOB 'import-client-*'",
			client_people: "client_id GLOB 'import-client-*'",
			person_phones:
				"person_id IN (SELECT id FROM client_people WHERE client_id GLOB 'import-client-*')",
			person_emails:
				"person_id IN (SELECT id FROM client_people WHERE client_id GLOB 'import-client-*')",
			client_addresses: "client_id GLOB 'import-client-*'",
			client_tags: "client_id GLOB 'import-client-*'",
			history: "record_kind = 'client' AND record_id GLOB 'import-client-*'",
			client_key_dates: "client_id GLOB 'import-client-*'",
			client_relationships: "client_id GLOB 'import-client-*'",
			record_references: "client_id GLOB 'import-client-*'",
		};
		if (applying) {
			// Back up precisely the replaced records in a private local file, never in logs or the repository.
			const backup: Record<string, unknown[]> = {};
			for (const [table, where] of Object.entries(scope))
				backup[table] = (await db.prepare(`SELECT * FROM ${table} WHERE ${where}`).all()).results;
			const backupDirectory = await mkdtemp(join(tmpdir(), "meadow-client-import-"));
			await writeFile(join(backupDirectory, "before.json"), JSON.stringify(backup), { mode: 0o600 });
			console.log(`Private replacement backup: ${backupDirectory}/before.json`);
			const statements: D1PreparedStatement[] = [db.prepare("PRAGMA defer_foreign_keys = ON")];
			for (const table of [
				"person_phones",
				"person_emails",
				"client_people",
				"client_addresses",
				"client_tags",
				"client_key_dates",
				"client_relationships",
				"record_references",
				"history",
				"clients",
			])
				statements.push(db.prepare(`DELETE FROM ${table} WHERE ${scope[table]}`));
			for (const [table, rows] of Object.entries(tables)) {
				if (!rows.length) continue;
				const columns = Object.keys(rows[0]);
				for (let offset = 0; offset < rows.length; offset += 25) {
					statements.push(
						db
							.prepare(
								`INSERT INTO ${table} (${columns.join(",")}) SELECT ${columns.map((column) => `json_extract(value, '$.${column}')`).join(",")} FROM json_each(?)`,
							)
							.bind(JSON.stringify(rows.slice(offset, offset + 25))),
					);
				}
			}
			// One D1 batch is one transaction: deletion and the entire replacement succeed or roll back together.
			await db.batch(statements);
		}
		// Compare every mapped field, not only totals. Personal data stays in memory; errors expose IDs only.
		for (const [table, expectedRows] of Object.entries(tables)) {
			const actualRows = (await db.prepare(`SELECT * FROM ${table} WHERE ${scope[table]}`).all<Row>())
				.results;
			const key = (row: Row) => String(row.id ?? `${row.client_id}:${row.tag_id}`);
			const actual = new Map(actualRows.map((row) => [key(row), row]));
			const mismatches = expectedRows.filter(
				(row) =>
					!actual.has(key(row)) ||
					Object.entries(row).some(([column, item]) => actual.get(key(row))![column] !== item),
			);
			if (actualRows.length !== expectedRows.length || mismatches.length)
				throw new Error(
					`Import mapping mismatch in ${table}; affected IDs: ${mismatches.map(key).join(", ") || "unexpected rows"}.`,
				);
		}
		const result = await db
			.prepare(
				"SELECT count(*) AS clients,(SELECT count(*) FROM client_people p JOIN clients c ON c.id=p.client_id WHERE c.id LIKE 'import-client-%') AS people,(SELECT count(*) FROM person_emails e JOIN client_people p ON p.id=e.person_id JOIN clients c ON c.id=p.client_id WHERE c.id LIKE 'import-client-%') AS emails,(SELECT count(*) FROM person_phones ph JOIN client_people p ON p.id=ph.person_id JOIN clients c ON c.id=p.client_id WHERE c.id LIKE 'import-client-%') AS phones,(SELECT count(*) FROM client_addresses WHERE client_id LIKE 'import-client-%') AS addresses,(SELECT count(*) FROM history WHERE record_kind='client' AND record_id LIKE 'import-client-%') AS history FROM clients WHERE id LIKE 'import-client-%'",
			)
			.first<Record<string, number>>();
		console.log(`${local ? "Local" : "Remote"} D1 totals: ${JSON.stringify(result)}`);
		const expected = {
			clients: summary.imported,
			people: summary.people,
			emails: summary.emails,
			phones: summary.phones,
			addresses: summary.addresses,
			history: summary.imported,
		};
		if (!result || Object.entries(expected).some(([key, count]) => Number(result[key]) !== count))
			throw new Error(
				"Import totals do not match the CSV plan; inspect before retrying or repairing data.",
			);
	}
} finally {
	await proxy?.dispose();
}
