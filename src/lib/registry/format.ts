/** North American numbers read as (503) 555-0123; anything else shows as entered. */
export function formatPhone(value: string) {
	const digits = value.replace(/\D/g, "");
	const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
	return local.length === 10
		? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
		: value;
}

const calendarFormat = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

/** A stored calendar date (YYYY-MM-DD) as "Mar 4, 1980", read in UTC so it never shifts a day. */
export function formatCalendarDate(value: string) {
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isNaN(date.getTime()) ? value : calendarFormat.format(date);
}

/** Preferences is free text. Its lines, or failing that its sentences, read as a list. */
export function preferenceItems(value: string) {
	const lines = value
		.split(/\n+/)
		.map((line) => line.replace(/^\s*[-•*]\s+/, "").trim())
		.filter(Boolean);
	// A title such as "Dr." does not end a sentence.
	return lines.length === 1
		? lines[0]!.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr)\.)(?<=[.!?])\s+(?=[A-Z0-9"“])/)
		: lines;
}
