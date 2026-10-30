import type { DueState } from "#lib/ui/presentation.js";

// Dates are plain YYYY-MM-DD values in the business's timezone, so they compare as strings and format in UTC.
export function dueState(date: string, today: string): DueState {
	if (!date) return "undated";
	return date < today ? "overdue" : date === today ? "today" : "upcoming";
}

const dayMs = 86_400_000;
const parse = (date: string) => Date.parse(`${date}T00:00:00Z`);

export function dueLabel(date: string, today: string) {
	const days = Math.round((parse(date) - parse(today)) / dayMs);
	if (days === 0) return "Today";
	if (days === 1) return "Tomorrow";
	if (days === -1) return "Yesterday";
	const sameYear = date.slice(0, 4) === today.slice(0, 4);
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		...(sameYear ? {} : { year: "numeric" }),
		timeZone: "UTC",
	}).format(parse(date));
}
