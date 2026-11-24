import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { remoteD1Database } from "./remote-d1.ts";

// Preparation reads production read-only and writes a private backup and reviewed SQL; Alchemy remains the only migration writer.
const migration = "20261124200000_import_client_activity";
const migrationPath = `migrations/${migration}/migration.sql`;
const databaseId = "f3dcaa0f-97ad-4403-b32d-a2164027c64d";
const importedAuthor = "support-admin";
const statementBytes = 90_000;

type Row = Record<string, any>;
type State = Record<string, Row[]>;
type Kind =
	| "text-automated"
	| "text-outgoing"
	| "text-incoming"
	| "text-stop"
	| "call"
	| "zillow"
	| "note"
	| "market-report"
	| "lead-created"
	| "lead-status"
	| "qualification"
	| "field-change"
	| "concierge"
	| "valuation"
	| "tcpa-dropped";
type Detail = { label: string; value: string };
/** One activity row as the migration inserts it; `notesGuard` limits a Meadow-era note to a record whose notes still read as prepared. */
type Planned = {
	id: string;
	clientId: string | null;
	opportunityId: string | null;
	kind: "note" | "contact";
	channel: string | null;
	direction: string | null;
	outcome: string | null;
	occurredAt: string;
	body: string;
	detail: Record<string, unknown>;
	actorUserId: string;
	effectiveUserId: string;
	clientIsActor: number;
	imported: number;
	automated: number;
	notesGuard?: string;
};
type Backup = {
	databaseId: string;
	migration: string;
	rawHash: string;
	preparedAt: string;
	state: State;
	rows: Planned[];
	report: Record<string, unknown>;
};
type Parsed = { kind: Kind; row?: Omit<Planned, "id" | "clientId" | "occurredAt"> };

class ImportFailure extends Error {}
function requireCondition(value: unknown, message: string): asserts value {
	if (!value) throw new ImportFailure(message);
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

const entities: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};
/** BoldTrail stores HTML fragments; Activity stores plain text with line breaks and bare links. */
function plain(html: string) {
	return html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<a\s[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/a>/gi, "$1")
		.replace(/<\/?[a-z][^>]*>/gi, "")
		.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (match, name: string) =>
			name[0] === "#"
				? String.fromCodePoint(
						name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1)),
					)
				: (entities[name.toLowerCase()] ?? match),
		)
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
/** Raw codes such as `AutoClaimed` or `lead-disqualified` read as words, never as codes. */
function humanize(code: string) {
	const words = code
		.trim()
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/[-_]+/g, " ")
		.toLowerCase();
	return (
		{
			"auto claimed": "claimed automatically",
			"follow up campaign": "follow-up campaign",
			"opt out": "opted out",
			"lead disqualified": "disqualified",
		}[words] ?? words
	);
}
const list = (items: string[]) =>
	items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);
/** `Key: value` lines of a BoldTrail entry, and whatever free text sits between them. */
function fields(body: string) {
	const pairs: Detail[] = [];
	const loose: string[] = [];
	for (const line of body.split(/<br\s*\/?>|\n/i)) {
		const match = line.trim().match(/^([A-Z][A-Za-z ]{1,25}):\s?(.*)$/);
		if (match) pairs.push({ label: match[1].trim(), value: plain(match[2]) });
		else if (plain(line)) loose.push(plain(line));
	}
	return { pairs, loose };
}

