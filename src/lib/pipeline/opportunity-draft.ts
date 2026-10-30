import type { Workspace } from "#lib/data/workspace.js";

export type ReferenceDraft = {
	key: string;
	kind: "url" | "client" | "opportunity";
	label: string;
	destination: string;
};
export type OpportunityDraft = {
	id: string;
	revision?: number;
	title: string;
	type: Workspace["opportunities"][number]["type"];
	stage: Workspace["opportunities"][number]["stage"];
	clientIds: string[];
	timeline: string;
	address: string;
	budget: string;
	notes: string;
	references: ReferenceDraft[];
};

export function opportunityDraft(
	workspace: Workspace,
	id: string,
	clientId?: string,
): OpportunityDraft {
	const row = workspace.opportunities.find((record) => record.id === id);
	return {
		id,
		revision: row?.revision,
		title: row?.title ?? "",
		type: row?.type ?? "buyer",
		stage: row?.stage ?? "new-lead",
		clientIds: row
			? workspace.links.filter((link) => link.opportunityId === id).map((link) => link.clientId)
			: [clientId ?? workspace.clients[0]?.id ?? ""].filter(Boolean),
		timeline: row?.timeline ?? "",
		address: row?.address ?? "",
		budget: row?.budgetCents == null ? "" : (row.budgetCents / 100).toFixed(2),
		notes: row?.notes ?? "",
		references: workspace.references
			.filter((reference) => reference.opportunityId === id)
			.map((reference) => ({
				key: reference.id,
				kind: reference.kind,
				label: reference.label,
				destination: reference.url ?? reference.targetClientId ?? reference.targetOpportunityId ?? "",
			})),
	};
}

export const referenceKinds: { value: ReferenceDraft["kind"]; label: string }[] = [
	{ value: "url", label: "Web link" },
	{ value: "client", label: "Client" },
	{ value: "opportunity", label: "Opportunity" },
];

// The records a linked reference can point to, after a "Choose a record" placeholder.
export function referenceTargets(workspace: Workspace, kind: ReferenceDraft["kind"]) {
	const records =
		kind === "client"
			? workspace.referenceClients.map((client) => ({ value: client.id, label: client.name }))
			: workspace.referenceOpportunities.map((row) => ({ value: row.id, label: row.title }));
	return [{ value: "", label: "Choose a record" }, ...records];
}

// Validates a draft and shapes the save payload; a string result is the failure to show.
export function draftInput(draft: OpportunityDraft) {
	if (draft.budget && !/^\d+(\.\d{1,2})?$/.test(draft.budget))
		return "Enter a non-negative USD amount with at most two decimal places. Your draft is retained.";
	const [dollars, cents = ""] = draft.budget.split(".");
	const budgetCents = draft.budget ? Number(`${dollars}${cents.padEnd(2, "0")}`) : null;
	if (budgetCents !== null && !Number.isSafeInteger(budgetCents))
		return "This budget is too large. Your draft is retained.";
	return {
		id: draft.id,
		title: draft.title,
		stage: draft.stage,
		clientIds: [...draft.clientIds],
		timeline: (draft.timeline || null) as Workspace["opportunities"][number]["timeline"],
		address: draft.address || null,
		budgetCents,
		notes: draft.notes,
		references: draft.references.map((reference) =>
			reference.kind === "url"
				? { kind: "url" as const, label: reference.label, url: reference.destination }
				: { kind: reference.kind, label: reference.label, targetId: reference.destination },
		),
	};
}

export function safeReferenceUrl(url: string | null) {
	try {
		const parsed = new URL(url ?? "");
		return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password
			? parsed.href
			: null;
	} catch {
		return null;
	}
}
