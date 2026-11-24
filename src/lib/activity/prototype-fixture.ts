// PROTOTYPE ONLY. Fictional Activity for the client dialog's design pass: nothing here is stored, queried, or derived from real clients. Delete this module once Activity reads notes, logged contact, and History from the database.

import type { ActivityEntry, ActivityOpportunity, Actor } from "./types.js";
import { browser, dev } from "$app/env";
import type { Workspace } from "#lib/data/workspace.js";
import { newClientDraft } from "#lib/registry/client-draft.js";

if (!dev || !browser)
	throw new Error("Activity fixtures are only available in the client-side development preview.");

const boldtrail: Actor = { kind: "boldtrail" };
const client: Actor = { kind: "client" };
const janae: Actor = { kind: "user", userId: "business-assistant" };
const jayden: Actor = { kind: "user", userId: "business-realtor" };

/** The day the business moved from BoldTrail to Meadow. */
export const prototypeMeadowSince = "2026-10-30T12:00:00-07:00";

// Pacific time, near enough for fixture data: daylight time from April through October.
function at(day: string, time: string) {
	const month = Number(day.slice(5, 7));
	return `${day}T${time}:00${month >= 4 && month <= 10 ? "-07:00" : "-08:00"}`;
}

const dripTemplates = [
	(name: string) => `Hi ${name}, it's Jayden's team. Still looking in Eastside?`,
	() => "Just checking in. Any questions about the market?",
	() => "New listings near you this week. Want me to send the list?",
	(name: string) => `${name}, rates moved this week. Want an updated payment estimate?`,
	() => "Open houses near you this weekend. Reply YES for times.",
];
const dripDays = [
	"2024-12-02",
	"2024-12-09",
	"2024-12-16",
	"2024-12-23",
	"2024-12-30",
	"2025-01-06",
	"2025-01-13",
	"2025-01-20",
	"2025-01-27",
	"2025-02-03",
	"2025-02-10",
	"2025-02-13",
	"2025-02-17",
	"2025-02-20",
];
const reportDays = [
	"2025-04-05",
	"2025-05-05",
	"2025-06-05",
	"2025-07-05",
	"2025-08-05",
	"2025-09-05",
	"2025-10-05",
	"2025-11-05",
	"2025-12-05",
];

const needsList = `Needs list after Saturday's showings:
- 3 bd minimum, 2 bath
- Fenced yard for Biscuit, the 70 lb lab
- Walk to Eastside Elementary
- No HOA if possible
- Under $725k, pre-approved with Cascade Lending
- Wants to close before August
- Hated the split-level on Larch, loved the kitchen on Fir
- Partner works nights, so a quiet street matters more than a big lot
- Fine with cosmetic work, not a roof or a foundation`;

