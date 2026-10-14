import * as v from "valibot";

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(120), v.regex(/^[a-zA-Z0-9_-]+$/));
const revision = v.pipe(v.number(), v.integer(), v.minValue(1));
const stage = v.picklist(["new-lead", "active-lead", "under-contract", "closed"]);

export const workspaceInput = v.strictObject({ archived: v.optional(v.boolean(), false) });
export const createClientInput = v.strictObject({
	requestId: id,
	id,
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
});
export const moveStageInput = v.strictObject({ requestId: id, id, revision, stage });
export const createOpportunityInput = v.strictObject({
	requestId: id,
	id,
	title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	type: v.picklist(["buyer", "seller", "estate-sale", "construction"]),
	stage,
	clientId: id,
});
export const saveChecklistStepInput = v.strictObject({
	requestId: id,
	checklistId: id,
	revision,
	itemId: id,
	itemRevision: revision,
	completed: v.boolean(),
	dueDate: v.nullable(
		v.pipe(
			v.string(),
			v.regex(/^\d{4}-\d{2}-\d{2}$/),
			v.check((date) => {
				const parsed = new Date(`${date}T00:00:00Z`);
				return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
			}, "Choose a valid calendar date."),
		),
	),
});
export const saveOpportunityInput = v.strictObject({
	requestId: id,
	id,
	revision,
	title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	clientIds: v.pipe(
		v.array(id),
		v.minLength(1),
		v.maxLength(100),
		v.check((ids) => new Set(ids).size === ids.length, "Client links must be unique."),
	),
});
export const bulkArchiveInput = v.strictObject({
	requestId: id,
	clients: v.pipe(
		v.array(v.strictObject({ id, revision })),
		v.minLength(1),
		v.maxLength(100),
		v.check(
			(rows) => new Set(rows.map((row) => row.id)).size === rows.length,
			"Select each client once.",
		),
	),
});
