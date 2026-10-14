import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const opportunityTypes = ["buyer", "seller", "estate-sale", "construction"] as const;
export const stages = ["new-lead", "active-lead", "under-contract", "closed"] as const;
export const timelines = ["1-3-mo", "3-6-mo", "6-plus-mo"] as const;

const timestamps = () => ({
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
const revision = () => integer("revision").notNull().default(1);
const fixture = () => integer("fictional", { mode: "boolean" }).notNull().default(false);

export const businessSettings = sqliteTable(
	"business_settings",
	{
		id: integer("id").primaryKey().default(1),
		name: text("name").notNull(),
		timezone: text("timezone").notNull(),
		dateFormat: text("date_format", { enum: ["M/d/yyyy", "MMM d, yyyy"] })
			.notNull()
			.default("MMM d, yyyy"),
		tasksEnabled: integer("tasks_enabled", { mode: "boolean" }).notNull().default(true),
		attentionScope: text("attention_scope", { enum: ["all-visited", "current-stage"] })
			.notNull()
			.default("all-visited"),
		revision: revision(),
		...timestamps(),
	},
	(t) => [
		check("settings_singleton", sql`${t.id} = 1`),
		check("settings_date_format", sql`${t.dateFormat} IN ('M/d/yyyy', 'MMM d, yyyy')`),
		check("settings_attention_scope", sql`${t.attentionScope} IN ('all-visited', 'current-stage')`),
		check("settings_tasks_boolean", sql`${t.tasksEnabled} IN (0, 1)`),
		check("settings_revision_positive", sql`${t.revision} > 0`),
	],
);

export const clients = sqliteTable(
	"clients",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email"),
		phone: text("phone"),
		address: text("address"),
		leadSource: text("lead_source"),
		notes: text("notes").notNull().default(""),
		archivedAt: text("archived_at"),
		fictional: fixture(),
		revision: revision(),
		...timestamps(),
	},
	(t) => [
		index("clients_archive_name").on(t.archivedAt, t.name),
		check("client_name_required", sql`length(trim(${t.name})) > 0`),
		check("client_revision_positive", sql`${t.revision} > 0`),
	],
);

export const tags = sqliteTable(
	"tags",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		color: text("color").notNull(),
		retiredAt: text("retired_at"),
		revision: revision(),
		...timestamps(),
	},
	(t) => [
		uniqueIndex("tags_name_unique").on(sql`lower(${t.name})`),
		check("tag_name_required", sql`length(trim(${t.name})) > 0`),
		check("tag_revision_positive", sql`${t.revision} > 0`),
	],
);

export const clientTags = sqliteTable(
	"client_tags",
	{
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id),
		tagId: text("tag_id")
			.notNull()
			.references(() => tags.id),
	},
	(t) => [primaryKey({ columns: [t.clientId, t.tagId] }), index("client_tags_tag").on(t.tagId)],
);

export const opportunities = sqliteTable(
	"opportunities",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		type: text("type", { enum: opportunityTypes }).notNull(),
		stage: text("stage", { enum: stages }).notNull(),
		timeline: text("timeline", { enum: timelines }),
		address: text("address"),
		budgetCents: integer("budget_cents"),
		notes: text("notes").notNull().default(""),
		archivedAt: text("archived_at"),
		fictional: fixture(),
		revision: revision(),
		...timestamps(),
	},
	(t) => [
		index("opportunities_board").on(t.archivedAt, t.stage, t.timeline),
		check("opportunity_title_required", sql`length(trim(${t.title})) > 0`),
		check("opportunity_type", sql`${t.type} IN ('buyer', 'seller', 'estate-sale', 'construction')`),
		check(
			"opportunity_stage",
			sql`${t.stage} IN ('new-lead', 'active-lead', 'under-contract', 'closed')`,
		),
		check(
			"opportunity_timeline",
			sql`${t.timeline} IS NULL OR ${t.timeline} IN ('1-3-mo', '3-6-mo', '6-plus-mo')`,
		),
		check(
			"opportunity_budget",
			sql`${t.budgetCents} IS NULL OR (typeof(${t.budgetCents}) = 'integer' AND ${t.budgetCents} >= 0)`,
		),
		check("opportunity_revision_positive", sql`${t.revision} > 0`),
	],
);

