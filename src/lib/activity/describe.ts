import { userFirstName } from "#lib/data/users.js";
import { stageLabels, timelineLabels } from "#lib/pipeline/labels.js";
import { formatCalendarDate } from "#lib/registry/format.js";
import { flagChangeLabel } from "#lib/registry/flag-history.js";
import type {
	ActivityEntry,
	Actor,
	ContactEntry,
	Detail,
	EventEntry,
	FieldChange,
	HistoryEntry,
	NoteEntry,
	Outcome,
} from "./types.js";

// How Activity and Recent activity word an entry, so the same History row, note, or logged contact reads the same in both.

type Snapshot = Record<string, unknown>;
export type ActivityLookup = {
	client: (id: string) => string;
	tag: (id: string) => string;
	/** A checklist item's title, for History about it. */
	item?: (id: string) => string | undefined;
};

export const outcomeLabels: Record<Outcome, string> = {
	talked: "Talked",
	voicemail: "Left voicemail",
	"no-answer": "No answer",
	"wrong-number": "Wrong number",
	met: "Met",
	"no-show": "No-show",
	bounced: "Bounced",
};

export const actorName = (actor: Actor, client: string) =>
	actor.kind === "user"
		? userFirstName(actor.userId)
		: actor.kind === "client"
			? client
			: "BoldTrail";

/** Actor, past-tense verb, object; `tail` follows a middle dot, such as a call's outcome. */
export type Line = {
	who?: string;
	text: string;
	tail?: string;
	/** Parts of `text` worth catching the eye when scanning, such as a new value: "claimed by agent", "priya@willowmail.example". */
	em?: string[];
};

/** Splits a line's text around its emphasized parts, in order. */
export function emphasize(line: Line) {
	const parts: { text: string; em: boolean }[] = [];
	let rest = line.text;
	for (const value of line.em ?? []) {
		const at = value ? rest.indexOf(value) : -1;
		if (at < 0) continue;
		if (at) parts.push({ text: rest.slice(0, at), em: false });
		parts.push({ text: value, em: true });
		rest = rest.slice(at + value.length);
	}
	if (rest) parts.push({ text: rest, em: false });
	return parts;
}

export function describeContact(entry: ContactEntry, client: string): Line {
	const who = actorName(entry.actor, client);
	const outgoing = entry.direction === "outgoing";
	const tail = entry.outcome ? outcomeLabels[entry.outcome] : undefined;
	if (entry.stop) return { who, text: "replied STOP", tail: "texting turned off" };
	switch (entry.channel) {
		case "call":
			return { who, text: outgoing ? `called ${client}` : "called", tail };
		case "text":
			return { who, text: outgoing ? `texted ${client}` : "texted", tail };
		case "email":
			return { who, text: outgoing ? `emailed ${client}` : "emailed", tail };
		case "meeting":
			return entry.outcome === "no-show"
				? { who, text: outgoing ? `planned to meet ${client}` : "missed a meeting", tail }
				: {
						who,
						text: outgoing
							? `met with ${client}`
							: `met with ${entry.loggedBy ? userFirstName(entry.loggedBy) : "the business"}`,
						tail,
					};
		case "zillow":
			return { who, text: "sent a Zillow inquiry" };
		case "other":
			return {
				who,
				text: outgoing ? `reached out to ${client}` : "reached out",
				tail: entry.channelLabel,
			};
	}
}

/** A short noun for Last contacted and delete confirmations: "Call", "Open house". */
export function channelNoun(entry: ContactEntry) {
	if (entry.channel === "other") return entry.channelLabel || "Other";
	if (entry.channel === "zillow") return "Zillow inquiry";
	return entry.channel[0]!.toUpperCase() + entry.channel.slice(1);
}

/** A note's line: who added it, or its title when nobody knows who wrote it, such as an old notes field. */
export function describeNote(entry: NoteEntry, client: string): Line {
	return entry.title
		? { text: entry.title, em: [entry.title] }
		: { who: actorName(entry.actor, client), text: "added a note" };
}