const none = { channel: null, direction: null, outcome: null } as const;
const boldtrail = {
	actorUserId: importedAuthor,
	effectiveUserId: importedAuthor,
	clientIsActor: 0,
	imported: 1,
	automated: 0,
};
function event(
	kind: Kind,
	summary: string,
	options: {
		automation?: string;
		standalone?: boolean;
		emphasis?: string[];
		fields?: Detail[];
		changes?: { field: string; before: string; after: string }[];
	} = {},
): Parsed {
	const shown = [
		...(options.changes ?? []).map((change) => ({
			label: change.field.charAt(0).toUpperCase() + change.field.slice(1),
			value: `${change.before || "Not set"} → ${change.after || "Not set"}`,
		})),
		...(options.fields ?? []),
	].filter((item) => item.value);
	return {
		kind,
		row: {
			...none,
			...boldtrail,
			opportunityId: null,
			kind: "note",
			body: options.standalone ? summary : `BoldTrail ${summary}`,
			detail: {
				boldtrail: kind,
				event: {
					summary,
					...(options.automation && { automation: options.automation }),
					...(options.standalone && { standalone: true }),
					...(options.emphasis?.length && { emphasis: options.emphasis }),
				},
				...(shown?.length && { fields: shown }),
				...(options.changes?.length && { changes: options.changes }),
			},
		},
	};
}
function contact(
	kind: Kind,
	channel: string,
	direction: "incoming" | "outgoing",
	body: string,
	options: {
		outcome?: string;
		client?: boolean;
		automated?: boolean;
		stop?: boolean;
		fields?: Detail[];
	} = {},
): Parsed {
	const shown = options.fields?.filter((item) => item.value);
	return {
		kind,
		row: {
			...boldtrail,
			opportunityId: null,
			kind: "contact",
			channel,
			direction,
			outcome: options.outcome ?? null,
			body,
			clientIsActor: Number(Boolean(options.client)),
			automated: Number(Boolean(options.automated)),
			detail: {
				boldtrail: kind,
				...(options.stop && { stop: true }),
				...(shown?.length && { fields: shown }),
			},
		},
	};
}
function note(body: string, extra: Detail[] = []): Parsed {
	return {
		kind: "note",
		row: {
			...none,
			...boldtrail,
			opportunityId: null,
			kind: "note",
			body,
			detail: { boldtrail: "note", ...(extra.length && { fields: extra }) },
		},
	};
}

const callOutcomes: Record<string, string> = {
	phoneConversation: "talked",
	successfulTransfer: "talked",
	optedOut: "talked",
	wrongNumber: "wrong-number",
};
const callResults: Record<string, string> = {
	successfulTransfer: "Transferred to the agent",
	optedOut: "Opted out",
};
const stopWord = /^\W*(stop|stop all|stopall|unsubscribe|cancel|end|quit)\W*$/i;

