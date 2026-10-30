import type { Workspace } from "./workspace.js";
import { checklistDatesEnabled } from "./release.js";

export function businessDate(timezone: string, now = new Date()) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);
	const part = (type: string) => parts.find((value) => value.type === type)!.value;
	return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isOverdue(dueDate: string | null, completedAt: string | null, today: string) {
	return !completedAt && dueDate !== null && dueDate < today;
}

export function checklistAttention(
	workspace: Pick<Workspace, "opportunities" | "checklists" | "settings" | "businessToday">,
) {
	return (checklistDatesEnabled ? workspace.checklists : [])
		.flatMap((list) => {
			const opportunity = workspace.opportunities.find(
				(row) => row.id === list.opportunityId && !row.archivedAt,
			);
			if (
				!opportunity ||
				(workspace.settings?.attentionScope === "current-stage" && list.stage !== opportunity.stage)
			)
				return [];
			return list.items
				.filter((item) => isOverdue(item.dueDate, item.completedAt, workspace.businessToday))
				.map((item) => ({
					id: `${list.id}:${item.id}`,
					title: item.title,
					opportunity: opportunity.title,
					stage: list.stage,
					dueDate: item.dueDate!,
					href: `/pipeline?opportunity=${encodeURIComponent(opportunity.id)}&stage=${list.stage}`,
				}));
		})
		.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}