/** Every entry kind in both eras, written around the open client's first name. Entries about an engagement go on the client's own opportunities when they have any, so the roll-up labels are real titles; otherwise they stay on the client. */
export function prototypeActivity(
	name: string,
	opportunities: ActivityOpportunity[],
): ActivityEntry[] {
	const first = opportunities[0]?.id;
	const second = opportunities[1]?.id ?? first;
	const on = (id?: string) => (id ? [id] : undefined);
	return [
		// --- From BoldTrail ---
		{
			id: "bt-created",
			kind: "event",
			at: at("2024-11-14", "09:12"),
			actor: boldtrail,
			imported: true,
			standalone: true,
			summary: "Added from a Zillow inquiry about 418 Juniper Ct",
			detail: [
				{ label: "Vendor", value: "Zillow Premier Agent" },
				{ label: "Landing page", value: "zillow.example/homedetails/418-juniper-ct" },
			],
		},
		{
			id: "bt-zillow",
			kind: "contact",
			at: at("2024-11-14", "09:13"),
			actor: client,
			imported: true,
			channel: "zillow",
			direction: "incoming",
			note:
				"We're relocating from Denver this summer and need something walkable with a yard for our dog. Is Juniper Ct still available?",
			detail: [
				{ label: "Property", value: "418 Juniper Ct" },
				{ label: "Searching", value: "$600k–$750k · 3+ bd · Eastside" },
				{ label: "Source", value: "Zillow Premier Agent" },
			],
		},
		{
			id: "bt-attempt-1",
			kind: "contact",
			at: at("2024-11-15", "10:02"),
			actor: boldtrail,
			imported: true,
			automated: true,
			channel: "call",
			direction: "outgoing",
			outcome: "no-answer",
		},
		{
			id: "bt-attempt-2",
			kind: "contact",
			at: at("2024-11-18", "16:40"),
			actor: boldtrail,
			imported: true,
			automated: true,
			channel: "call",
			direction: "outgoing",
			outcome: "no-answer",
		},
		...dripDays.map((day, index): ActivityEntry => ({
			id: `bt-drip-${index + 1}`,
			kind: "contact",
			at: at(day, "09:30"),
			actor: boldtrail,
			imported: true,
			automated: true,
			channel: "text",
			direction: "outgoing",
			note: dripTemplates[index % dripTemplates.length]!(name),
		})),
		{
			id: "bt-text-in",
			kind: "contact",
			at: at("2025-03-02", "18:04"),
			actor: client,
			imported: true,
			channel: "text",
			direction: "incoming",
			note: "Hi! Is the Juniper Ct house still available? Could we see it Saturday?",
		},
		{
			id: "bt-call",
			kind: "contact",
			at: at("2025-03-02", "18:09"),
			actor: boldtrail,
			imported: true,
			channel: "call",
			direction: "outgoing",
			outcome: "talked",
			note: `Spoke with ${name}, wants 3bd near Eastside schools. Free Saturday after 10.`,
		},
		{
			id: "bt-status",
			kind: "event",
			at: at("2025-03-02", "18:10"),
			actor: boldtrail,
			imported: true,
			summary: "set the follow-up status to claimed by agent",
			emphasis: ["claimed by agent"],
			detail: [
				{ label: "Status", value: "Completed" },
				{ label: "Type", value: "AutoClaimed" },
				{ label: "Reason", value: "Agent engaged" },
			],
		},
		{
			id: "bt-text-out",
			kind: "contact",
			at: at("2025-03-04", "08:51"),
			actor: boldtrail,
			imported: true,
			channel: "text",
			direction: "outgoing",
			note: `Hi ${name}, Jayden here. Juniper Ct went pending this morning, sorry! I can line up two similar ones nearby for Saturday at 10 if that still works.`,
		},
		{
			id: "bt-text-in-2",
			kind: "contact",
			at: at("2025-03-04", "09:17"),
			actor: client,
			imported: true,
			channel: "text",
			direction: "incoming",
			note: "Oh no. Yes please, Saturday at 10 works.",
		},
		{
			id: "bt-note",
			kind: "note",
			at: at("2025-03-09", "14:26"),
			actor: boldtrail,
			imported: true,
			body: needsList,
		},
		{
			id: "bt-email",
			kind: "contact",
			at: at("2025-03-10", "10:00"),
			actor: client,
			imported: true,
			channel: "email",
			direction: "incoming",
			note:
				"Here is our pre-approval letter. Please use this email for documents; Sam and I both check it.",
		},
		{
			id: "bt-meeting",
			kind: "contact",
			at: at("2025-03-15", "11:00"),
			actor: boldtrail,
			imported: true,
			channel: "meeting",
			direction: "outgoing",
			outcome: "met",
			note: "Toured Fir and Larch. The kitchen on Fir is the benchmark; both want a quieter street.",
		},
		{
			id: "bt-other",
			kind: "contact",
			at: at("2025-03-16", "12:00"),
			actor: boldtrail,
			imported: true,
			channel: "other",
			channelLabel: "Mailed guide",
			direction: "outgoing",
			note: "Sent the Eastside neighborhood guide.",
		},
		...reportDays.map((day, index): ActivityEntry => ({
			id: `bt-report-${index + 1}`,
			kind: "event",
			at: at(day, "07:00"),
			actor: boldtrail,
			imported: true,
			automation: "market-report",
			summary: "sent a market report for Eastside",
			detail: [{ label: "Area", value: "Eastside" }],
		})),
		{
			id: "bt-qualified",
			kind: "event",
			at: at("2025-06-12", "11:20"),
			actor: boldtrail,
			imported: true,
			automation: "status",
			summary: "changed the timeline qualification to 6+ months",
			emphasis: ["6+ months"],
			detail: [{ label: "Changed by", value: "Concierge" }],
		},
		{
			id: "bt-field",
			kind: "history",
			at: at("2025-08-19", "13:05"),
			actor: boldtrail,
			imported: true,
			changes: [
				{
					field: "email",
					before: "biscuitsmom@oldmail.example",
					after: `${name.toLowerCase()}@willowmail.example`,
				},
			],
		},
		{
			id: "bt-new-year",
			kind: "contact",
			at: at("2026-01-04", "09:41"),
			actor: boldtrail,
			imported: true,
			automated: true,
			channel: "text",
			direction: "outgoing",
			note: "Happy New Year from Jayden's team! Thinking about a move in 2026? Reply STOP to opt out.",
		},
		{
			id: "bt-stop",
			kind: "contact",
			at: at("2026-01-04", "10:02"),
			actor: client,
			imported: true,
			channel: "text",
			direction: "incoming",
			stop: true,
			note: "STOP",
		},
		{
			id: "bt-final-status",
			kind: "event",
			at: at("2026-10-20", "09:30"),
			actor: boldtrail,
			imported: true,
			summary: "paused automated follow-up",
			emphasis: ["paused"],
			detail: [{ label: "Reason", value: "Texting is off; keep email and calls available." }],
		},

		// --- In Meadow ---
		// Three saves in three minutes: the lead source nets out to one change and the preferred contact method ends where it started.
		{
			id: "m-source-1",
			kind: "history",
			at: at("2026-11-03", "10:02"),
			actor: janae,
			changes: [{ field: "lead source", before: "Website", after: "Paid ad" }],
		},
		{
			id: "m-source-2",
			kind: "history",
			at: at("2026-11-03", "10:04"),
			actor: janae,
			changes: [
				{ field: "lead source", before: "Paid ad", after: "Zillow" },
				{ field: "preferred contact method", before: "Text", after: "Email" },
			],
		},
		{
			id: "m-source-3",
			kind: "history",
			at: at("2026-11-03", "10:05"),
			actor: janae,
			changes: [{ field: "preferred contact method", before: "Email", after: "Text" }],
		},
		// A flag set and cleared a minute later: nothing changed, so Activity shows nothing.
		{
			id: "m-flag-1",
			kind: "history",
			at: at("2026-11-04", "14:30"),
			actor: jayden,
			changes: [{ field: "flag", before: "Not flagged", after: "Flagged for review" }],
		},
		{
			id: "m-flag-2",
			kind: "history",
			at: at("2026-11-04", "14:31"),
			actor: jayden,
			changes: [{ field: "flag", before: "Flagged for review", after: "Not flagged" }],
		},
		{
			id: "m-call",
			kind: "contact",
			at: at("2026-11-05", "11:15"),
			actor: janae,
			channel: "call",
			direction: "outgoing",
			outcome: "talked",
			note:
				"Ready to start again in the spring. Same needs list, budget now $775k. Prefers calls after 9am.",
		},
		{
			id: "m-text",
			kind: "contact",
			at: at("2026-11-05", "12:15"),
			actor: client,
			loggedBy: "business-assistant",
			channel: "text",
			direction: "incoming",
			note:
				"One more thing — the fenced yard is still non-negotiable! Please keep texting off for updates; email works best.",
		},
		{
			id: "m-email-in",
			kind: "contact",
			at: at("2026-11-06", "09:30"),
			actor: client,
			loggedBy: "business-realtor",
			opportunityIds: on(first),
			channel: "email",
			direction: "incoming",
			note: "Thanks Jayden! Signed paperwork attached. Could we go over next steps this weekend?",
		},
		{
			id: "m-email-out",
			kind: "contact",
			at: at("2026-11-06", "09:48"),
			actor: jayden,
			opportunityIds: on(first),
			channel: "email",
			direction: "outgoing",
			note: "Got it, thank you. I'm free Sunday after 1. I'll send two times tonight.",
		},
		{
			id: "m-note",
			kind: "note",
			at: at("2026-11-07", "08:12"),
			actor: jayden,
			editedAt: at("2026-11-10", "16:05"),
			body:
				"The partner is Sam, said SAHM. Always ask about Biscuit the lab, and send documents by email rather than reading them out on a call.",
		},
		{
			id: "m-meeting",
			kind: "contact",
			at: at("2026-11-08", "13:00"),
			actor: jayden,
			opportunityIds: on(first),
			channel: "meeting",
			direction: "outgoing",
			outcome: "met",
			note:
				"Walked through everything on Sunday. Main worry is the roof's age; wants a roofer's opinion before deciding on price.",
		},
		{
			id: "m-opp-note",
			kind: "note",
			at: at("2026-11-09", "15:44"),
			actor: janae,
			opportunityIds: on(first),
			body:
				"Roofer can come Thursday at 2pm. Two other parties are interested this week, so we should move quickly.",
		},
		{
			id: "m-card",
			kind: "contact",
			at: at("2026-11-10", "11:30"),
			actor: janae,
			opportunityIds: on(second),
			channel: "other",
			channelLabel: "Mailed samples",
			direction: "outgoing",
			note: "Sent the cabinet finish samples for Willow Way. Sam prefers the warmer oak.",
		},
		// One call covering both engagements, so its band carries both colors.
		{
			id: "m-call-both",
			kind: "contact",
			at: at("2026-11-11", "17:40"),
			actor: client,
			loggedBy: "business-assistant",
			opportunityIds: first && second && first !== second ? [first, second] : on(first),
			channel: "call",
			direction: "incoming",
			outcome: "talked",
			note:
				"If the Eastside offer goes through, could the kitchen work wait until after we move? We'd rather not renovate the old place.",
		},
		{
			id: "m-note-edit",
			kind: "history",
			at: at("2026-11-10", "16:05"),
			actor: jayden,
			summary: "edited a note",
		},
		{
			id: "m-call-2",
			kind: "contact",
			at: at("2026-11-12", "10:20"),
			actor: jayden,
			opportunityIds: on(first),
			channel: "call",
			direction: "outgoing",
			outcome: "talked",
			note: "Roofer says 8 to 10 years left. Comfortable at $742k with a roof credit.",
		},
		{
			id: "m-call-3",
			kind: "contact",
			at: at("2026-11-13", "15:10"),
			actor: jayden,
			opportunityIds: on(first),
			channel: "call",
			direction: "outgoing",
			outcome: "no-answer",
		},
		{
			id: "m-call-4",
			kind: "contact",
			at: at("2026-11-14", "09:05"),
			actor: jayden,
			opportunityIds: on(first),
			channel: "call",
			direction: "outgoing",
			outcome: "voicemail",
			note: "Left a voicemail with the counteroffer terms.",
		},
	];
}