/** Classifies one dated `Agent Notes` entry by the patterns in docs/notes/client-activity.md; anything unrecognized stays a note. */
function parseEntry(raw: string, template: (body: string) => boolean): Parsed {
	if (/TCPA consent checkbox on|did not provide TCPA consent/.test(raw))
		return { kind: "tcpa-dropped" };
	const sms = raw.match(
		/^To Number: [^<]*<br>From Number: [^<]*<br>Direction: (incoming|outgoing)<br>Count: (\d+)<br>Text: ([\s\S]*)<br>Message Type: (\w*)$/,
	);
	if (sms) {
		const body = plain(sms[3]);
		if (sms[1] === "incoming")
			return stopWord.test(body)
				? contact("text-stop", "text", "incoming", body, { client: true, stop: true })
				: contact("text-incoming", "text", "incoming", body, { client: true });
		const automated = template(body);
		return contact(automated ? "text-automated" : "text-outgoing", "text", "outgoing", body, {
			automated,
		});
	}
	const call = raw.match(/^(?:Details: ([\s\S]*?)<br>)?Outcome: (\w+)<br>Phone: (\w+)$/);
	if (call) {
		const body = plain(call[1] ?? "");
		const outcome =
			callOutcomes[call[2]] ??
			(/\bleft (a )?(voice ?mail|vm|message)\b/i.test(body) ? "voicemail" : "no-answer");
		return contact("call", "call", "outgoing", body, {
			outcome,
			fields: [{ label: "Result", value: callResults[call[2]] ?? "" }],
		});
	}
	const zillow = raw.match(
		/^Contact Message: ?([\s\S]*?)(?:<br>Property URL: ([^<]*))?(?:<br>Search: ([^<]*))?<br>#Zillow Tech Connect Message(?:<br>)*$/,
	);
	if (zillow) {
		const [, message, url = "", search = ""] = zillow;
		const notice = message.match(/^([\s\S]*?)\s*\[([^\]]*)\]\s*$/);
		return contact("zillow", "zillow", "incoming", plain(notice ? notice[1] : message), {
			client: true,
			fields: [
				{ label: "Property", value: plain(url) },
				{ label: "Search", value: plain(search) },
				{ label: "Zillow", value: notice ? plain(notice[2]) : "" },
			],
		});
	}
	const report = raw.match(
		/^This contact was sent an? (.+?) report(?: for (.+?))?\.\s*(?:<br\s*\/?>)?\s*<a href="([^"]+)"[^>]*>View Report<\/a>$/,
	);
	if (report) {
		const area = plain(report[2] ?? "").replace(/^Zip - /, "ZIP ");
		return event(
			"market-report",
			`sent a ${report[1].toLowerCase()} report${area ? ` for ${area}` : ""}`,
			{
				automation: "market-report",
				fields: [
					{ label: "Area", value: area },
					{ label: "Report", value: plain(report[3]) },
				],
			},
		);
	}
	const created = raw.match(/^Lead Created via (.+?) - Visiting URL:(?:<br>|\s)*([\s\S]*)$/);
	if (created)
		return event("lead-created", `Added from ${plain(created[1])}`, {
			standalone: true,
			fields: [{ label: "Landing page", value: plain(created[2]) }],
		});
	const qa = raw.match(/^Question: ([\s\S]*?)<br>Answer: ([\s\S]*)$/);
	if (qa)
		return event("qualification", `recorded an answer: ${plain(qa[2])}`, {
			emphasis: [plain(qa[2])],
			fields: [
				{ label: "Question", value: plain(qa[1]) },
				{ label: "Answer", value: plain(qa[2]) },
			],
		});
	const timeline = raw.match(
		/^.*?'s Status was updated to (\w+) based on the Concierge updating the Timeline Qualification Question to (.+?)\.?$/,
	);
	if (timeline)
		return event(
			"lead-status",
			`changed the status to ${timeline[1]} after a timeline of ${timeline[2]}`,
			{
				automation: "status",
				emphasis: [timeline[1]],
			},
		);
	if (/^(Lead Status|Status Type|Reason): /.test(raw)) {
		const { pairs, loose } = fields(raw);
		const value = (label: string) => pairs.find((pair) => pair.label === label)?.value;
		const status = humanize(value("Status Type") ?? value("Reason") ?? value("Lead Status") ?? "");
		requireCondition(status, "A lead status entry has no status.");
		return event("lead-status", `changed the lead status to ${status}`, {
			automation: "status",
			emphasis: [status],
			fields: [
				...pairs.map((pair) =>
					pair.label === "Is Auto Claimed"
						? { label: "Claimed automatically", value: pair.value === "1" ? "Yes" : "No" }
						: pair.label === "Notes"
							? pair
							: { label: pair.label, value: humanize(pair.value) },
				),
				...(loose.length ? [{ label: "Notes", value: loose.join("\n") }] : []),
			],
		});
	}
	const disqualified = raw.match(/^Contact disqualified by Concierge due to (.+)$/);
	if (disqualified)
		return event("lead-status", `disqualified the contact as ${humanize(disqualified[1])}`, {
			automation: "status",
			emphasis: [humanize(disqualified[1])],
		});
	const lines = raw.split(/<br\s*\/?>/i).map((line) => plain(line));
	const changed = lines.map((line) => line.match(/^(.+?) updated from (.*?) to (.*)$/));
	if (changed.every(Boolean)) {
		const changes = changed.map((match) => ({
			field: lowerFirst(match![1].trim()),
			before: match![2].trim() === "blank" ? "" : match![2].trim(),
			after: match![3].trim() === "blank" ? "" : match![3].trim(),
		}));
		return event("field-change", `changed the ${list(changes.map((change) => change.field))}`, {
			automation: "field-change",
			changes,
		});
	}
	if (raw.startsWith("Contact name updated by Concierge<br>"))
		return event("field-change", "changed the contact name", {
			automation: "field-change",
			fields: fields(raw).pairs,
		});
	const updatedBy = lines[0].match(/^Contact updated by (.+)$/);
	if (updatedBy && changed.slice(1).every(Boolean)) {
		const changes = changed.slice(1).map((match) => ({
			field: lowerFirst(match![1].trim()),
			before: match![2].trim() === "blank" ? "" : match![2].trim(),
			after: match![3].trim() === "blank" ? "" : match![3].trim(),
		}));
		return event(
			"field-change",
			changes.length
				? `changed the ${list(changes.map((change) => change.field))}`
				: "updated the contact",
			{ automation: "field-change", changes, fields: [{ label: "Updated by", value: updatedBy[1] }] },
		);
	}
	if (/^\s*Address: /.test(raw))
		return event("valuation", "Requested a home valuation", {
			standalone: true,
			fields: fields(raw).pairs,
		});
	const notices: [RegExp, (match: RegExpMatchArray) => string][] = [
		[
			/^You've reached your account limit\. Concierge has been turned off because you have overages disabled\.$/,
			() => "turned off Concierge because the account reached its limit",
		],
		[
			/^Concierge was turned off for this contact(?: - contact has (\w+) number)?$/,
			(match) =>
				`turned off Concierge for this contact${match[1] ? ` because of a ${match[1]} number` : ""}`,
		],
		[
			/^Received stop word from contact(?: within Success Assurance)?\.?$/,
			() => "received a STOP reply",
		],
		[
			/^This contact was not \w+ to concierge, because (.+?)\.?$/,
			(match) => `skipped Concierge because ${match[1]}`,
		],
		[
			/^Contact met .+? IS .+? and was (assigned|removed from) campaign: (.+)$/,
			(match) =>
				match[1] === "assigned"
					? `assigned the campaign ${match[2]}`
					: `removed the contact from the campaign ${match[2]}`,
		],
		[
			/^\+?[\d() .-]+ was (\w+) as (.+?)\.\s[\s\S]*$/,
			(match) => `${match[1]} a phone number as ${match[2]}`,
		],
		[
			/^(Call|Text) \w+ taken and .+ moved out of needs appointment from Concierge\.$/,
			(match) => lowerFirst(match[0]),
		],
		[
			/^System (\w+) an invalid e-mail address \(.*?\) and (\w+) this contact\.$/,
			(match) => `${match[1]} an invalid email address and ${match[2]} this contact`,
		],
		[/^Contact \w+ in with phone via .+$/, (match) => lowerFirst(match[0])],
	];
	const flat = plain(raw);
	for (const [pattern, summary] of notices) {
		const match = flat.match(pattern);
		if (match) return event("concierge", summary(match).replace(/\.$/, ""), { automation: "status" });
	}
	const delayed = raw.match(/^([\s\S]*?)<br>Action Type: ([\w-]+)$/);
	if (delayed) {
		const body = plain(delayed[1]);
		const action = { label: "Action", value: humanize(delayed[2]) };
		return body
			? note(body, [action])
			: event("concierge", humanize(delayed[2]), { fields: [action] });
	}
	return note(flat);
}