/** An imported event's line; a standalone summary is a whole sentence with no actor in front. */
export function describeEvent(entry: EventEntry, client: string): Line {
	return {
		who: entry.standalone ? undefined : actorName(entry.actor, client),
		text: entry.summary,
		em: entry.emphasis,
	};
}

export const capital = (value: string) => value[0]!.toUpperCase() + value.slice(1);
const list = (values: string[]) =>
	values.length < 2 ? values.join("") : `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;

function describeChange({ field, before, after }: FieldChange) {
	if (!before) return `set the ${field} to ${after}`;
	if (!after) return `cleared the ${field}`;
	return `changed the ${field} from ${before} to ${after}`;
}

// Consecutive saves by one person, each within five minutes of the last, read as one edit.
const groupWindow = 5 * 60_000;

export const sameActor = (a: Actor, b: Actor) =>
	a.kind === b.kind && (a.kind !== "user" || (b.kind === "user" && a.userId === b.userId));

/** Whether a save joins the edit `previous` belongs to: same person, same subject, within the window. */
export const joinsEdit = (previous: HistoryEntry, entry: HistoryEntry) =>
	sameActor(previous.actor, entry.actor) &&
	(previous.opportunityIds?.join() ?? "") === (entry.opportunityIds?.join() ?? "") &&
	Date.parse(entry.at) - Date.parse(previous.at) <= groupWindow;

const methodLabels: Record<string, string> = {
	call: "Call",
	text: "Text",
	email: "Email",
	mail: "Mail",
};
const consentFields = [
	["consentCall", "call"],
	["consentText", "text"],
	["consentEmail", "email"],
	["consentMail", "mail"],
] as const;
const money = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});

export const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
export const rows = (value: unknown) => (Array.isArray(value) ? (value as Snapshot[]) : []);
export const object = (value: unknown) =>
	value && typeof value === "object" && !Array.isArray(value) ? (value as Snapshot) : undefined;
const names = (value: unknown, key: string) =>
	rows(value)
		.map((row) => text(row[key]))
		.filter(Boolean);
const sameSet = (a: string[], b: string[]) =>
	a.length === b.length && a.every((value) => b.includes(value));

/** Field-by-field differences of one save, keeping only fields the save sent. */
function differences(before: Snapshot, after: Snapshot) {
	const changes: FieldChange[] = [];
	return {
		changes,
		scalar(field: string, key: string, label = (value: unknown) => text(value)) {
			if (!(key in after)) return;
			const [from, to] = [label(before[key]), label(after[key])];
			if (from !== to) changes.push({ field, before: from, after: to });
		},
		list(field: string, from: string[], to: string[]) {
			if (!sameSet(from, to)) changes.push({ field, before: from.join(", "), after: to.join(", ") });
		},
	};
}

function clientChanges(before: Snapshot, after: Snapshot, lookup: ActivityLookup) {
	const { changes, scalar, list } = differences(before, after);
	scalar("name", "name");
	scalar("lead source", "leadSource");
	scalar(
		"preferred contact method",
		"preferredContactMethod",
		(value) => methodLabels[text(value)] ?? "",
	);
	const referrer = (snapshot: Snapshot) =>
		snapshot.referredByClientId
			? lookup.client(String(snapshot.referredByClientId))
			: text(snapshot.referredByName);
	if (referrer(before) !== referrer(after))
		changes.push({ field: "referrer", before: referrer(before), after: referrer(after) });
	scalar("preferences", "preferences");
	scalar("notes", "notes");
	const allowed = (snapshot: Snapshot) =>
		consentFields.filter(([key]) => snapshot[key] !== false).map(([, label]) => label);
	if (!sameSet(allowed(before), allowed(after)))
		changes.push({
			field: "consent",
			before: allowed(before).join(", ") || "None",
			after: allowed(after).join(", ") || "None",
		});
	if (Boolean(before.flagged) !== Boolean(after.flagged))
		changes.push({
			field: "flag",
			before: before.flagged ? "Flagged for review" : "Not flagged",
			after: after.flagged ? "Flagged for review" : "Not flagged",
		});
	else if (after.flagged) scalar("flag note", "flagNote");
	if ("people" in after) list("people", names(before.people, "name"), names(after.people, "name"));
	if ("addresses" in after)
		list("addresses", names(before.addresses, "address"), names(after.addresses, "address"));
	const keyDate = (row: Snapshot) =>
		`${text(row.name)}${row.date ? ` (${formatCalendarDate(String(row.date))})` : ""}`;
	if ("keyDates" in after)
		list("key dates", rows(before.keyDates).map(keyDate), rows(after.keyDates).map(keyDate));
	const relationship = (row: Snapshot) =>
		`${text(row.label)}: ${lookup.client(String(row.relatedClientId))}`;
	if ("relationships" in after)
		list(
			"relationships",
			rows(before.relationships).map(relationship),
			rows(after.relationships).map(relationship),
		);
	const tags = (value: unknown) =>
		Array.isArray(value) ? value.map((id) => lookup.tag(String(id))) : [];
	if ("tagIds" in after) list("tags", tags(before.tagIds), tags(after.tagIds));
	return changes;
}

function opportunityChanges(before: Snapshot, after: Snapshot, lookup: ActivityLookup) {
	const { changes, scalar, list } = differences(before, after);
	scalar("title", "title");
	scalar(
		"timeline",
		"timeline",
		(value) => timelineLabels[text(value) as keyof typeof timelineLabels] ?? "",
	);
	scalar("property address", "address");
	scalar("budget", "budgetCents", (value) =>
		typeof value === "number" ? money.format(value / 100) : "",
	);
	scalar("notes", "notes");
	const clients = (value: unknown) =>
		Array.isArray(value) ? value.map((id) => lookup.client(String(id))) : [];
	if ("clientIds" in after) list("clients", clients(before.clientIds), clients(after.clientIds));
	if ("references" in after)
		list("references", names(before.references, "label"), names(after.references, "label"));
	return changes;
}

/** What a History row says after its actor, or field changes to collapse; null when Activity shows the entry itself instead. */
export function historyWords(
	row: { recordKind: string; action: string; data: unknown },
	content: Map<string, ActivityEntry>,
	lookup: ActivityLookup,
): { summary?: string; changes?: FieldChange[]; imported?: true } | null {
	const data = row.data as Snapshot;
	const before = object(data.before) ?? {};
	const after = object(data.after) ?? {};
	switch (row.action) {
		// Posting and logging appear as the note or contact itself.
		case "post-note":
		case "log-contact":
			return null;
		case "edit-activity-note": {
			const entry = content.get(text(data.activityId));
			if (data.kind === "note") return { summary: "edited a note" };
			const noun =
				entry?.kind === "contact" ? `logged ${channelNoun(entry).toLowerCase()}` : "logged contact";
			const [from, to] = [text(data.before), text(data.after)];
			return {
				summary: `${!from ? "added a note to" : to ? "edited the note on" : "removed the note from"} a ${noun}`,
			};
		}
		case "delete-activity": {
			if (data.kind === "note") return { summary: "deleted a note" };
			const channel = text(before.channel) as ContactEntry["channel"];
			return {
				summary: `deleted a logged ${channel ? channelNoun({ channel, channelLabel: text(before.channelLabel) } as ContactEntry).toLowerCase() : "contact"}`,
			};
		}
	}
	// Tasks have no Activity of their own; Recent activity words their History here.
	if (row.recordKind === "task")
		switch (row.action) {
			case "create":
				return { summary: "created the task" };
			case "complete":
				return { summary: "completed the task" };
			case "reopen":
				return { summary: "reopened the task" };
			case "delete":
				return { summary: "deleted the task" };
			default:
				return { summary: "edited the task" };
		}
	if (row.recordKind === "client")
		switch (row.action) {
			case "create":
				return data.source === "import"
					? { summary: "Imported from BoldTrail", imported: true }
					: { summary: "added the client" };
			case "edit": {
				const changes = clientChanges(before, after, lookup);
				// Flagging or clearing reads better in the flag's own words; a note edit keeps its before and after.
				const flag = flagChangeLabel(row.action, data);
				if (flag && changes.length === 1 && changes[0]!.field === "flag") return { summary: flag };
				return changes.length ? { changes } : null;
			}
			case "archive":
				return { summary: "archived the client" };
			case "restore":
				return { summary: "restored the client" };
			case "tag":
			case "untag": {
				const name = text(data.tagName) || (data.tagId ? lookup.tag(String(data.tagId)) : "a");
				return { summary: row.action === "tag" ? `added the ${name} tag` : `removed the ${name} tag` };
			}
			default:
				return { summary: flagChangeLabel(row.action, data) ?? row.action.replaceAll("-", " ") };
		}
	switch (row.action) {
		case "create":
			return { summary: "created the opportunity" };
		case "edit": {
			const changes = opportunityChanges(before, after, lookup);
			return changes.length ? { changes } : null;
		}
		case "move-stage":
			return {
				summary: `moved it to ${stageLabels[data.stage as keyof typeof stageLabels] ?? "another stage"}`,
			};
		case "archive":
			return { summary: "archived the opportunity" };
		case "restore":
			return { summary: "restored the opportunity" };
		case "pin":
			return { summary: "pinned it to the top of its stage" };
		case "unpin":
			return { summary: "unpinned it" };
		case "save-checklist-step": {
			const title = lookup.item?.(text(data.itemId));
			const subject = title ? `“${title}”` : "a checklist item";
			return { summary: data.completed ? `checked off ${subject}` : `updated ${subject}` };
		}
		case "add-checklist-item":
			return {
				summary: text(data.title)
					? `added “${text(data.title)}” to the checklist`
					: "added a checklist item",
			};
		default:
			return { summary: row.action.replaceAll("-", " ") };
	}
}

/** One History row from consecutive saves that read as one edit: a summary, or the net change of each field. Null when every field ended where it started. */
export function describeHistory(
	saves: HistoryEntry[],
	client: string,
	dates: { clock: (value: string) => string },
): { id: string; at: string; actor: Actor; line: Line; detail?: Detail[] } | null {
	const first = saves[0]!;
	const last = saves.at(-1)!;
	const who = actorName(first.actor, client);
	const tail = first.actingAs ? `acting as ${userFirstName(first.actingAs)}` : undefined;
	if (first.summary)
		return {
			id: first.id,
			at: first.at,
			actor: first.actor,
			line: { who, text: first.summary, tail },
		};
	const net = new Map<string, FieldChange>();
	for (const change of saves.flatMap((save) => save.changes ?? [])) {
		const seen = net.get(change.field);
		net.set(change.field, seen ? { ...seen, after: change.after } : { ...change });
	}
	const kept = [...net.values()].filter((change) => change.before !== change.after);
	// A field that ends where it started drops out; an edit with nothing left never happened as far as the reader cares.
	if (!kept.length) return null;
	const detail: Detail[] = [];
	// Values too long for a sentence, such as a note or preferences, move into the details.
	const long = kept.length === 1 && kept[0]!.before.length + kept[0]!.after.length > 60;
	if (kept.length > 1 || saves.length > 1 || long) {
		for (const change of kept)
			detail.push({
				label: capital(change.field),
				value: `${change.before || "Not set"} → ${change.after || "Not set"}`,
			});
		if (saves.length > 1)
			detail.push({
				label: "Saves",
				value: `${saves.length}, ${dates.clock(first.at)} to ${dates.clock(last.at)}`,
			});
	}
	const only = kept.length === 1 ? kept[0]! : undefined;
	const text =
		only && !long
			? describeChange(only)
			: only && !only.before
				? `set the ${only.field}`
				: only && !only.after
					? `cleared the ${only.field}`
					: `changed the ${list(kept.map((change) => change.field))}`;
	const em = only && !long ? [only.before, only.after].filter(Boolean) : undefined;
	return {
		id: first.id,
		at: last.at,
		actor: first.actor,
		line: { who, text, tail, em },
		detail: detail.length ? detail : undefined,
	};
}