export const opportunityClients = sqliteTable(
	"opportunity_clients",
	{
		opportunityId: text("opportunity_id")
			.notNull()
			.references(() => opportunities.id),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id),
	},
	(t) => [
		primaryKey({ columns: [t.opportunityId, t.clientId] }),
		index("opportunity_clients_client").on(t.clientId),
	],
);

export const checklistTemplates = sqliteTable(
	"checklist_templates",
	{
		id: text("id").primaryKey(),
		type: text("type", { enum: opportunityTypes }).notNull(),
		stage: text("stage", { enum: stages }).notNull(),
		revision: revision(),
		...timestamps(),
	},
	(t) => [
		uniqueIndex("template_type_stage").on(t.type, t.stage),
		uniqueIndex("template_id_stage").on(t.id, t.stage),
		check("template_type", sql`${t.type} IN ('buyer', 'seller', 'estate-sale', 'construction')`),
		check(
			"template_stage",
			sql`${t.stage} IN ('new-lead', 'active-lead', 'under-contract', 'closed')`,
		),
		check("template_revision_positive", sql`${t.revision} > 0`),
	],
);

// Rows exist only for visited stages. The retained template source can differ from the opportunity's current type.
export const stageChecklists = sqliteTable(
	"stage_checklists",
	{
		id: text("id").primaryKey(),
		opportunityId: text("opportunity_id")
			.notNull()
			.references(() => opportunities.id),
		stage: text("stage", { enum: stages }).notNull(),
		templateId: text("template_id").notNull(),
		customized: integer("customized", { mode: "boolean" }).notNull().default(false),
		revision: revision(),
		...timestamps(),
	},
	(t) => [
		uniqueIndex("checklist_opportunity_stage").on(t.opportunityId, t.stage),
		foreignKey({
			columns: [t.templateId, t.stage],
			foreignColumns: [checklistTemplates.id, checklistTemplates.stage],
		}),
		check("checklist_customized_boolean", sql`${t.customized} IN (0, 1)`),
		check("checklist_revision_positive", sql`${t.revision} > 0`),
	],
);

// One identity space for template steps and whole-stage structural overrides; ownership never depends on an item's label or position.
export const checklistItems = sqliteTable(
	"checklist_items",
	{
		id: text("id").primaryKey(),
		templateId: text("template_id").references(() => checklistTemplates.id),
		checklistId: text("checklist_id").references(() => stageChecklists.id),
		title: text("title").notNull(),
		position: integer("position").notNull(),
		revision: revision(),
		...timestamps(),
	},
	(t) => [
		uniqueIndex("template_item_position").on(t.templateId, t.position),
		uniqueIndex("custom_item_position").on(t.checklistId, t.position),
		check(
			"item_owner",
			sql`(${t.templateId} IS NOT NULL AND ${t.checklistId} IS NULL) OR (${t.templateId} IS NULL AND ${t.checklistId} IS NOT NULL)`,
		),
		check("item_title_required", sql`length(trim(${t.title})) > 0`),
		check("item_position", sql`typeof(${t.position}) = 'integer' AND ${t.position} >= 0`),
		check("item_revision_positive", sql`${t.revision} > 0`),
	],
);

