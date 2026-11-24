import { userFirstName } from "#lib/data/users.js";
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

// Presentation only: every entry stays its own row in storage. This turns the merged, oldest-first list into what Activity shows, collapsing automation into runs and back-and-forth History saves into one net change.

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

/** ACT-9: a call that talked, a meeting that happened, any incoming contact, or a sent text or email that didn't bounce. */
export function reached(entry: ContactEntry) {
	if (entry.direction === "incoming") return true;
	if (entry.channel === "call") return entry.outcome === "talked";
	if (entry.channel === "meeting") return entry.outcome === "met";
	if (entry.channel === "text" || entry.channel === "email") return entry.outcome !== "bounced";
	return false;
}

/** Last contacted and the latest attempt, from entries sorted oldest first. */
export function contactSummary(entries: ActivityEntry[]) {
	const contacts = entries.filter((entry) => entry.kind === "contact");
	return {
		lastContacted: contacts.findLast(reached),
		latestAttempt: contacts.findLast((entry) => entry.direction === "outgoing"),
	};
}

export type QuietIcon = "history" | "automation" | "report" | "status" | "added" | "call" | "text";

export type FeedRow =
	| { type: "era"; id: string; era: "boldtrail" | "meadow"; label: string }
	| { type: "contact"; id: string; entry: ContactEntry }
	| { type: "note"; id: string; entry: NoteEntry }
	| {
			type: "quiet";
			id: string;
			at: string;
			actor: Actor;
			icon: QuietIcon;
			line: Line;
			quote?: string;
			detail?: Detail[];
	  }
	| {
			type: "run";
			id: string;
			from: string;
			to: string;
			actor: Actor;
			icon: QuietIcon;
			line: Line;
			items: { id: string; at: string; text: string; detail?: Detail[] }[];
	  };

export type Feed = { rows: FeedRow[]; total: number; hidden: number };

/** Dates read in the business's timezone. */
export function activityDates(timeZone: string) {
	const parts = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat("en-US", { timeZone, ...options });
	const day = parts({ month: "short", day: "numeric" });
	const dayYear = parts({ month: "short", day: "numeric", year: "numeric" });
	const month = parts({ month: "short" });
	const monthYear = parts({ month: "short", year: "numeric" });
	const year = parts({ year: "numeric" });
	const clock = parts({ hour: "numeric", minute: "2-digit" });
	const full = parts({ dateStyle: "medium", timeStyle: "short" });
	const key = parts({ year: "numeric", month: "2-digit", day: "2-digit" });
	const date = (value: string) => new Date(value);
	// Calendar days apart in the business's timezone, so "yesterday" never depends on the hour.
	const dayNumber = (value: Date) =>
		Date.parse(`${key.format(value).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2")}T00:00:00Z`) /
		86_400_000;
	return {
		/** "Nov 3" this year, "Nov 14, 2024" before it, and the time alone today. */
		short(value: string, now = new Date()) {
			const at = date(value);
			if (dayNumber(at) === dayNumber(now)) return clock.format(at);
			return year.format(at) === year.format(now) ? day.format(at) : dayYear.format(at);
		},
		day: (value: string) => dayYear.format(date(value)),
		full: (value: string) => full.format(date(value)),
		clock: (value: string) => clock.format(date(value)),
		monthYear: (value: string) => monthYear.format(date(value)),
		/** "Dec 2024", "Apr – Dec 2025", or "Dec 2024 – Feb 2025". */
		range(from: string, to: string) {
			const [start, end] = [date(from), date(to)];
			if (monthYear.format(start) === monthYear.format(end)) return monthYear.format(start);
			return year.format(start) === year.format(end)
				? `${month.format(start)} – ${monthYear.format(end)}`
				: `${monthYear.format(start)} – ${monthYear.format(end)}`;
		},
		/** "today", "yesterday", "3 days ago", "5 weeks ago", "7 months ago". */
		ago(value: string, now = new Date()) {
			const days = Math.max(0, dayNumber(now) - dayNumber(date(value)));
			if (days === 0) return "today";
			if (days === 1) return "yesterday";
			if (days < 14) return `${days} days ago`;
			if (days < 60) return `${Math.round(days / 7)} weeks ago`;
			if (days < 730) return `${Math.round(days / 30)} months ago`;
			return `${Math.round(days / 365)} years ago`;
		},
	};
}