/** A complete fictional relationship for the real editor, without a query, seed, or database write. */
export function createPrototype(scenario = "Two opportunities") {
	const draft = newClientDraft("activity-preview-priya", "Priya Nair");
	Object.assign(draft, {
		leadSource: "Zillow",
		preferredContactMethod: "email",
		consentText: false,
		preferences:
			"Priya is pronounced PREE-yah. Calls after 9am; documents by email. Sam works nights, so avoid early-morning showings.",
		people: [
			{
				id: "preview-priya",
				name: "Priya Nair",
				birthday: "1988-04-12",
				phones: [{ id: "preview-phone", label: "Mobile", value: "+12025550142" }],
				emails: [{ id: "preview-email", label: "Personal", value: "priya@willowmail.example" }],
			},
		],
		addresses: [
			{
				id: "preview-address",
				label: "Home",
				address: "86 Willow Way, Cedar Falls, WA 98000",
				owned: false,
			},
		],
		keyDates: [{ id: "preview-anniversary", name: "Wedding anniversary", date: "2018-06-23" }],
		tagIds: ["preview-sphere"],
	});
	const base = {
		notes: "",
		archivedAt: null,
		pinnedAt: null,
		fictional: true,
		revision: 1,
		createdAt: prototypeMeadowSince,
		updatedAt: prototypeMeadowSince,
	};
	const all: Workspace["opportunities"] = [
		{
			...base,
			id: "preview-juniper",
			title: "A quieter home on the Eastside",
			type: "buyer",
			stage: "active-lead",
			timeline: "1-3-mo",
			budgetCents: 77500000,
			address: "418 Juniper Ct, Cedar Falls, WA",
		},
		{
			...base,
			id: "preview-willow",
			title: "Willow Way kitchen renovation",
			type: "construction",
			stage: "new-lead",
			timeline: "3-6-mo",
			budgetCents: 4200000,
			address: "86 Willow Way, Cedar Falls, WA",
		},
	];
	const opportunities =
		scenario === "No opportunities" || scenario === "New relationship"
			? []
			: scenario === "One opportunity"
				? all.slice(0, 1)
				: all;
	const workspace: Pick<
		Workspace,
		"clients" | "referenceClients" | "tags" | "identity" | "links" | "opportunities" | "settings"
	> = {
		clients: [],
		referenceClients: [
			{ id: draft.id, name: draft.name, archivedAt: null, tags: [] },
			{ id: "preview-sam", name: "Sam Ellis", archivedAt: null, tags: [] },
		],
		tags: [
			{
				id: "preview-sphere",
				name: "Sphere",
				color: "var(--color-field)",
				retiredAt: null,
				revision: 1,
				createdAt: prototypeMeadowSince,
				updatedAt: prototypeMeadowSince,
			},
		],
		identity: {
			actorUserId: "business-assistant",
			effectiveUserId: "business-assistant",
			role: "assistant",
		},
		links: opportunities.map((row) => ({ clientId: draft.id, opportunityId: row.id })),
		opportunities,
		settings: {
			id: 1,
			name: "Meadow Lane",
			timezone: "America/Los_Angeles",
			dateFormat: "MMM d, yyyy",
			tasksEnabled: true,
			attentionScope: "current-stage",
			revision: 1,
			createdAt: prototypeMeadowSince,
			updatedAt: prototypeMeadowSince,
		},
	};
	return {
		draft,
		workspace,
		preview: {
			entries: scenario === "New relationship" ? [] : prototypeActivity("Priya", opportunities),
			meadowSince: prototypeMeadowSince,
		},
	};
}
