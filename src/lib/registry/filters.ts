import { CalendarPlus, Handshake, Layers, ShieldCheck, UserRoundPlus } from "@lucide/svelte";

// The Registry's filter builder fields. Tags and lead source have their own faceted filters; these cover the rest. Each lives in the URL as `field=op:value[:value]`, and a filter still missing its value stays visible but is not sent to the server.

export const channels = ["call", "text", "email", "mail"] as const;
export type Channel = (typeof channels)[number];
export const channelLabels: Record<Channel, string> = {
	call: "Call",
	text: "Text",
	email: "Email",
	mail: "Mail",
};

type CountOp = "eq" | "gte" | "lte" | "between";
export type BuilderFilter =
	| { field: "opportunities" | "allOpportunities"; op: CountOp; a: number | null; b: number | null }
	| { field: "consent"; op: "allows" | "blocks"; channels: Channel[] }
	| { field: "referredBy"; op: "set" | "empty" | "contains"; text: string }
	| { field: "created"; op: "onOrAfter" | "onOrBefore" | "between"; a: string; b: string };
export type BuilderField = BuilderFilter["field"];

const countOperators = [
	{ value: "gte", label: "at least" },
	{ value: "lte", label: "at most" },
	{ value: "eq", label: "exactly" },
	{ value: "between", label: "between" },
];

export const builderFields = [
	{
		field: "opportunities",
		label: "Current opportunities",
		short: "Opportunities",
		icon: Handshake,
		operators: countOperators,
		hint: "Not counting archived ones",
	},
	{
		field: "allOpportunities",
		label: "All opportunities",
		short: "All opportunities",
		icon: Layers,
		operators: countOperators,
		hint: "Archived ones included",
	},
	{
		field: "consent",
		label: "Consent",
		short: "Consent",
		icon: ShieldCheck,
		operators: [
			{ value: "allows", label: "allows" },
			{ value: "blocks", label: "does not allow" },
		],
		hint: "Call, text, email, or mail",
	},
	{
		field: "referredBy",
		label: "Referred by",
		short: "Referred by",
		icon: UserRoundPlus,
		operators: [
			{ value: "set", label: "is anyone" },
			{ value: "empty", label: "is no one" },
			{ value: "contains", label: "contains" },
		],
		hint: "A client or a typed name",
	},
	{
		field: "created",
		label: "Created",
		short: "Created",
		icon: CalendarPlus,
		operators: [
			{ value: "onOrAfter", label: "on or after" },
			{ value: "onOrBefore", label: "on or before" },
			{ value: "between", label: "between" },
		],
		hint: "When the client was added",
	},
] as const satisfies readonly {
	field: BuilderField;
	label: string;
	short: string;
	icon: unknown;
	operators: readonly { value: string; label: string }[];
	hint: string;
}[];

export const builderField = (field: BuilderField) =>
	builderFields.find((item) => item.field === field)!;

const count = (value: string | undefined) => {
	const parsed = Number(value);
	return value !== undefined &&
		value !== "" &&
		Number.isInteger(parsed) &&
		parsed >= 0 &&
		parsed <= 1000
		? parsed
		: null;
};
const date = (value: string | undefined) => {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
	const parsed = new Date(`${value}T00:00:00Z`);
	return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
		? value
		: "";
};

/** A fresh filter, with a value when there is a sensible one so it applies at once. */
export function newFilter(field: BuilderField): BuilderFilter {
	switch (field) {
		case "opportunities":
		case "allOpportunities":
			return { field, op: "gte", a: 1, b: null };
		case "consent":
			return { field, op: "allows", channels: [] };
		case "referredBy":
			return { field, op: "set", text: "" };
		case "created":
			return { field, op: "onOrAfter", a: "", b: "" };
	}
}

/** Reads one field's URL value; anything malformed falls back to no filter. */
export function parseFilter(field: BuilderField, raw: string | null): BuilderFilter | null {
	if (raw === null) return null;
	const [op = "", ...rest] = raw.split(":");
	const definition = builderField(field);
	if (!definition.operators.some((item) => item.value === op)) return null;
	switch (field) {
		case "opportunities":
		case "allOpportunities":
			return { field, op: op as CountOp, a: count(rest[0]), b: count(rest[1]) };
		case "consent":
			return {
				field,
				op: op as "allows" | "blocks",
				channels: channels.filter((channel) => rest.includes(channel)),
			};
		case "referredBy":
			return { field, op: op as "set" | "empty" | "contains", text: rest.join(":").slice(0, 200) };
		case "created":
			return {
				field,
				op: op as "onOrAfter" | "onOrBefore" | "between",
				a: date(rest[0]),
				b: date(rest[1]),
			};
	}
}

export function serializeFilter(filter: BuilderFilter): string {
	switch (filter.field) {
		case "opportunities":
		case "allOpportunities":
			return [filter.op, filter.a ?? "", ...(filter.op === "between" ? [filter.b ?? ""] : [])].join(
				":",
			);
		case "consent":
			return [filter.op, ...filter.channels].join(":");
		case "referredBy":
			return filter.op === "contains" ? `contains:${filter.text}` : filter.op;
		case "created":
			return [filter.op, filter.a, ...(filter.op === "between" ? [filter.b] : [])].join(":");
	}
}

/** The server's form of a complete filter, or undefined while it still needs a value. */
export function serverFilter(filter: BuilderFilter) {
	switch (filter.field) {
		case "opportunities":
		case "allOpportunities":
			if (filter.a === null) return undefined;
			if (filter.op !== "between") return { op: filter.op, value: filter.a };
			if (filter.b === null) return undefined;
			return {
				op: "between" as const,
				min: Math.min(filter.a, filter.b),
				max: Math.max(filter.a, filter.b),
			};
		case "consent":
			return filter.channels.length ? { op: filter.op, channels: filter.channels } : undefined;
		case "referredBy":
			if (filter.op !== "contains") return { op: filter.op };
			return filter.text.trim() ? { op: "contains" as const, text: filter.text.trim() } : undefined;
		case "created":
			if (!filter.a) return undefined;
			if (filter.op !== "between") return { op: filter.op, date: filter.a };
			if (!filter.b) return undefined;
			return {
				op: "between" as const,
				from: filter.a < filter.b ? filter.a : filter.b,
				to: filter.a < filter.b ? filter.b : filter.a,
			};
	}
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});
const day = (value: string) => dayFormat.format(new Date(`${value}T00:00:00Z`));
const list = (items: string[]) =>
	items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;

/** How the filter's value reads in its chip, or undefined while it still needs one. */
export function filterSummary(filter: BuilderFilter): string | undefined {
	if (!serverFilter(filter)) return undefined;
	switch (filter.field) {
		case "opportunities":
		case "allOpportunities":
			return filter.op === "between"
				? `${Math.min(filter.a!, filter.b!)}–${Math.max(filter.a!, filter.b!)}`
				: String(filter.a);
		case "consent":
			if (filter.channels.length === channels.length)
				return filter.op === "allows" ? "every channel" : "any channel";
			return list(filter.channels.map((channel) => channelLabels[channel].toLowerCase()));
		case "referredBy":
			return filter.op === "contains" ? `“${filter.text.trim()}”` : undefined;
		case "created":
			return filter.op === "between"
				? `${day(filter.a < filter.b ? filter.a : filter.b)} – ${day(filter.a < filter.b ? filter.b : filter.a)}`
				: day(filter.a);
	}
}

/** Whether the operator alone completes the filter, so the chip needs no value segment. */
export const needsValue = (filter: BuilderFilter) =>
	!(filter.field === "referredBy" && filter.op !== "contains");
