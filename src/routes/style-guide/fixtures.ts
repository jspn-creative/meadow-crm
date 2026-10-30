// Fictional records for the style guide. Real components take full workspace records, so these fill only the fields they read and are cast; nothing here is saved.
import { CalendarClock, Home, Phone } from "@lucide/svelte";
import type { Workspace } from "#lib/data/workspace.js";
import type { TaskListItem } from "#lib/tasks/types.js";
import { dueLabel } from "#lib/pipeline/due.js";
import type { stageLabels, typeLabels } from "#lib/pipeline/labels.js";

type Opportunity = Workspace["opportunities"][number];
type Checklist = Workspace["checklists"][number];
export type ChecklistRecord = Checklist["items"][number];
type Stage = keyof typeof stageLabels;
type OpportunityType = keyof typeof typeLabels;

const dayMs = 86_400_000;
export const today = new Date().toLocaleDateString("en-CA");
const day = (offset: number) =>
	new Date(Date.parse(`${today}T00:00:00Z`) + offset * dayMs).toISOString().slice(0, 10);

function opportunity(
	id: string,
	title: string,
	type: OpportunityType,
	stage: Stage,
	timeline: Opportunity["timeline"],
	pinned = false,
) {
	return {
		id,
		title,
		type,
		stage,
		timeline,
		pinnedAt: pinned ? `${today}T09:00:00Z` : null,
		budgetCents: null,
		address: "",
	} as unknown as Opportunity;
}

export const sampleCards = [
	{
		opportunity: opportunity("sg-maple", "Maple first home", "buyer", "active-lead", "1-3-mo", true),
		clients: ["Ada Maple", "Eli Maple"],
		progress: { done: 3, total: 5 },
		budget: "$485,000",
		address: "14 Orchard Row, Meadow Lane",
	},
	{
		opportunity: opportunity("sg-willow", "Willow home sale", "seller", "under-contract", "3-6-mo"),
		clients: ["Mira Willow"],
		progress: { done: 6, total: 8 },
		budget: "$612,500",
		address: "3 Brookside Court",
	},
	{
		opportunity: opportunity("sg-birch", "Birch family estate sale", "estate-sale", "new-lead", null),
		clients: ["Leo Birch"],
		progress: { done: 0, total: 4 },
		budget: "",
		address: "",
	},
	{
		opportunity: opportunity(
			"sg-cedar",
			"Cedar porch restoration",
			"construction",
			"active-lead",
			"6-plus-mo",
		),
		clients: ["Inez Cedar"],
		progress: { done: 2, total: 9 },
		budget: "$18,200",
		address: "88 Cedar Hollow",
	},
];
export type SampleCard = (typeof sampleCards)[number];

export const sampleChecklist = {
	id: "sg-checklist",
	revision: 1,
	stage: "active-lead",
	items: [],
} as unknown as Checklist;

export const sampleItems = (
	[
		{
			id: "sg-item-1",
			title: "Confirm pre-approval letter",
			completedAt: `${today}T08:00:00Z`,
			dueDate: null,
		},
		{
			id: "sg-item-2",
			title: "Share shortlist of homes",
			completedAt: `${today}T08:00:00Z`,
			dueDate: null,
		},
		{ id: "sg-item-3", title: "Schedule second showing", completedAt: null, dueDate: day(-2) },
		{ id: "sg-item-4", title: "Draft offer terms with clients", completedAt: null, dueDate: today },
		{ id: "sg-item-5", title: "Book home inspector", completedAt: null, dueDate: day(4) },
		{ id: "sg-item-6", title: "Collect earnest money details", completedAt: null, dueDate: null },
	] as const
).map((item) => ({ ...item, revision: 1 }) as unknown as ChecklistRecord);

export const sampleReferenceWorkspace = {
	referenceClients: [{ id: "sg-ada", name: "Ada Maple", archivedAt: null }],
	referenceOpportunities: [{ id: "sg-willow", title: "Willow home sale" }],
	opportunities: [sampleCards[1]!.opportunity],
} as unknown as Workspace;

export const sampleReferences = [
	{
		id: "sg-ref-1",
		kind: "url",
		label: "Listing on Zillow",
		url: "https://www.zillow.com/homedetails/example",
		targetClientId: null,
		targetOpportunityId: null,
	},
	{
		id: "sg-ref-2",
		kind: "client",
		label: "Ada Maple",
		url: null,
		targetClientId: "sg-ada",
		targetOpportunityId: null,
	},
	{
		id: "sg-ref-3",
		kind: "opportunity",
		label: "Willow home sale",
		url: null,
		targetClientId: null,
		targetOpportunityId: "sg-willow",
	},
] as unknown as Workspace["references"];

export const sampleTasks: TaskListItem[] = [
	{
		id: "sg-task-1",
		title: "Call Ada about the second showing",
		context: "Maple first home",
		due: dueLabel(day(-2), today),
		dueState: "overdue",
		icon: Phone,
		tone: "pending",
		note: "Promoted from the Active lead checklist.",
	},
	{
		id: "sg-task-2",
		title: "Draft offer terms",
		context: "Maple first home",
		due: "Today",
		dueState: "today",
		tone: "info",
	},
	{
		id: "sg-task-3",
		title: "Showing at 3 Brookside Court",
		context: "Willow home sale · 2:30 PM",
		due: dueLabel(day(3), today),
		dueState: "upcoming",
		icon: Home,
		tone: "tour",
	},
	{
		id: "sg-task-4",
		title: "Check in with Leo after the walkthrough",
		due: "No date",
		dueState: "undated",
		icon: CalendarClock,
	},
];
