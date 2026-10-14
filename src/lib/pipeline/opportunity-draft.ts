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