export const checklistProgress = sqliteTable(
	"checklist_progress",
	{
		checklistId: text("checklist_id")
			.notNull()
			.references(() => stageChecklists.id),
		itemId: text("item_id")
			.notNull()
			.references(() => checklistItems.id),
		completedAt: text("completed_at"),
		dueDate: text("due_date"),
		revision: revision(),
		...timestamps(),
	},
	(t) => [
		primaryKey({ columns: [t.checklistId, t.itemId] }),
		index("progress_attention").on(t.completedAt, t.dueDate),
		check(
			"progress_date_shape",
			sql`${t.dueDate} IS NULL OR ${t.dueDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
		),
		check("progress_revision_positive", sql`${t.revision} > 0`),
	],
);

export const tasks = sqliteTable(
	"tasks",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		assignedUserId: text("assigned_user_id").notNull(),
		assignedRole: text("assigned_role").notNull().default("realtor"),
		clientId: text("client_id").references(() => clients.id),
		opportunityId: text("opportunity_id").references(() => opportunities.id),
		sourceStage: text("source_stage", { enum: stages }),
		dueDate: text("due_date"),
		completedAt: text("completed_at"),
		fictional: fixture(),
		revision: revision(),
		...timestamps(),
	},
	(t) => [
		index("tasks_attention").on(t.completedAt, t.dueDate),
		index("tasks_client").on(t.clientId),
		index("tasks_opportunity").on(t.opportunityId),
		check("task_title_required", sql`length(trim(${t.title})) > 0`),
		check("task_realtor_only", sql`${t.assignedRole} = 'realtor'`),
		check("task_single_link", sql`${t.clientId} IS NULL OR ${t.opportunityId} IS NULL`),
		check(
			"task_source_stage",
			sql`${t.sourceStage} IS NULL OR (${t.opportunityId} IS NOT NULL AND ${t.sourceStage} IN ('new-lead', 'active-lead', 'under-contract', 'closed'))`,
		),
		check(
			"task_date_shape",
			sql`${t.dueDate} IS NULL OR ${t.dueDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
		),
		check("task_revision_positive", sql`${t.revision} > 0`),
	],
);

export const recordReferences = sqliteTable(
	"record_references",
	{
		id: text("id").primaryKey(),
		opportunityId: text("opportunity_id")
			.notNull()
			.references(() => opportunities.id),
		label: text("label").notNull(),
		kind: text("kind", { enum: ["url", "client", "opportunity"] }).notNull(),
		url: text("url"),
		targetClientId: text("target_client_id").references(() => clients.id),
		targetOpportunityId: text("target_opportunity_id").references(() => opportunities.id),
		revision: revision(),
		...timestamps(),
	},
	(t) => [
		index("references_opportunity").on(t.opportunityId),
		check("reference_label_required", sql`length(trim(${t.label})) > 0`),
		check(
			"reference_target",
			sql`(${t.kind} = 'url' AND ${t.url} IS NOT NULL AND (${t.url} LIKE 'https://%' OR ${t.url} LIKE 'http://%') AND ${t.targetClientId} IS NULL AND ${t.targetOpportunityId} IS NULL) OR (${t.kind} = 'client' AND ${t.targetClientId} IS NOT NULL AND ${t.url} IS NULL AND ${t.targetOpportunityId} IS NULL) OR (${t.kind} = 'opportunity' AND ${t.targetOpportunityId} IS NOT NULL AND ${t.url} IS NULL AND ${t.targetClientId} IS NULL)`,
		),
		check("reference_revision_positive", sql`${t.revision} > 0`),
	],
);

// Identity IDs remain independent of auth tables until group 8. Both actual and effective users are mandatory from the first mutation.
export const history = sqliteTable(
	"history",
	{
		id: text("id").primaryKey(),
		recordKind: text("record_kind", {
			enum: ["client", "opportunity", "task", "template", "settings", "tag"],
		}).notNull(),
		recordId: text("record_id").notNull(),
		actorUserId: text("actor_user_id").notNull(),
		effectiveUserId: text("effective_user_id").notNull(),
		action: text("action").notNull(),
		data: text("data", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
		fictional: fixture(),
		createdAt: text("created_at").notNull(),
	},
	(t) => [
		index("history_record").on(t.recordKind, t.recordId, t.createdAt),
		check(
			"history_record_kind",
			sql`${t.recordKind} IN ('client', 'opportunity', 'task', 'template', 'settings', 'tag')`,
		),
		check("history_json", sql`json_valid(${t.data})`),
		check("history_identity", sql`length(${t.actorUserId}) > 0 AND length(${t.effectiveUserId}) > 0`),
	],
);

export const mutationReceipts = sqliteTable(
	"mutation_receipts",
	{
		id: text("id").primaryKey(),
		actorUserId: text("actor_user_id").notNull(),
		effectiveUserId: text("effective_user_id").notNull(),
		payloadHash: text("payload_hash").notNull(),
		result: text("result", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
		createdAt: text("created_at").notNull(),
	},
	(t) => [check("receipt_result_json", sql`json_valid(${t.result})`)],
);

// Transient guards make a zero-row revision update fail the entire D1 batch instead of allowing related writes to commit.
export const mutationGuards = sqliteTable(
	"mutation_guards",
	{
		id: text("id").primaryKey(),
		passed: integer("passed").notNull(),
	},
	(t) => [check("mutation_guard_passed", sql`${t.passed} = 1`)],
);
