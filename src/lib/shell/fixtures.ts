// Fictional visual examples only; persisted fixtures belong to the later local seed task.
export const stages = ["New lead", "Active lead", "Under contract", "Closed"] as const;
export const opportunities = [
	{
		id: "rivera",
		title: "Rivera home search",
		client: "Jamie Rivera",
		type: "Buyer",
		stage: "Active lead",
		timeline: "1-3 mo",
		progress: "3 of 7",
		tone: "info",
	},
	{
		id: "chen",
		title: "Chen family listing",
		client: "Alex & Morgan Chen",
		type: "Seller",
		stage: "Under contract",
		timeline: "1-3 mo",
		progress: "6 of 9",
		tone: "tour",
	},
	{
		id: "ellis",
		title: "Ellis family introduction",
		client: "Sam Ellis",
		type: "Estate Sale",
		stage: "New lead",
		timeline: "Not set",
		progress: "1 of 6",
		tone: "pending",
	},
	{
		id: "miller",
		title: "Miller kitchen addition",
		client: "David Miller",
		type: "Construction",
		stage: "Closed",
		timeline: "3-6 mo",
		progress: "4 of 6",
		tone: "success",
	},
] as const;

export const attention = [
	{
		id: "financing",
		title: "Confirm financing status or proof of funds",
		opportunity: "Rivera home search",
		stage: "Active lead",
		due: "Due yesterday",
		href: "/pipeline",
	},
	{
		id: "inspection",
		title: "Confirm the buyer's inspection and review the report",
		opportunity: "Chen family listing",
		stage: "Under contract",
		due: "Due 2 days ago",
		href: "/pipeline",
	},
	{
		id: "permits",
		title: "Pull any permits needed for the work",
		opportunity: "Miller kitchen addition",
		stage: "Active lead · previous stage",
		due: "Due 3 days ago",
		href: "/pipeline",
	},
] as const;

export const tasks = [
	{
		id: "call",
		title: "Call Jamie about the search area",
		context: "Rivera home search",
		due: "Due yesterday",
	},
	{
		id: "quote",
		title: "Confirm the revised contractor quote",
		context: "Miller kitchen addition",
		due: "Due today",
	},
	{
		id: "intro",
		title: "Introduce Sam to the estate sale partner",
		context: "Ellis family introduction",
		due: "No due date",
	},
] as const;