const capital = (value: string) => value[0]!.toUpperCase() + value.slice(1);
const list = (values: string[]) =>
	values.length < 2 ? values.join("") : `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;

function describeChange({ field, before, after }: FieldChange) {
	if (!before) return `set the ${field} to ${after}`;
	if (!after) return `cleared the ${field}`;
	return `changed the ${field} from ${before} to ${after}`;
}

// Consecutive saves by one person, each within five minutes of the last, read as one edit.
const groupWindow = 5 * 60_000;

function historyRow(
	saves: HistoryEntry[],
	client: string,
	dates: ReturnType<typeof activityDates>,
): FeedRow | null {
	const first = saves[0]!;
	const last = saves.at(-1)!;
	const who = actorName(first.actor, client);
	const tail = first.actingAs ? `acting as ${userFirstName(first.actingAs)}` : undefined;
	if (first.summary)
		return {
			type: "quiet",
			id: first.id,
			at: first.at,
			actor: first.actor,
			icon: "history",
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
		type: "quiet",
		id: first.id,
		at: last.at,
		actor: first.actor,
		icon: "history",
		line: { who, text, tail, em },
		detail: detail.length ? detail : undefined,
	};
}

/** What a run of automation collapses under. Two-way contact, notes, and anything a person did never collapse. */
function automationKey(entry: ActivityEntry) {
	if (
		entry.kind === "contact" &&
		entry.automated &&
		entry.direction === "outgoing" &&
		!entry.stop &&
		!(entry.channel === "call" && entry.outcome === "talked") &&
		!(entry.channel === "meeting" && entry.outcome === "met")
	)
		return `contact:${entry.channel}`;
	if (entry.kind === "event" && entry.automation) return `event:${entry.automation}`;
	return null;
}

const eventRuns: Record<string, (count: number) => string> = {
	"market-report": (count) => `sent ${count} market reports`,
	status: (count) => `updated the follow-up status ${count} times`,
};

function eventRow(entry: EventEntry, client: string): FeedRow {
	const icon =
		entry.automation === "market-report" ? "report" : entry.standalone ? "added" : "status";
	return {
		type: "quiet",
		id: entry.id,
		at: entry.at,
		actor: entry.actor,
		icon,
		line: {
			who: entry.standalone ? undefined : actorName(entry.actor, client),
			text: entry.summary,
			em: entry.emphasis,
		},
		detail: entry.detail,
	};
}

function automationRows(group: ActivityEntry[], client: string): FeedRow {
	const first = group[0]!;
	const who = actorName(first.actor, client);
	if (first.kind === "event") {
		if (group.length === 1) return eventRow(first, client);
		const area = first.detail?.find((detail) => detail.label === "Area")?.value;
		const text =
			eventRuns[first.automation ?? ""]?.(group.length) ?? `${first.summary} ${group.length} times`;
		return {
			type: "run",
			id: first.id,
			from: first.at,
			to: group.at(-1)!.at,
			actor: first.actor,
			icon: first.automation === "market-report" ? "report" : "status",
			line: { who, text, tail: area, em: [text.match(/\d+ [a-z ]+/)?.[0] ?? ""] },
			items: group.map((entry) => ({
				id: entry.id,
				at: entry.at,
				text: capital((entry as EventEntry).summary),
				detail: (entry as EventEntry).detail,
			})),
		};
	}
	const contacts = group as ContactEntry[];
	const call = contacts[0]!.channel === "call";
	if (group.length === 1) {
		const entry = contacts[0]!;
		return {
			type: "quiet",
			id: entry.id,
			at: entry.at,
			actor: entry.actor,
			icon: call ? "call" : "automation",
			line: call
				? describeContact(entry, client)
				: { who, text: `sent an automated ${entry.channel}` },
			quote: entry.note,
		};
	}
	const line: Line = call
		? {
				who,
				text: `called ${client} ${group.length} times`,
				tail: contacts.every((entry) => entry.outcome === "no-answer")
					? "no answer"
					: "no conversation",
				em: [`${group.length} times`],
			}
		: {
				who,
				text: `sent ${group.length} automated ${contacts[0]!.channel}s`,
				tail: "no reply",
				em: [`${group.length} automated ${contacts[0]!.channel}s`],
			};
	return {
		type: "run",
		id: first.id,
		from: first.at,
		to: group.at(-1)!.at,
		actor: first.actor,
		icon: call ? "call" : "automation",
		line,
		items: contacts.map((entry) => ({
			id: entry.id,
			at: entry.at,
			text: entry.note ? `“${entry.note}”` : entry.outcome ? outcomeLabels[entry.outcome] : "Sent",
			detail: entry.detail,
		})),
	};
}

export function buildFeed(
	entries: ActivityEntry[],
	options: { client: string; timeZone: string; meadowSince?: string },
): Feed {
	const dates = activityDates(options.timeZone);
	const sorted = entries.toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at));
	const imported = sorted.filter((entry) => entry.imported);
	const rows: FeedRow[] = [];
	let hidden = 0;
	let era: "boldtrail" | "meadow" | null = null;
	// Only consecutive automation of the same kind and actor collapses, preserving chronology and every reply boundary.
	let stretch: ActivityEntry[] = [];
	const sameActor = (a: Actor, b: Actor) =>
		a.kind === b.kind && (a.kind !== "user" || (b.kind === "user" && a.userId === b.userId));
	let saves: HistoryEntry[] = [];
	const about = (entry: ActivityEntry) => entry.opportunityIds?.join() ?? "";
	const flush = () => {
		if (stretch.length) rows.push(automationRows(stretch, options.client));
		stretch = [];
		if (saves.length) {
			const row = historyRow(saves, options.client, dates);
			if (row) rows.push(row);
			else hidden += saves.length;
			saves = [];
		}
	};
	for (const entry of sorted) {
		const entryEra = entry.imported ? "boldtrail" : "meadow";
		if (imported.length && entryEra !== era) {
			flush();
			era = entryEra;
			rows.push({
				type: "era",
				id: `era-${era}-${entry.id}`,
				era,
				label:
					era === "boldtrail"
						? `From BoldTrail · ${dates.range(imported[0]!.at, imported.at(-1)!.at)}`
						: `In Meadow · since ${dates.day(options.meadowSince ?? entry.at)}`,
			});
		}
		const key = automationKey(entry);
		if (key) {
			const previous = stretch.at(-1);
			if (
				saves.length ||
				(previous &&
					(automationKey(previous) !== key ||
						!sameActor(previous.actor, entry.actor) ||
						about(previous) !== about(entry)))
			)
				flush();
			stretch.push(entry);
			continue;
		}
		if (entry.kind === "history" && entry.changes) {
			const previous = saves.at(-1);
			const joins =
				previous &&
				sameActor(previous.actor, entry.actor) &&
				about(previous) === about(entry) &&
				Date.parse(entry.at) - Date.parse(previous.at) <= groupWindow;
			if (!joins) flush();
			saves.push(entry);
			continue;
		}
		flush();
		if (entry.kind === "contact") rows.push({ type: "contact", id: entry.id, entry });
		else if (entry.kind === "note") rows.push({ type: "note", id: entry.id, entry });
		else if (entry.kind === "history") rows.push(historyRow([entry], options.client, dates)!);
		else rows.push(eventRow(entry, options.client));
	}
	flush();
	return { rows, total: sorted.length, hidden };
}
