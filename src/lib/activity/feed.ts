import {
	actorName,
	capital,
	describeContact,
	describeEvent,
	describeHistory,
	joinsEdit,
	outcomeLabels,
	sameActor,
	type Line,
} from "./describe.js";
import type {
	ActivityEntry,
	Actor,
	ContactEntry,
	Detail,
	EventEntry,
	HistoryEntry,
	NoteEntry,
} from "./types.js";

// Presentation only: every entry stays its own row in storage. This turns the merged, oldest-first list into what Activity shows, collapsing automation into runs and back-and-forth History saves into one net change.

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
		line: describeEvent(entry, client),
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

function historyRow(
	saves: HistoryEntry[],
	client: string,
	dates: ReturnType<typeof activityDates>,
): FeedRow | null {
	const row = describeHistory(saves, client, dates);
	return row && { type: "quiet", icon: "history", ...row };
}

/** When Meadow started holding the business's data: the client import of 2026-10-30. Activity's Meadow era starts here rather than at its first entry. */
export const meadowStarted = "2026-10-30T12:00:00-07:00";

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
						: `In Meadow · since ${dates.day(options.meadowSince ?? meadowStarted)}`,
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
			if (!previous || !joinsEdit(previous, entry)) flush();
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
