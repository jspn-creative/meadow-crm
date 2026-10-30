import * as v from "valibot";

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(120), v.regex(/^[a-zA-Z0-9_-]+$/));
const revision = v.pipe(v.number(), v.integer(), v.minValue(1));
const stage = v.picklist(["new-lead", "active-lead", "under-contract", "closed"]);
const type = v.picklist(["buyer", "seller", "estate-sale", "construction"]);
const clientIds = v.pipe(
	v.array(id),
	v.maxLength(100),
	v.check((ids) => new Set(ids).size === ids.length, "Client links must be unique."),
);
const reference = v.variant("kind", [
	v.strictObject({
		kind: v.literal("url"),
		label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
		url: v.pipe(
			v.string(),
			v.trim(),
			v.maxLength(2000),
			v.check((url) => {
				try {
					const parsed = new URL(url);
					return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
				} catch {
					return false;
				}
			}, "Use a complete HTTP or HTTPS link without credentials."),
		),
	}),
	v.strictObject({
		kind: v.literal("client"),
		label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
		targetId: id,
	}),
	v.strictObject({
		kind: v.literal("opportunity"),
		label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
		targetId: id,
	}),
]);
const opportunityDetails = {
	timeline: v.optional(v.nullable(v.picklist(["1-3-mo", "3-6-mo", "6-plus-mo"]))),
	address: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(1000)))),
	budgetCents: v.optional(
		v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER))),
	),
	notes: v.optional(v.pipe(v.string(), v.maxLength(20000))),
	references: v.optional(v.pipe(v.array(reference), v.maxLength(50))),
};

export const workspaceInput = v.strictObject({ archived: v.optional(v.boolean(), false) });
export const createClientInput = v.strictObject({
	requestId: id,
	id,
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	references: v.optional(v.pipe(v.array(reference), v.maxLength(50))),
});

const calendarDate = v.pipe(
	v.string(),
	v.regex(/^\d{4}-\d{2}-\d{2}$/),
	v.check((date) => {
		const parsed = new Date(`${date}T00:00:00Z`);
		return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
	}, "Choose a valid calendar date."),
);

const taskDetails = {
	title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	date: calendarDate,
	dueDate: v.nullable(calendarDate),
	clientId: v.nullable(id),
	opportunityId: v.nullable(id),
};
export const createTaskInput = v.pipe(
	v.strictObject({ requestId: id, id, ...taskDetails }),
	v.check(
		(task) => !task.clientId || !task.opportunityId,
		"Link a task to one client or one opportunity, not both.",
	),
);
export const saveTaskInput = v.pipe(
	v.strictObject({ requestId: id, id, revision, ...taskDetails }),
	v.check(
		(task) => !task.clientId || !task.opportunityId,
		"Link a task to one client or one opportunity, not both.",
	),
);
export const completeTaskInput = v.strictObject({
	requestId: id,
	id,
	revision,
	completed: v.boolean(),
});
export const deleteTaskInput = v.strictObject({ requestId: id, id, revision });

const personPhoneInput = v.strictObject({
	id,
	label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
	value: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
});
const personEmailInput = v.strictObject({
	id,
	label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
	value: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
});
const personInput = v.strictObject({
	id,
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	birthday: v.optional(v.nullable(calendarDate)),
	phones: v.optional(v.array(personPhoneInput), []),
	emails: v.optional(v.array(personEmailInput), []),
});
const addressInput = v.strictObject({
	id,
	label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
	address: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(1000)),
	owned: v.optional(v.boolean(), false),
});
const relationshipInput = v.strictObject({
	id,
	relatedClientId: id,
	label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
});
const keyDateInput = v.strictObject({
	id,
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
	date: calendarDate,
});

export const saveClientInput = v.strictObject({
	requestId: id,
	id,
	revision,
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	leadSource: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200)))),
	preferences: v.optional(v.pipe(v.string(), v.maxLength(20000))),
	preferredContactMethod: v.optional(v.nullable(v.picklist(["call", "text", "email", "mail"]))),
	referredByClientId: v.optional(v.nullable(id)),
	referredByName: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200)))),
	consentCall: v.optional(v.boolean()),
	consentText: v.optional(v.boolean()),
	consentEmail: v.optional(v.boolean()),
	consentMail: v.optional(v.boolean()),
	notes: v.optional(v.pipe(v.string(), v.maxLength(20000))),
	people: v.optional(v.array(personInput)),
	addresses: v.optional(v.array(addressInput)),
	relationships: v.optional(v.array(relationshipInput)),
	keyDates: v.optional(v.array(keyDateInput)),
	tagIds: v.optional(v.array(id)),
	references: v.optional(v.pipe(v.array(reference), v.maxLength(50))),
});
export const moveStageInput = v.strictObject({ requestId: id, id, revision, stage });
export const createOpportunityFormInput = v.strictObject({
	requestId: id,
	id,
	title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	type,
	stage,
	clientId: v.optional(id),
});
export const createOpportunityInput = v.strictObject({
	requestId: id,
	id,
	title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	type,
	stage,
	clientId: v.optional(id),
	clientIds: v.optional(clientIds),
	...opportunityDetails,
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
	clientIds: v.optional(clientIds),
	type: v.optional(type),
	stage: v.optional(stage),
	...opportunityDetails,
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
export const archiveOpportunityInput = v.strictObject({ requestId: id, id, revision });
export const restoreOpportunityInput = v.strictObject({ requestId: id, id, revision });
export const deleteOpportunityInput = v.strictObject({ requestId: id, id, revision });
export const pinOpportunityInput = v.strictObject({
	requestId: id,
	id,
	revision,
	pinned: v.boolean(),
});

export const addChecklistItemInput = v.strictObject({
	requestId: id,
	checklistId: id,
	revision,
	title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
});
export const removeChecklistItemInput = v.strictObject({
	requestId: id,
	checklistId: id,
	revision,
	itemId: id,
});
export const renameChecklistItemInput = v.strictObject({
	requestId: id,
	checklistId: id,
	revision,
	itemId: id,
	itemRevision: revision,
	title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
});
export const reorderChecklistItemsInput = v.strictObject({
	requestId: id,
	checklistId: id,
	revision,
	itemIds: v.pipe(v.array(id), v.minLength(1), v.maxLength(100)),
});
