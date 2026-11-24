import type { Workspace } from "#lib/data/workspace.js";
import { formatCalendarDate } from "#lib/registry/format.js";
import { flagChangeLabel } from "#lib/registry/flag-history.js";
import type { ActivityEntry, Actor, FieldChange } from "./types.js";

// Interim: until notes and logged contact are stored as entries, a saved client's Activity is its History plus the old notes field, read-only. Nothing here writes.

type Change = Workspace["history"][number];
type Snapshot = Record<string, unknown>;

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

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const rows = (value: unknown) => (Array.isArray(value) ? (value as Snapshot[]) : []);
const names = (value: unknown, key: string) =>
	rows(value)
		.map((row) => text(row[key]))
		.filter(Boolean);
const sameSet = (a: string[], b: string[]) =>
	a.length === b.length && a.every((value) => b.includes(value));

/** Field-by-field differences of one client save, worded for Activity. */
function editChanges(
	before: Snapshot,
	after: Snapshot,
	lookup: { client: (id: string) => string; tag: (id: string) => string },
): FieldChange[] {
	const changes: FieldChange[] = [];
	const scalar = (field: string, key: string, label = (value: unknown) => text(value)) => {
		if (!(key in after)) return;
		const [from, to] = [label(before[key]), label(after[key])];
		if (from !== to) changes.push({ field, before: from, after: to });
	};
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
	const listChange = (field: string, from: string[], to: string[]) => {
		if (!sameSet(from, to)) changes.push({ field, before: from.join(", "), after: to.join(", ") });
	};
	listChange("people", names(before.people, "name"), names(after.people, "name"));
	listChange("addresses", names(before.addresses, "address"), names(after.addresses, "address"));
	listChange(
		"key dates",
		rows(before.keyDates).map(
			(row) => `${text(row.name)}${row.date ? ` (${formatCalendarDate(String(row.date))})` : ""}`,
		),
		rows(after.keyDates).map(
			(row) => `${text(row.name)}${row.date ? ` (${formatCalendarDate(String(row.date))})` : ""}`,
		),
	);
	listChange(
		"relationships",
		rows(before.relationships).map(
			(row) => `${text(row.label)}: ${lookup.client(String(row.relatedClientId))}`,
		),
		rows(after.relationships).map(
			(row) => `${text(row.label)}: ${lookup.client(String(row.relatedClientId))}`,
		),
	);
	const tags = (value: unknown) =>
		Array.isArray(value) ? value.map((id) => lookup.tag(String(id))) : [];
	if ("tagIds" in after) listChange("tags", tags(before.tagIds), tags(after.tagIds));
	return changes;
}

/** A saved client's History, oldest first, plus its notes field as one note. */
export function savedActivity(
	client: { id: string; notes: string; createdAt: string },
	changes: Change[],
	lookup: { client: (id: string) => string; tag: (id: string) => string },
): ActivityEntry[] {
	const entries: ActivityEntry[] = [];
	const sorted = changes
		.filter((change) => change.recordKind === "client" && change.recordId === client.id)
		.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
	let imported = false;
	let notesAt: { at: string; actor: Actor } | undefined;
	for (const change of sorted) {
		const data = change.data as Snapshot;
		const actor: Actor = { kind: "user", userId: change.actorUserId };
		const base = {
			id: change.id,
			at: change.createdAt,
			actor,
			actingAs: change.actorUserId === change.effectiveUserId ? undefined : change.effectiveUserId,
		};
		switch (change.action) {
			case "create":
				if (data.source === "import") {
					imported = true;
					entries.push({
						...base,
						kind: "event",
						actor: { kind: "boldtrail" },
						imported: true,
						standalone: true,
						summary: "Imported from BoldTrail",
					});
				} else {
					notesAt = { at: change.createdAt, actor };
					entries.push({ ...base, kind: "history", summary: "added the client" });
				}
				break;
			case "edit": {
				const before = (data.before ?? {}) as Snapshot;
				const after = (data.after ?? {}) as Snapshot;
				const fieldChanges = editChanges(before, after, lookup);
				if (text(before.notes) !== text(after.notes) && text(after.notes))
					notesAt = { at: change.createdAt, actor };
				// Flagging or clearing reads better in the flag's own words; a note edit keeps its before and after.
				const flagLabel = flagChangeLabel(change.action, change.data);
				if (flagLabel && fieldChanges.length === 1 && fieldChanges[0]!.field === "flag")
					entries.push({ ...base, kind: "history", summary: flagLabel });
				else if (fieldChanges.length) entries.push({ ...base, kind: "history", changes: fieldChanges });
				break;
			}
			case "archive":
				entries.push({ ...base, kind: "history", summary: "archived the client" });
				break;
			case "restore":
				entries.push({ ...base, kind: "history", summary: "restored the client" });
				break;
			case "tag":
			case "untag": {
				const name = text(data.tagName) || (data.tagId ? lookup.tag(String(data.tagId)) : "a");
				entries.push({
					...base,
					kind: "history",
					summary: change.action === "tag" ? `added the ${name} tag` : `removed the ${name} tag`,
				});
				break;
			}
			default:
				entries.push({
					...base,
					kind: "history",
					summary: flagChangeLabel(change.action, change.data) ?? change.action.replaceAll("-", " "),
				});
		}
	}
	const notes = client.notes.trim();
	// Imported notes are BoldTrail's text, written when the client arrived; otherwise the note dates from the save that last wrote it.
	if (notes)
		entries.push({
			id: `${client.id}-notes`,
			kind: "note",
			at: notesAt?.at ?? client.createdAt,
			actor: notesAt?.actor ?? { kind: "boldtrail" },
			imported: !notesAt && imported,
			title: notesAt || imported ? undefined : "Notes, author not recorded",
			body: notes,
		});
	return entries;
}