/** Splits `Agent Notes` into its dated entries; an undated fragment came from a `---` inside the previous entry. */
function entries(notes: string) {
	const result: { at: string; body: string }[] = [];
	for (const part of notes.split("---")) {
		const match = part.trim().match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d): ?([\s\S]*)$/);
		if (match) result.push({ at: `${match[1]}T${match[2]}.000Z`, body: match[3].trim() });
		else if (part.trim()) {
			requireCondition(result.length, "Agent Notes start without a date.");
			result.at(-1)!.body += `---${part}`;
		}
	}
	return result;
}

function templateIndex(rows: Record<string, string>[]) {
	const normalize = (body: string, row: Record<string, string>) => {
		let value = body.toLowerCase();
		for (const name of ["First Name", "Last Name", "Spouse First Name", "Spouse Last Name"])
			for (const word of (row[name] ?? "").toLowerCase().split(/\s+/))
				if (word.length > 1) value = value.split(word).join("{name}");
		return value
			.replace(/\S+@\S+/g, "{email}")
			.replace(/\d+/g, "9")
			.replace(/\s+/g, " ")
			.trim();
	};
	const seen = new Map<string, Set<number>>();
	rows.forEach((row, index) => {
		for (const entry of entries(row["Agent Notes"] ?? "")) {
			const sms = entry.body.match(
				/Direction: outgoing<br>Count: \d+<br>Text: ([\s\S]*)<br>Message Type: \w*$/,
			);
			if (!sms) continue;
			const key = normalize(plain(sms[1]), row);
			seen.set(key, (seen.get(key) ?? new Set()).add(index));
		}
	});
	// A body repeated for two or more clients, once their names, emails, and numbers are set aside, is a template.
	return (body: string, row: Record<string, string>) =>
		(seen.get(normalize(body, row))?.size ?? 0) > 1;
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

function plan(raw: Record<string, string>[], state: State) {
	const template = templateIndex(raw);
	const rows: Planned[] = [];
	const kinds: Record<string, number> = {};
	const notes = {
		clientsWithNotes: 0,
		matchesImport: 0,
		editedInMeadow: 0,
		meadowOnly: 0,
		partsCoveredByImport: 0,
		partsWithMeadowText: 0,
		editedWithoutNewText: 0,
		opportunitiesWithNotes: 0,
	};
	let parsedEntries = 0;
	const clients = state.clients.filter((client) => !client.fictional);
	requireCondition(
		clients.every((client) => /^import-client-\d+$/.test(client.id) || !(client.notes ?? "").trim()),
		"An app-created client has notes; extend the plan before preparing.",
	);
	const author = (kind: string, id: string, current: string) => {
		const entry = state.history
			.filter(
				(row) =>
					row.record_kind === kind &&
					row.record_id === id &&
					["create", "edit"].includes(row.action) &&
					(JSON.parse(row.data).after?.notes ?? "").trim() === current,
			)
			.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0];
		requireCondition(entry, "Meadow-era notes text has no History author.");
		return entry;
	};
	const meadowNote = (kind: "client" | "opportunity", record: Row, body: string, guard: string) => {
		const entry = author(kind, record.id, guard.trim());
		rows.push({
			id: `meadow-notes-${kind}-${record.id}`,
			clientId: kind === "client" ? record.id : null,
			opportunityId: kind === "opportunity" ? record.id : null,
			kind: "note",
			...none,
			occurredAt: entry.created_at,
			body,
			detail: { notesField: kind, historyId: entry.id },
			actorUserId: entry.actor_user_id,
			effectiveUserId: entry.effective_user_id,
			clientIsActor: 0,
			imported: 0,
			automated: 0,
			notesGuard: record.notes,
		});
	};
	for (const client of clients.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))) {
		const source = raw[Number(client.id.slice("import-client-".length)) - 2];
		requireCondition(source, "A surviving client has no raw export row.");
		const original = (source["Agent Notes"] ?? "").trim();
		entries(original).forEach((entry, index) => {
			parsedEntries++;
			const parsed = parseEntry(entry.body, (body) => template(body, source));
			kinds[parsed.kind] = (kinds[parsed.kind] ?? 0) + 1;
			if (!parsed.row) return;
			requireCondition(
				parsed.row.kind === "contact" || parsed.row.body.trim(),
				"An imported note is empty.",
			);
			rows.push({
				...parsed.row,
				id: `import-activity-${client.id.slice("import-client-".length)}-${index + 1}`,
				clientId: client.id,
				occurredAt: entry.at,
			});
		});
		const current: string = (client.notes ?? "").trim();
		if (!current) continue;
		notes.clientsWithNotes++;
		if (current === original) {
			notes.matchesImport++;
			continue;
		}
		if (!original) notes.meadowOnly++;
		else notes.editedInMeadow++;
		// Keep only what Meadow added: a part that is all or some of one BoldTrail entry is already an imported row.
		const originals = original ? original.split("---").map((part) => part.trim()) : [];
		const added = current
			.split("---")
			.map((part) => part.trim())
			.map((part) => {
				if (originals.some((entry) => entry.includes(part))) {
					notes.partsCoveredByImport++;
					return "";
				}
				const inner = originals
					.filter((entry) => entry && part.includes(entry))
					.sort((a, b) => b.length - a.length)[0];
				if (inner) notes.partsCoveredByImport++;
				return inner ? part.replace(inner, "").trim() : part;
			})
			.filter(Boolean);
		notes.partsWithMeadowText += added.length;
		if (added.length) meadowNote("client", client, added.join("\n\n"), client.notes);
		else notes.editedWithoutNewText++;
	}
	for (const opportunity of state.opportunities.filter(
		(row) => !row.fictional && (row.notes ?? "").trim(),
	)) {
		notes.opportunitiesWithNotes++;
		meadowNote("opportunity", opportunity, opportunity.notes.trim(), opportunity.notes);
	}
	const contacts = rows.filter((row) => row.kind === "contact" && row.imported).length;
	const importedNotes = rows.filter((row) => row.kind === "note" && row.imported).length;
	requireCondition(
		Object.values(kinds).reduce((sum, count) => sum + count, 0) === parsedEntries &&
			contacts + importedNotes + (kinds["tcpa-dropped"] ?? 0) === parsedEntries &&
			new Set(rows.map((row) => row.id)).size === rows.length &&
			notes.clientsWithNotes === notes.matchesImport + notes.editedInMeadow + notes.meadowOnly,
		"Parsed entries or notes fields are not fully accounted for.",
	);
	return {
		rows,
		report: {
			survivingClients: clients.length,
			clientsWithEntries: new Set(rows.filter((row) => row.imported).map((row) => row.clientId)).size,
			parsedEntries,
			kinds,
			importedContacts: contacts,
			importedNotes,
			dropped: kinds["tcpa-dropped"] ?? 0,
			notes,
			meadowNotes: rows.filter((row) => !row.imported).length,
			rows: rows.length,
		},
	};
}

