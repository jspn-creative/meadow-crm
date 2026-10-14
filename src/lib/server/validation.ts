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
