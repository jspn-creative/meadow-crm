import type { getActivity } from "#lib/crm.remote.js";
import { historyWords, object, rows, text, type ActivityLookup } from "./describe.js";
import type { ActivityEntry, Actor, Detail } from "./types.js";

// Turns `getActivity` rows into the entries Activity renders: notes and logged contact as they are stored, and History worded for reading.

export type ActivityRow = Awaited<ReturnType<typeof getActivity>>[number];
type ContentRow = Extract<ActivityRow, { kind: "note" | "contact" }>;
export type { ActivityLookup };

const actorOf = (actor: ActivityRow["actor"]): Actor =>
	actor.kind === "user" ? { kind: "user", userId: actor.userId } : { kind: actor.kind };

/** Detail rows stored as `[{ label, value }]`. */
function details(value: unknown): Detail[] | undefined {
	const list = rows(value).flatMap((row) =>
		text(row.label) && text(row.value) ? [{ label: text(row.label), value: text(row.value) }] : [],
	);
	return list.length ? list : undefined;
}

function contentEntry(row: ContentRow): ActivityEntry {
	const base = {
		id: row.id,
		at: row.at,
		actor: actorOf(row.actor),
		imported: row.imported || undefined,
		opportunityIds: row.opportunities.length
			? row.opportunities.map((opportunity) => opportunity.id)
			: undefined,
		actingAs: row.actingAs?.userId,
		revision: row.revision,
	};
	// Only an edit raises a revision, so a later one means the text changed.
	const edited = row.revision > 1 ? row.updatedAt : undefined;
	if (row.kind === "note") {
		const event = object(row.detail.event);
		if (event)
			return {
				...base,
				kind: "event",
				summary: text(event.summary) || row.body,
				standalone: event.standalone === true || undefined,
				automation: text(event.automation) || undefined,
				emphasis: Array.isArray(event.emphasis) ? event.emphasis.map(String) : undefined,
				detail: details(row.detail.fields),
			};
		return {
			...base,
			kind: "note",
			body: row.body,
			editedAt: edited,
			title: text(row.detail.title) || undefined,
		};
	}
	return {
		...base,
		kind: "contact",
		channel: row.channel ?? "other",
		channelLabel: row.channelLabel ?? undefined,
		direction: row.direction ?? "outgoing",
		outcome: row.outcome ?? undefined,
		note: row.body || undefined,
		noteEditedAt: row.body ? edited : undefined,
		loggedBy: row.loggedBy?.userId,
		automated: row.automated || undefined,
		stop: row.detail.stop === true || undefined,
		detail: details(row.detail.fields),
	};
}

/** A record's Activity, oldest first, from its `getActivity` rows. */
export function activityEntries(source: ActivityRow[], lookup: ActivityLookup): ActivityEntry[] {
	const content = new Map<string, ActivityEntry>();
	for (const row of source) if (row.kind !== "history") content.set(row.id, contentEntry(row));
	const entries: ActivityEntry[] = [];
	for (const row of source) {
		if (row.kind !== "history") {
			entries.push(content.get(row.id)!);
			continue;
		}
		const words = historyWords(row, content, lookup);
		if (!words) continue;
		const base = {
			id: row.id,
			at: row.at,
			actor: actorOf(row.actor),
			actingAs: row.actingAs?.userId,
			opportunityIds: row.opportunities.length
				? row.opportunities.map((opportunity) => opportunity.id)
				: undefined,
		};
		if (words.imported)
			entries.push({
				...base,
				kind: "event",
				actor: { kind: "boldtrail" },
				imported: true,
				standalone: true,
				summary: words.summary!,
			});
		else entries.push({ ...base, kind: "history", summary: words.summary, changes: words.changes });
	}
	return entries;
}