const columns =
	"id, client_id, opportunity_id, kind, channel, channel_label, direction, outcome, occurred_at, body, detail, actor_user_id, effective_user_id, client_is_actor, imported, automated, revision, fictional, created_at, updated_at";
const tuple = (row: Planned) => [
	row.id,
	row.clientId,
	row.opportunityId,
	row.kind,
	row.channel,
	row.direction,
	row.outcome,
	row.occurredAt,
	row.body,
	JSON.stringify(row.detail),
	row.actorUserId,
	row.effectiveUserId,
	row.clientIsActor,
	row.imported,
	row.automated,
];
const pick = (index: number) => `json_extract(r.value, '$[${index}]')`;
const insert = (payload: string, owner: string) =>
	`INSERT INTO activity (${columns})
SELECT ${pick(0)}, ${pick(1)}, ${pick(2)}, ${pick(3)}, ${pick(4)}, NULL, ${pick(5)}, ${pick(6)}, ${pick(7)}, ${pick(8)}, ${pick(9)}, ${pick(10)}, ${pick(11)}, ${pick(12)}, ${pick(13)}, ${pick(14)}, 1, 0, ${pick(7)}, ${pick(7)}
FROM json_each(${text(payload)}) r
WHERE ${owner} AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.id = ${pick(0)});`;

