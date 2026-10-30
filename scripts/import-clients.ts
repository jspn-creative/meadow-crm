import { readFile } from "node:fs/promises";
import { getPlatformProxy } from "wrangler";
import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";

// One-time, local-D1 importer. A future production run must be an explicit, separately reviewed
// change: replace this local proxy with an explicitly targeted production binding and approval gate.
const sourcePath = "docs/client-data.csv";
const applying = process.argv
	.slice(2)
	.filter((arg) => arg !== "--")
	.includes("--apply");
if (
	process.argv
		.slice(2)
		.filter((arg) => arg !== "--")
		.some((arg) => arg !== "--apply")
)
	throw new Error("Usage: vp run db:import-clients [-- --apply]");

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
	people: { name: string; phone: string; email: string }[];
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
const groups = new Map<string, Record<string, string>[]>();
const csv = parseCsv(await readFile(sourcePath, "utf8"));
for (const row of csv) {
	const key = value(row, "source_row");
	if (!key) throw new Error("CSV contains a row without a source_row key.");
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
	const couple =
		rows.some((row) => /couple/i.test(value(row, "import_note"))) ||
		rows.some((row) =>
			["OLD_spouse_first_name", "OLD_spouse_last_name", "OLD_spouse_email", "OLD_spouse_phone"].some(
				(key) => value(row, key),
			),
		);
	const fullName = `${value(first, "first_name")} ${value(first, "last_name")}`.trim();
	const spouseName =
		`${value(first, "OLD_spouse_first_name")} ${value(first, "OLD_spouse_last_name")}`.trim();
	const nameParts = fullName.split(/\s+&\s+|\s+and\s+/i);
	const primaryName = couple && nameParts.length > 1 ? nameParts[0] : fullName;
	const secondName = couple
		? spouseName || (nameParts.length > 1 ? nameParts.slice(1).join(" & ") : "")
		: "";
	const email = relay(value(first, "email")) ? "" : value(first, "email");
	const spouseEmail = relay(value(first, "OLD_spouse_email"))
		? ""
		: value(first, "OLD_spouse_email");
	const phone = value(first, "phone");
	const spousePhone = value(first, "OLD_spouse_phone");
	const address = ["address", "city", "state", "zip"]
		.map((key) => value(first, key))
		.filter(Boolean)
		.join(", ");
	const hasContact = !!(email || phone || spouseEmail || spousePhone || address);
	if (!primaryName) {
		skipped[hasContact ? "missingName" : "noContact"]++;
		continue;
	}
	if (!(email || phone || spouseEmail || spousePhone || address)) {
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
		{ name: primaryName, phone, email },
		...(couple && secondName ? [{ name: secondName, phone: spousePhone, email: spouseEmail }] : []),
	];
	const leadSource = referral ? "Referral" : sourceValue || null;
	clients.push({
		source,
		id: `import-client-${source}`,
		name: primaryName,
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

const summary = {
	rows: csv.length,
	distinctClients: groups.size,
	imported: clients.length,
	skipped,
	people: clients.reduce((sum, client) => sum + client.people.length, 0),
	emails: clients.reduce(
		(sum, client) => sum + client.people.filter((person) => person.email).length,
		0,
	),
	phones: clients.reduce(
		(sum, client) => sum + client.people.filter((person) => person.phone).length,
		0,
	),
	addresses: clients.reduce((sum, client) => sum + client.addresses.length, 0),
	archived: clients.filter((client) => client.archived).length,
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
if (applying) {
	const proxy = await getPlatformProxy<{ DB: D1Database }>({
		configPath: "wrangler.jsonc",
		persist: { path: process.env.MEADOW_LOCAL_STATE_DIR ?? ".wrangler/state/v3" },
	});
	try {
		const db = proxy.env.DB;
		const tag = await db
			.prepare("SELECT id FROM tags WHERE lower(name) = 'sphere'")
			.first<{ id: string }>();
		if (clients.some((client) => client.tags.length) && !tag)
			throw new Error("The existing Sphere tag is missing; run local DB seed first.");
		const realtor = "business-realtor";
		const statements: D1PreparedStatement[] = [];
		for (const client of clients) {
			const exists = await db.prepare("SELECT id FROM clients WHERE id = ?").bind(client.id).first();
			if (exists) continue;
			const stamp = client.created;
			statements.push(
				db
					.prepare(
						"INSERT INTO clients (id,name,lead_source,notes,imported_data,consent_call,consent_text,consent_email,consent_mail,archived_at,fictional,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?)",
					)
					.bind(
						client.id,
						client.name,
						client.leadSource,
						client.notes,
						JSON.stringify(client.importedData),
						client.dnc ? 0 : 1,
						client.dnc ? 0 : 1,
						client.consentEmail ? 1 : 0,
						client.dnc ? 0 : 1,
						client.archived ? client.updated : null,
						client.created,
						client.updated,
					),
			);
			client.people.forEach((person, index) => {
				const personId = `${client.id}-person-${index + 1}`;
				statements.push(
					db
						.prepare(
							"INSERT INTO client_people (id,client_id,name,position,revision,created_at,updated_at) VALUES (?,?,?, ?,1,?,?)",
						)
						.bind(personId, client.id, person.name, index, stamp, client.updated),
				);
				if (person.phone)
					statements.push(
						db
							.prepare(
								"INSERT INTO person_phones (id,person_id,label,value,position,revision,created_at,updated_at) VALUES (?,?, 'Mobile', ?,0,1,?,?)",
							)
							.bind(`${personId}-phone`, personId, person.phone, stamp, client.updated),
					);
				if (person.email)
					statements.push(
						db
							.prepare(
								"INSERT INTO person_emails (id,person_id,label,value,position,revision,created_at,updated_at) VALUES (?,?, 'Primary', ?,0,1,?,?)",
							)
							.bind(`${personId}-email`, personId, person.email, stamp, client.updated),
					);
			});
			client.addresses.forEach((item, index) =>
				statements.push(
					db
						.prepare(
							"INSERT INTO client_addresses (id,client_id,label,address,owned,position,revision,created_at,updated_at) VALUES (?,?, 'Home', ?,0,?,1,?,?)",
						)
						.bind(`${client.id}-address-${index + 1}`, client.id, item, index, stamp, client.updated),
				),
			);
			if (client.tags.includes("sphere") && tag)
				statements.push(
					db.prepare("INSERT INTO client_tags (client_id,tag_id) VALUES (?,?)").bind(client.id, tag.id),
				);
			statements.push(
				db
					.prepare(
						"INSERT INTO history (id,record_kind,record_id,actor_user_id,effective_user_id,action,data,fictional,created_at) VALUES (?, 'client', ?, ?, ?, 'create', ?,0,?)",
					)
					.bind(
						`${client.id}-history`,
						client.id,
						realtor,
						realtor,
						JSON.stringify({ source: "import", after: { name: client.name } }),
						stamp,
					),
			);
		}
		for (let offset = 0; offset < statements.length; offset += 75)
			await db.batch(statements.slice(offset, offset + 75));
		const result = await db
			.prepare(
				"SELECT count(*) AS clients,(SELECT count(*) FROM client_people p JOIN clients c ON c.id=p.client_id WHERE c.id LIKE 'import-client-%') AS people,(SELECT count(*) FROM person_emails e JOIN client_people p ON p.id=e.person_id JOIN clients c ON c.id=p.client_id WHERE c.id LIKE 'import-client-%') AS emails,(SELECT count(*) FROM person_phones ph JOIN client_people p ON p.id=ph.person_id JOIN clients c ON c.id=p.client_id WHERE c.id LIKE 'import-client-%') AS phones,(SELECT count(*) FROM client_addresses WHERE client_id LIKE 'import-client-%') AS addresses,(SELECT count(*) FROM history WHERE record_kind='client' AND record_id LIKE 'import-client-%') AS history FROM clients WHERE id LIKE 'import-client-%'",
			)
			.first();
		console.log(`Local D1 totals: ${JSON.stringify(result)}`);
	} finally {
		await proxy.dispose();
	}
}