/** Inserts each row only while its client or opportunity exists and only once, so a rerun or a record deleted after preparation is harmless. */
function migrationSql(rows: Planned[], rawHash: string) {
	const statements = [
		`-- Imports BoldTrail Agent Notes from the raw export (SHA-256 ${rawHash}) and Meadow-era notes text into Activity, ${rows.length} rows.`,
		"-- Generated by scripts/client-activity-import.ts prepare; verify with its verify mode. Rows carry stable IDs and skip records deleted since preparation.",
	];
	const imported = rows.filter((row) => !row.notesGuard);
	const clientExists = `EXISTS (SELECT 1 FROM clients c WHERE c.id = ${pick(1)} AND c.fictional = 0)`;
	// D1 limits each statement to 100 KB, so the payload is split by its escaped size.
	const overhead = Buffer.byteLength(insert("[]", clientExists));
	let chunk: string[] = [];
	let size = overhead;
	const flush = () => {
		if (chunk.length) statements.push(insert(`[${chunk.join(",")}]`, clientExists));
		chunk = [];
		size = overhead;
	};
	for (const row of imported) {
		const item = JSON.stringify(tuple(row));
		const bytes = Buffer.byteLength(item.replaceAll("'", "''")) + 1;
		requireCondition(
			overhead + bytes < statementBytes,
			"One imported entry is too long for a D1 statement.",
		);
		if (size + bytes > statementBytes) flush();
		chunk.push(item);
		size += bytes;
	}
	flush();
	for (const row of rows.filter((row) => row.notesGuard)) {
		const table = row.clientId ? "clients" : "opportunities";
		const ownerId = row.clientId ? pick(1) : pick(2);
		statements.push(
			insert(
				JSON.stringify([tuple(row)]),
				`EXISTS (SELECT 1 FROM ${table} o WHERE o.id = ${ownerId} AND o.fictional = 0 AND o.notes = ${text(row.notesGuard!)})`,
			),
		);
	}
	// Fails the migration unless every surviving client holds exactly its planned imported rows.
	const perClient = new Map<string, number>();
	for (const row of imported) perClient.set(row.clientId!, (perClient.get(row.clientId!) ?? 0) + 1);
	const expected = JSON.stringify(
		[...perClient].map(([id, count]) => [Number(id.slice("import-client-".length)), count]),
	);
	statements.push(
		`INSERT INTO mutation_guards (id, passed) SELECT '${migration}:imported', CASE WHEN NOT EXISTS (SELECT 1 FROM json_each(${text(expected)}) m JOIN clients c ON c.id = 'import-client-' || json_extract(m.value, '$[0]') WHERE (SELECT count(*) FROM activity a WHERE a.client_id = c.id AND a.imported = 1 AND a.id GLOB 'import-activity-*') <> json_extract(m.value, '$[1]')) THEN 1 ELSE 0 END;`,
		`DELETE FROM mutation_guards WHERE id LIKE '${migration}:%';`,
	);
	return statements.join("\n\n") + "\n";
}

async function main() {
	const args = process.argv.slice(2).filter((arg: string) => arg !== "--");
	const sqlFlag = args.indexOf("--sql");
	const sqlPath = sqlFlag >= 0 ? args.splice(sqlFlag, 2)[1] : migrationPath;
	const [mode, input, backupFile, ...extra] = args;
	requireCondition(
		sqlPath &&
			((mode === "prepare" && input && backupFile && !extra.length) ||
				(mode === "verify" && input && !backupFile)),
		"Use prepare <raw-export> <private-backup> [--sql <path>] or verify <private-backup>.",
	);
	if (mode === "prepare") {
		requireCondition(
			isAbsolute(backupFile) && !resolve(backupFile).startsWith(`${process.cwd()}/`),
			"Keep the private backup outside the repository, as an absolute path.",
		);
		const source = await readFile(input);
		const raw = csv(source.toString("utf8"));
		requireCondition(
			raw.length && "Agent Notes" in raw[0],
			"The raw export has no Agent Notes column.",
		);
		const { state } = await snapshot();
		const { rows, report } = plan(raw, state);
		const backup: Backup = {
			databaseId,
			migration,
			rawHash: sha(source),
			preparedAt: new Date().toISOString(),
			state,
			rows,
			report,
		};
		await mkdir(dirname(backupFile), { recursive: true, mode: 0o700 });
		await writeFile(backupFile, JSON.stringify(backup), { flag: "wx", mode: 0o600 });
		await mkdir(dirname(sqlPath), { recursive: true });
		await writeFile(sqlPath, migrationSql(rows, backup.rawHash), { flag: "wx" });
		console.log(JSON.stringify({ prepared: migration, sql: sqlPath, ...report }, null, "\t"));
		return;
	}
	requireCondition(((await stat(input)).mode & 0o077) === 0, "Backup permissions must be private.");
	const backup = JSON.parse(await readFile(input, "utf8")) as Backup;
	requireCondition(
		backup.databaseId === databaseId && backup.migration === migration,
		"Backup does not belong to this migration.",
	);
	const sql = migrationSql(backup.rows, backup.rawHash);
	requireCondition((await readFile(sqlPath, "utf8")) === sql, "Reviewed SQL changed.");
	const { db, state } = await snapshot();
	const ledger = await db
		.prepare("SELECT name, hash FROM __alchemy_migrations")
		.all<{ name: string; hash: string }>();
	requireCondition(
		ledger.results.some(
			(row) => [migration, `${migration}/migration.sql`].includes(row.name) && row.hash === sha(sql),
		),
		"The reviewed migration is not recorded with its exact hash.",
	);
	const stored = new Map((state.activity ?? []).map((row) => [row.id, row]));
	const owners = {
		clients: new Map(state.clients.map((row) => [row.id, row])),
		opportunities: new Map(state.opportunities.map((row) => [row.id, row])),
	};
	const result = {
		inserted: 0,
		skippedDeleted: 0,
		skippedNotesChanged: 0,
		rowDifferences: 0,
		unexpectedRows: 0,
	};
	for (const row of backup.rows) {
		const owner = row.clientId
			? owners.clients.get(row.clientId)
			: owners.opportunities.get(row.opportunityId!);
		const actual = stored.get(row.id);
		stored.delete(row.id);
		if (!owner) {
			result.skippedDeleted++;
			if (actual) result.rowDifferences++;
			continue;
		}
		if (row.notesGuard !== undefined && owner.notes !== row.notesGuard && !actual) {
			result.skippedNotesChanged++;
			continue;
		}
		const expected = {
			id: row.id,
			client_id: row.clientId,
			opportunity_id: row.opportunityId,
			kind: row.kind,
			channel: row.channel,
			channel_label: null,
			direction: row.direction,
			outcome: row.outcome,
			occurred_at: row.occurredAt,
			body: row.body,
			detail: canonical(row.detail),
			actor_user_id: row.actorUserId,
			effective_user_id: row.effectiveUserId,
			client_is_actor: row.clientIsActor,
			imported: row.imported,
			automated: row.automated,
			revision: 1,
			fictional: 0,
			created_at: row.occurredAt,
			updated_at: row.occurredAt,
		};
		if (
			actual &&
			canonical({ ...actual, detail: canonical(JSON.parse(actual.detail)) }) === canonical(expected)
		)
			result.inserted++;
		else result.rowDifferences++;
	}
	result.unexpectedRows = [...stored.keys()].filter((id) =>
		/^(import-activity|meadow-notes)-/.test(id),
	).length;
	// Any added, removed, or changed client or opportunity row counts once on each side it differs.
	const fieldDifferences = Object.fromEntries(
		["clients", "opportunities"].map((table) => {
			const before = new Set((backup.state[table] ?? []).map(canonical));
			const after = new Set((state[table] ?? []).map(canonical));
			return [
				table,
				[...after].filter((row) => !before.has(row)).length +
					[...before].filter((row) => !after.has(row)).length,
			];
		}),
	);
	console.log(
		JSON.stringify(
			{ verified: migration, planned: backup.rows.length, ...result, fieldDifferences },
			null,
			"\t",
		),
	);
	requireCondition(
		result.rowDifferences === 0 &&
			result.unexpectedRows === 0 &&
			result.skippedNotesChanged === 0 &&
			Object.values(fieldDifferences).every((count) => count === 0),
		"Verification found differences; inspect the private backup without replaying the migration.",
	);
}

try {
	await main();
} catch (cause) {
	console.error(
		cause instanceof ImportFailure
			? cause.message
			: "Client activity preparation or verification failed. No production data was written by this helper.",
	);
	process.exitCode = 1;
}
