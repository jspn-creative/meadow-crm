import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { eq, inArray, isNull, isNotNull } from "drizzle-orm";
import * as v from "valibot";
import type { BusinessIdentity } from "./identity.ts";
import { businessDate } from "../data/attention.ts";
import {
	businessSettings,
	clients,
	clientAddresses,
	clientKeyDates,
	clientPeople,
	clientRelationships,
	clientTags,
	opportunities,
	opportunityClients,
	personEmails,
	personPhones,
	stageChecklists,
	checklistItems,
	checklistProgress,
	recordReferences,
	history,
	tags,
	tasks,
} from "./db/schema.ts";
import {
	addChecklistItemInput,
	archiveOpportunityInput,
	bulkArchiveInput,
	createClientInput,
	createOpportunityInput,
	deleteOpportunityInput,
	pinOpportunityInput,
	removeChecklistItemInput,
	renameChecklistItemInput,
	reorderChecklistItemsInput,
	restoreOpportunityInput,
	saveChecklistStepInput,
	moveStageInput,
	saveClientInput,
	saveOpportunityInput,
	workspaceInput,
	createTaskInput,
	saveTaskInput,
	completeTaskInput,
	deleteTaskInput,
} from "./validation.ts";

export class DataConflict extends Error {
	constructor() {
		super(
			"This record changed or a linked record is unavailable. Refresh and reselect before saving.",
		);
	}
}

// The record cannot be saved as it was asked for, whatever the stored state is.
export class DataInvalid extends Error {
	constructor(message: string) {
		super(message);
	}
}

// Compares the linked-client count against an expected length. An empty id list can't be
// used in an IN clause, so with no ids the guard is a tautology: 0 linked clients matches
// an expectation of 0.
function clientCountGuard(ids: string[]): string {
	const placeholders = ids.map(() => "?").join(",");
	return placeholders
		? `(SELECT count(*) FROM clients WHERE id IN (${placeholders}) AND archived_at IS NULL) = ?`
		: "0 = 0";
}
function clientCountParams(ids: string[]): (string | number)[] {
	return ids.length ? [...ids, ids.length] : [];
}

interface Receipt {
	actor_user_id: string;
	effective_user_id: string;
	payload_hash: string;
	result: string;
}

// Each request owns its service and identity. There is no server-shared cache or mutable current-user singleton.
export function createDataService(db: D1Database, identity: BusinessIdentity) {
	const user = Object.freeze({ ...identity });
	const orm = drizzle(db);
	const stmt = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).bind(...args);
	const guardExists = "EXISTS (SELECT 1 FROM mutation_guards WHERE id = ?)";

	async function mutation(
		requestId: string,
		payload: unknown,
		result: Record<string, unknown>,
		statements: (guard: string, now: string) => D1PreparedStatement[],
	) {
		const hash = Array.from(
			new Uint8Array(
				await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload))),
			),
		)
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
		const receipt = () =>
			stmt(
				"SELECT actor_user_id, effective_user_id, payload_hash, result FROM mutation_receipts WHERE id = ?",
				requestId,
			).first<Receipt>();
		const replay = (saved: Receipt) => {
			if (
				saved.actor_user_id !== user.actorUserId ||
				saved.effective_user_id !== user.effectiveUserId ||
				saved.payload_hash !== hash
			)
				throw new Error("This request ID is already used by a different operation or identity.");
			return JSON.parse(saved.result) as Record<string, unknown>;
		};
		const existing = await receipt();
		if (existing) return replay(existing);
		const guard = crypto.randomUUID();
		const now = new Date().toISOString();
		try {
			await db.batch([
				...statements(guard, now),
				stmt(
					"INSERT INTO mutation_receipts (id, actor_user_id, effective_user_id, payload_hash, result, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE " +
						guardExists,
					requestId,
					user.actorUserId,
					user.effectiveUserId,
					hash,
					JSON.stringify(result),
					now,
					guard,
				),
				stmt("DELETE FROM mutation_guards WHERE id = ?", guard),
			]);
		} catch (error) {
			// Concurrent retries can race the first receipt read; only an identical committed operation can be replayed.
			const saved = await receipt();
			if (saved) return replay(saved);
			if (String(error).includes("mutation_guard_passed") || String(error).includes("FOREIGN KEY"))
				throw new DataConflict();
			throw error;
		}
		return result;
	}

	const appendHistory = (
		guard: string,
		now: string,
		kind: string,
		id: string,
		action: string,
		data: unknown,
	) =>
		stmt(
			"INSERT INTO history (id, record_kind, record_id, actor_user_id, effective_user_id, action, data, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE " +
				guardExists,
			crypto.randomUUID(),
			kind,
			id,
			user.actorUserId,
			user.effectiveUserId,
			action,
			JSON.stringify(data),
			now,
			guard,
		);

	function writeReferences(
		guard: string,
		now: string,
		column: "opportunity_id" | "client_id",
		ownerId: string,
		references: v.InferOutput<typeof saveOpportunityInput>["references"],
	) {
		if (!references) return [];
		return [
			stmt(`DELETE FROM record_references WHERE ${column} = ? AND ` + guardExists, ownerId, guard),
			...references.map((reference) =>
				stmt(
					`INSERT INTO record_references (id, ${column}, label, kind, url, target_client_id, target_opportunity_id, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ` +
						guardExists,
					crypto.randomUUID(),
					ownerId,
					reference.label,
					reference.kind,
					reference.kind === "url" ? reference.url : null,
					reference.kind === "client" ? reference.targetId : null,
					reference.kind === "opportunity" ? reference.targetId : null,
					now,
					now,
					guard,
				),
			),
		];
	}

	return {
		identity: user,
		async recentActivity() {
			const [result, settings] = await Promise.all([
				stmt(`SELECT h.id, h.record_kind AS recordKind, COALESCE(NULLIF(h.record_id, ''), sc.opportunity_id) AS recordId, h.action, h.data, h.created_at AS createdAt, h.actor_user_id AS actorUserId, h.effective_user_id AS effectiveUserId, COALESCE(c.name, o.title, t.title) AS title, COALESCE(c.archived_at, o.archived_at) AS archivedAt
					FROM history h
					LEFT JOIN stage_checklists sc ON h.record_kind = 'opportunity' AND h.record_id = '' AND sc.id = json_extract(h.data, '$.checklistId')
					LEFT JOIN clients c ON h.record_kind = 'client' AND c.id = h.record_id
					LEFT JOIN opportunities o ON h.record_kind = 'opportunity' AND o.id = COALESCE(NULLIF(h.record_id, ''), sc.opportunity_id)
					LEFT JOIN tasks t ON h.record_kind = 'task' AND t.id = h.record_id
					WHERE c.id IS NOT NULL OR o.id IS NOT NULL OR t.id IS NOT NULL
					ORDER BY h.created_at DESC, h.id DESC LIMIT 20`).all<{
					id: string;
					recordKind: "client" | "opportunity" | "task";
					recordId: string;
					action: string;
					data: string;
					createdAt: string;
					actorUserId: string;
					effectiveUserId: string;
					title: string;
					archivedAt: string | null;
				}>(),
				orm.select().from(businessSettings).where(eq(businessSettings.id, 1)),
			]);
			return {
				changes: result.results.map((row) => ({
					...row,
					data: JSON.parse(row.data) as Record<string, unknown>,
				})),
				timezone: settings[0]?.timezone ?? "America/New_York",
			};
		},
		async workspace(input: unknown) {
			const { archived } = v.parse(workspaceInput, input);
			const [
				clientRows,
				opportunityRows,
				settings,
				links,
				checklists,
				items,
				progress,
				references,
				changes,
				referenceClientRows,
				referenceOpportunities,
				clientTagRows,
				clientPeopleRows,
				personPhoneRows,
				personEmailRows,
				clientAddressRows,
				clientRelationshipRows,
				clientKeyDateRows,
				tagRows,
				clientTagAllRows,
				taskRows,
			] = await Promise.all([
				orm
					.select()
					.from(clients)
					.where(archived ? isNotNull(clients.archivedAt) : isNull(clients.archivedAt)),
				orm
					.select()
					.from(opportunities)
					.where(archived ? isNotNull(opportunities.archivedAt) : isNull(opportunities.archivedAt)),
				orm.select().from(businessSettings).where(eq(businessSettings.id, 1)),
				orm.select().from(opportunityClients),
				orm.select().from(stageChecklists),
				orm.select().from(checklistItems),
				orm.select().from(checklistProgress),
				orm.select().from(recordReferences),
				orm
					.select()
					.from(history)
					.where(inArray(history.recordKind, ["opportunity", "client", "task"])),
				orm
					.select({ id: clients.id, name: clients.name, archivedAt: clients.archivedAt })
					.from(clients),
				orm
					.select({
						id: opportunities.id,
						title: opportunities.title,
						archivedAt: opportunities.archivedAt,
					})
					.from(opportunities),
				orm
					.select({
						clientId: clientTags.clientId,
						id: tags.id,
						name: tags.name,
						color: tags.color,
					})
					.from(clientTags)
					.innerJoin(tags, eq(tags.id, clientTags.tagId))
					.where(isNull(tags.retiredAt)),
				orm.select().from(clientPeople),
				orm.select().from(personPhones),
				orm.select().from(personEmails),
				orm.select().from(clientAddresses),
				orm.select().from(clientRelationships),
				orm.select().from(clientKeyDates),
				orm.select().from(tags),
				orm.select().from(clientTags),
				orm.select().from(tasks),
			]);
			const tagsByClient = new Map<string, { id: string; name: string; color: string }[]>();
			for (const row of clientTagRows) {
				const list = tagsByClient.get(row.clientId) ?? [];
				list.push({ id: row.id, name: row.name, color: row.color });
				tagsByClient.set(row.clientId, list);
			}
			// A client's people, addresses, relationships, key dates and tags hang off that client, so one record can never show another's rows.
			const tagById = new Map(tagRows.map((tag) => [tag.id, tag]));
			const clientRecords = clientRows.map((row) => ({
				...row,
				people: clientPeopleRows
					.filter((person) => person.clientId === row.id)
					.sort((a, b) => a.position - b.position)
					.map((person) => ({
						...person,
						phones: personPhoneRows
							.filter((phone) => phone.personId === person.id)
							.sort((a, b) => a.position - b.position),
						emails: personEmailRows
							.filter((email) => email.personId === person.id)
							.sort((a, b) => a.position - b.position),
					})),
				addresses: clientAddressRows
					.filter((address) => address.clientId === row.id)
					.sort((a, b) => a.position - b.position),
				relationships: clientRelationshipRows.filter(
					(relationship) => relationship.clientId === row.id,
				),
				keyDates: clientKeyDateRows.filter((keyDate) => keyDate.clientId === row.id),
				tags: clientTagAllRows
					.filter((link) => link.clientId === row.id)
					.map((link) => tagById.get(link.tagId))
					.filter((tag): tag is (typeof tagRows)[number] => tag !== undefined),
			}));
			return {
				identity: user,
				businessToday: businessDate(settings[0]?.timezone ?? "America/New_York"),
				clients: clientRecords,
				tasks: taskRows,
				opportunities: opportunityRows,
				links: links.filter((link) => opportunityRows.some((row) => row.id === link.opportunityId)),
				references: references.filter(
					(reference) =>
						(reference.opportunityId !== null &&
							opportunityRows.some((row) => row.id === reference.opportunityId)) ||
						(reference.clientId !== null && clientRows.some((row) => row.id === reference.clientId)),
				),
				history: changes
					.filter(
						(change) =>
							(change.recordKind === "opportunity" &&
								opportunityRows.some((row) => row.id === change.recordId)) ||
							(change.recordKind === "client" && clientRows.some((row) => row.id === change.recordId)) ||
							change.recordKind === "task",
					)
					.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
				referenceClients: referenceClientRows.map((client) => ({
					id: client.id,
					name: client.name,
					archivedAt: client.archivedAt,
					tags: tagsByClient.get(client.id) ?? [],
				})),
				referenceOpportunities,
				tags: tagRows,
				checklists: checklists
					.filter((list) => opportunityRows.some((row) => row.id === list.opportunityId))
					.map((list) => {
						const removed = new Set(JSON.parse(list.removedTemplateItems || "[]") as string[]);
						return {
							...list,
							items: items
								.filter((item) => {
									if (item.checklistId === list.id) return true;
									if (item.templateId === list.templateId && !removed.has(item.id)) return true;
									return false;
								})
								.sort((a, b) => a.position - b.position)
								.map((item) => {
									const saved = progress.find(
										(row) => row.checklistId === list.id && row.itemId === item.id,
									);
									return {
										...item,
										completedAt: saved?.completedAt ?? null,
										dueDate: saved?.dueDate ?? null,
									};
								}),
						};
					}),
				settings: settings[0] ?? null,
			};
		},
		async createTask(input: unknown) {
			const value = v.parse(createTaskInput, input);
			return mutation(
				value.requestId,
				{ operation: "create-task", ...value },
				{ id: value.id, revision: 1 },
				(guard, now) => [
					stmt(
						"INSERT INTO mutation_guards VALUES (?, CASE WHEN NOT EXISTS (SELECT 1 FROM tasks WHERE id = ?) AND (? IS NULL OR EXISTS (SELECT 1 FROM clients WHERE id = ? AND archived_at IS NULL)) AND (? IS NULL OR EXISTS (SELECT 1 FROM opportunities WHERE id = ? AND archived_at IS NULL)) THEN 1 ELSE 0 END)",
						guard,
						value.id,
						value.clientId,
						value.clientId,
						value.opportunityId,
						value.opportunityId,
					),
					stmt(
						"INSERT INTO tasks (id, title, date, due_date, client_id, opportunity_id, assigned_user_id, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, 'business-realtor', ?, ? WHERE " +
							guardExists,
						value.id,
						value.title,
						value.date,
						value.dueDate,
						value.clientId,
						value.opportunityId,
						now,
						now,
						guard,
					),
					appendHistory(guard, now, "task", value.id, "create", { after: value }),
				],
			);
		},
		async saveTask(input: unknown) {
			const value = v.parse(saveTaskInput, input);
			return mutation(
				value.requestId,
				{ operation: "save-task", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						"INSERT INTO mutation_guards VALUES (?, CASE WHEN EXISTS (SELECT 1 FROM tasks WHERE id = ? AND revision = ? AND source_stage IS NULL AND (? IS NULL OR EXISTS (SELECT 1 FROM clients WHERE id = ? AND (archived_at IS NULL OR id = tasks.client_id))) AND (? IS NULL OR EXISTS (SELECT 1 FROM opportunities WHERE id = ? AND (archived_at IS NULL OR id = tasks.opportunity_id)))) THEN 1 ELSE 0 END)",
						guard,
						value.id,
						value.revision,
						value.clientId,
						value.clientId,
						value.opportunityId,
						value.opportunityId,
					),
					stmt(
						"INSERT INTO history (id, record_kind, record_id, actor_user_id, effective_user_id, action, data, created_at) SELECT ?, 'task', id, ?, ?, 'edit', json_object('before', json_object('title', title, 'date', date, 'dueDate', due_date, 'clientId', client_id, 'opportunityId', opportunity_id), 'after', json(?)), ? FROM tasks WHERE id = ? AND " +
							guardExists,
						crypto.randomUUID(),
						user.actorUserId,
						user.effectiveUserId,
						JSON.stringify(value),
						now,
						value.id,
						guard,
					),
					stmt(
						"UPDATE tasks SET title = ?, date = ?, due_date = ?, client_id = ?, opportunity_id = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND " +
							guardExists,
						value.title,
						value.date,
						value.dueDate,
						value.clientId,
						value.opportunityId,
						now,
						value.id,
						guard,
					),
				],
			);
		},
		async completeTask(input: unknown) {
			const value = v.parse(completeTaskInput, input);
			return mutation(
				value.requestId,
				{ operation: "complete-task", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						`UPDATE tasks SET completed_at = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND source_stage IS NULL AND completed_at IS ${value.completed ? "NULL" : "NOT NULL"}`,
						value.completed ? now : null,
						now,
						value.id,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					appendHistory(guard, now, "task", value.id, value.completed ? "complete" : "reopen", {
						revision: value.revision,
						completedAt: value.completed ? now : null,
					}),
				],
			);
		},
		async deleteTask(input: unknown) {
			const value = v.parse(deleteTaskInput, input);
			return mutation(
				value.requestId,
				{ operation: "delete-task", ...value },
				{ id: value.id },
				(guard, now) => [
					stmt(
						"INSERT INTO mutation_guards VALUES (?, CASE WHEN EXISTS (SELECT 1 FROM tasks WHERE id = ? AND revision = ? AND source_stage IS NULL) THEN 1 ELSE 0 END)",
						guard,
						value.id,
						value.revision,
					),
					appendHistory(guard, now, "task", value.id, "delete", { revision: value.revision }),
					stmt("DELETE FROM tasks WHERE id = ? AND " + guardExists, value.id, guard),
				],
			);
		},
		async createClient(input: unknown) {
			const value = v.parse(createClientInput, input);
			return mutation(
				value.requestId,
				{ operation: "create-client", ...value },
				{ id: value.id, revision: 1 },
				(guard, now) => [
					stmt(
						"INSERT INTO mutation_guards VALUES (?, CASE WHEN NOT EXISTS (SELECT 1 FROM clients WHERE id = ?) THEN 1 ELSE 0 END)",
						guard,
						value.id,
					),
					stmt(
						"INSERT INTO clients (id, name, consent_call, consent_text, consent_email, consent_mail, created_at, updated_at) SELECT ?, ?, 1, 1, 1, 1, ?, ? WHERE " +
							guardExists,
						value.id,
						value.name,
						now,
						now,
						guard,
					),
					...writeReferences(
						guard,
						now,
						"client_id",
						value.id,
						value.references as v.InferOutput<typeof saveOpportunityInput>["references"],
					),
					appendHistory(guard, now, "client", value.id, "create", { after: { name: value.name } }),
				],
			);
		},
		async createOpportunity(input: unknown) {
			const value = v.parse(createOpportunityInput, input);
			if (value.clientId && value.clientIds) throw new Error("Choose one client-link input.");
			const linkedIds = value.clientIds ?? (value.clientId ? [value.clientId] : []);
			return mutation(
				value.requestId,
				{ operation: "create-opportunity", ...value },
				{ id: value.id, revision: 1 },
				(guard, now) => [
					stmt(
						`INSERT INTO mutation_guards VALUES (?, CASE WHEN NOT EXISTS (SELECT 1 FROM opportunities WHERE id = ?) AND ${clientCountGuard(linkedIds)} AND EXISTS (SELECT 1 FROM checklist_templates WHERE type = ? AND stage = ?) THEN 1 ELSE 0 END)`,
						guard,
						value.id,
						...clientCountParams(linkedIds),
						value.type,
						value.stage,
					),
					stmt(
						"INSERT INTO opportunities (id, title, type, stage, timeline, address, budget_cents, notes, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE " +
							guardExists,
						value.id,
						value.title,
						value.type,
						value.stage,
						value.timeline ?? null,
						value.address || null,
						value.budgetCents ?? null,
						value.notes ?? "",
						now,
						now,
						guard,
					),
					...linkedIds.map((clientId) =>
						stmt(
							"INSERT INTO opportunity_clients (opportunity_id, client_id) SELECT ?, ? WHERE " +
								guardExists,
							value.id,
							clientId,
							guard,
						),
					),
					stmt(
						"INSERT INTO stage_checklists (id, opportunity_id, stage, template_id, created_at, updated_at) SELECT ?, ?, stage, id, ?, ? FROM checklist_templates WHERE type = ? AND stage = ? AND " +
							guardExists,
						crypto.randomUUID(),
						value.id,
						now,
						now,
						value.type,
						value.stage,
						guard,
					),
					...writeReferences(guard, now, "opportunity_id", value.id, value.references),
					appendHistory(guard, now, "opportunity", value.id, "create", { after: value }),
				],
			);
		},
		async saveChecklistStep(input: unknown) {
			const value = v.parse(saveChecklistStepInput, input);
			return mutation(
				value.requestId,
				{ operation: "save-checklist-step", ...value },
				{ id: value.checklistId, revision: value.revision + 1 },
				(guard, now) => [
					// Guard both the list and its visible item source; a stale save cannot resurrect a removed step or write to another opportunity's list.
					stmt(
						"UPDATE stage_checklists SET revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.archived_at IS NULL) AND EXISTS (SELECT 1 FROM checklist_items i WHERE i.id = ? AND i.revision = ? AND ((customized = 0 AND i.template_id = stage_checklists.template_id) OR (customized = 1 AND i.checklist_id = stage_checklists.id)))",
						now,
						value.checklistId,
						value.revision,
						value.itemId,
						value.itemRevision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					stmt(
						"INSERT INTO checklist_progress (checklist_id, item_id, completed_at, due_date, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ? WHERE " +
							guardExists +
							" ON CONFLICT(checklist_id, item_id) DO UPDATE SET completed_at = excluded.completed_at, due_date = excluded.due_date, revision = checklist_progress.revision + 1, updated_at = excluded.updated_at",
						value.checklistId,
						value.itemId,
						value.completed ? now : null,
						value.dueDate,
						now,
						now,
						guard,
					),
					stmt(
						"INSERT INTO history (id, record_kind, record_id, actor_user_id, effective_user_id, action, data, created_at) SELECT ?, 'opportunity', opportunity_id, ?, ?, 'save-checklist-step', ?, ? FROM stage_checklists WHERE id = ? AND " +
							guardExists,
						crypto.randomUUID(),
						user.actorUserId,
						user.effectiveUserId,
						JSON.stringify({
							checklistId: value.checklistId,
							revision: value.revision,
							itemId: value.itemId,
							completed: value.completed,
							dueDate: value.dueDate,
						}),
						now,
						value.checklistId,
						guard,
					),
				],
			);
		},
		async addChecklistItem(input: unknown) {
			const value = v.parse(addChecklistItemInput, input);
			return mutation(
				value.requestId,
				{ operation: "add-checklist-item", ...value },
				{ checklistId: value.checklistId, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						"UPDATE stage_checklists SET revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.archived_at IS NULL)",
						now,
						value.checklistId,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					stmt(
						// The checklist shows template and local items together, so a new item goes after both.
						"INSERT INTO checklist_items (id, checklist_id, title, position, created_at, updated_at) SELECT ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM checklist_items WHERE checklist_id = ? OR template_id = (SELECT template_id FROM stage_checklists WHERE id = ?)), ?, ? WHERE " +
							guardExists,
						crypto.randomUUID(),
						value.checklistId,
						value.title,
						value.checklistId,
						value.checklistId,
						now,
						now,
						guard,
					),
					appendHistory(guard, now, "opportunity", "", "add-checklist-item", {
						checklistId: value.checklistId,
						revision: value.revision,
						title: value.title,
					}),
				],
			);
		},

		async removeChecklistItem(input: unknown) {
			const value = v.parse(removeChecklistItemInput, input);
			const list = await orm
				.select()
				.from(stageChecklists)
				.where(eq(stageChecklists.id, value.checklistId))
				.then((rows) => rows[0]);
			if (!list) throw new DataConflict();
			const item = await orm
				.select()
				.from(checklistItems)
				.where(eq(checklistItems.id, value.itemId))
				.then((rows) => rows[0]);
			if (!item) throw new DataConflict();
			const removed = JSON.parse(list.removedTemplateItems || "[]") as string[];
			const isLocal = item.checklistId === value.checklistId;
			const newRemoved = isLocal ? removed : [...new Set([...removed, value.itemId])];
			return mutation(
				value.requestId,
				{ operation: "remove-checklist-item", ...value },
				{ checklistId: value.checklistId, revision: value.revision + 1 },
				(guard, now) => {
					const stmts: D1PreparedStatement[] = [
						stmt(
							"UPDATE stage_checklists SET removed_template_items = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.archived_at IS NULL)",
							JSON.stringify(newRemoved),
							now,
							value.checklistId,
							value.revision,
						),
						stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					];
					if (isLocal) {
						stmts.push(
							stmt(
								"DELETE FROM checklist_items WHERE id = ? AND checklist_id = ? AND " + guardExists,
								value.itemId,
								value.checklistId,
								guard,
							),
							stmt(
								"DELETE FROM checklist_progress WHERE checklist_id = ? AND item_id = ? AND " + guardExists,
								value.checklistId,
								value.itemId,
								guard,
							),
						);
					}
					return stmts;
				},
			);
		},

		async renameChecklistItem(input: unknown) {
			const value = v.parse(renameChecklistItemInput, input);
			const list = await orm
				.select()
				.from(stageChecklists)
				.where(eq(stageChecklists.id, value.checklistId))
				.then((rows) => rows[0]);
			if (!list) throw new DataConflict();
			const item = await orm
				.select()
				.from(checklistItems)
				.where(eq(checklistItems.id, value.itemId))
				.then((rows) => rows[0]);
			if (!item) throw new DataConflict();
			const isLocal = item.checklistId === value.checklistId;
			const removed = JSON.parse(list.removedTemplateItems || "[]") as string[];
			const newRemoved = isLocal ? removed : [...new Set([...removed, value.itemId])];
			return mutation(
				value.requestId,
				{ operation: "rename-checklist-item", ...value },
				{ checklistId: value.checklistId, revision: value.revision + 1 },
				(guard, now) => {
					const stmts: D1PreparedStatement[] = [
						stmt(
							"UPDATE stage_checklists SET removed_template_items = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.archived_at IS NULL)",
							JSON.stringify(newRemoved),
							now,
							value.checklistId,
							value.revision,
						),
						stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					];
					if (isLocal) {
						stmts.push(
							stmt(
								"UPDATE checklist_items SET title = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND checklist_id = ? AND revision = ? AND " +
									guardExists,
								value.title,
								now,
								value.itemId,
								value.checklistId,
								value.itemRevision,
								guard,
							),
						);
					} else {
						// Create a local copy with the new title in the same place, carrying over its checked-off state and due date.
						const copyId = crypto.randomUUID();
						stmts.push(
							stmt(
								"INSERT INTO checklist_items (id, checklist_id, title, position, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ? WHERE " +
									guardExists,
								copyId,
								value.checklistId,
								value.title,
								item.position,
								now,
								now,
								guard,
							),
							stmt(
								"INSERT INTO checklist_progress (checklist_id, item_id, completed_at, due_date, created_at, updated_at) SELECT checklist_id, ?, completed_at, due_date, ?, ? FROM checklist_progress WHERE checklist_id = ? AND item_id = ? AND " +
									guardExists,
								copyId,
								now,
								now,
								value.checklistId,
								value.itemId,
								guard,
							),
						);
					}
					return stmts;
				},
			);
		},

		async reorderChecklistItems(input: unknown) {
			const value = v.parse(reorderChecklistItemsInput, input);
			const list = await orm
				.select()
				.from(stageChecklists)
				.where(eq(stageChecklists.id, value.checklistId))
				.then((rows) => rows[0]);
			if (!list) throw new DataConflict();
			return mutation(
				value.requestId,
				{ operation: "reorder-checklist-items", ...value },
				{ checklistId: value.checklistId, revision: value.revision + 1 },
				(guard, now) => {
					const stmts: D1PreparedStatement[] = [
						stmt(
							"UPDATE stage_checklists SET revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.archived_at IS NULL)",
							now,
							value.checklistId,
							value.revision,
						),
						stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					];
					// Final positions overlap the current ones, so every affected item first vacates far above the list; the unique (template_id | checklist_id, position) indexes then never see a duplicate mid-update.
					stmts.push(
						stmt(
							"UPDATE checklist_items SET position = position + 10000, updated_at = ? WHERE (checklist_id = ? OR template_id = ?) AND id IN (" +
								value.itemIds.map(() => "?").join(",") +
								") AND " +
								guardExists,
							now,
							value.checklistId,
							list.templateId,
							...value.itemIds,
							guard,
						),
					);
					value.itemIds.forEach((itemId, index) => {
						stmts.push(
							stmt(
								"UPDATE checklist_items SET position = ?, updated_at = ? WHERE id = ? AND (checklist_id = ? OR template_id = ?) AND " +
									guardExists,
								index,
								now,
								itemId,
								value.checklistId,
								list.templateId,
								guard,
							),
						);
					});
					return stmts;
				},
			);
		},

		async moveStage(input: unknown) {
			const value = v.parse(moveStageInput, input);
			return mutation(
				value.requestId,
				{ operation: "move-stage", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						"UPDATE opportunities SET stage = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND archived_at IS NULL",
						value.stage,
						now,
						value.id,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					stmt(
						"INSERT INTO stage_checklists (id, opportunity_id, stage, template_id, created_at, updated_at) SELECT ?, o.id, o.stage, t.id, ?, ? FROM opportunities o JOIN checklist_templates t ON t.type = o.type AND t.stage = o.stage WHERE o.id = ? AND " +
							guardExists +
							" ON CONFLICT(opportunity_id, stage) DO NOTHING",
						crypto.randomUUID(),
						now,
						now,
						value.id,
						guard,
					),
					// Missing defaults must also roll back the stage move rather than create an unvisited current stage.
					stmt(
						"UPDATE mutation_guards SET passed = (SELECT count(*) FROM stage_checklists WHERE opportunity_id = ? AND stage = ?) WHERE id = ?",
						value.id,
						value.stage,
						guard,
					),
					appendHistory(guard, now, "opportunity", value.id, "move-stage", {
						revision: value.revision,
						stage: value.stage,
					}),
				],
			);
		},
		async saveOpportunity(input: unknown) {
			const value = v.parse(saveOpportunityInput, input);
			const before = await orm
				.select()
				.from(opportunities)
				.where(eq(opportunities.id, value.id))
				.then((rows) => rows[0]);
			if (!before) throw new DataConflict();
			const retainedLinks = await orm
				.select()
				.from(opportunityClients)
				.where(eq(opportunityClients.opportunityId, value.id));
			const beforeReferences = await orm
				.select()
				.from(recordReferences)
				.where(eq(recordReferences.opportunityId, value.id));
			const after = { ...before, ...value };
			const clientIds = value.clientIds ?? [];
			const clientIdList = clientIds.map(() => "?").join(",");
			const clientCountSql = clientIdList
				? `(SELECT count(*) FROM clients WHERE id IN (${clientIdList}) AND (archived_at IS NULL OR id IN (SELECT client_id FROM opportunity_clients WHERE opportunity_id = ?))) = ?`
				: "0 = 0";
			const clientParams = clientIdList ? [...clientIds, value.id, clientIds.length] : [];
			return mutation(
				value.requestId,
				{ operation: "save-opportunity", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						`UPDATE opportunities SET title = ?, type = ?, stage = ?, timeline = ?, address = ?, budget_cents = ?, notes = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND archived_at IS NULL AND ${clientCountSql}`,
						value.title,
						after.type,
						after.stage,
						after.timeline,
						after.address || null,
						after.budgetCents,
						after.notes,
						now,
						value.id,
						value.revision,
						...clientParams,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					stmt(
						"DELETE FROM opportunity_clients WHERE opportunity_id = ? AND " + guardExists,
						value.id,
						guard,
					),
					...clientIds.map((clientId) =>
						stmt(
							"INSERT INTO opportunity_clients (opportunity_id, client_id) SELECT ?, ? WHERE " +
								guardExists,
							value.id,
							clientId,
							guard,
						),
					),
					stmt(
						"INSERT INTO stage_checklists (id, opportunity_id, stage, template_id, created_at, updated_at) SELECT ?, o.id, o.stage, t.id, ?, ? FROM opportunities o JOIN checklist_templates t ON t.type = o.type AND t.stage = o.stage WHERE o.id = ? AND " +
							guardExists +
							" ON CONFLICT(opportunity_id, stage) DO NOTHING",
						crypto.randomUUID(),
						now,
						now,
						value.id,
						guard,
					),
					stmt(
						"UPDATE mutation_guards SET passed = (SELECT count(*) FROM stage_checklists WHERE opportunity_id = ? AND stage = ?) WHERE id = ?",
						value.id,
						after.stage,
						guard,
					),
					...writeReferences(guard, now, "opportunity_id", value.id, value.references),
					appendHistory(guard, now, "opportunity", value.id, "edit", {
						revision: value.revision,
						before: {
							...before,
							clientIds: retainedLinks.map((link) => link.clientId),
							references: beforeReferences,
						},
						after: value,
					}),
				],
			);
		},
		async archiveOpportunity(input: unknown) {
			const value = v.parse(archiveOpportunityInput, input);
			return mutation(
				value.requestId,
				{ operation: "archive-opportunity", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						"UPDATE opportunities SET archived_at = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND archived_at IS NULL",
						now,
						now,
						value.id,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					appendHistory(guard, now, "opportunity", value.id, "archive", {
						revision: value.revision,
						archivedAt: now,
					}),
				],
			);
		},
		async restoreOpportunity(input: unknown) {
			const value = v.parse(restoreOpportunityInput, input);
			return mutation(
				value.requestId,
				{ operation: "restore-opportunity", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						"UPDATE opportunities SET archived_at = null, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND archived_at IS NOT NULL",
						now,
						value.id,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					appendHistory(guard, now, "opportunity", value.id, "restore", {
						revision: value.revision,
						archivedAt: null,
					}),
				],
			);
		},
		async pinOpportunity(input: unknown) {
			const value = v.parse(pinOpportunityInput, input);
			return mutation(
				value.requestId,
				{ operation: "pin-opportunity", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					// Pinning an already-pinned opportunity (or unpinning an unpinned one) matches no row, so it conflicts like a stale revision.
					stmt(
						`UPDATE opportunities SET pinned_at = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND archived_at IS NULL AND pinned_at IS ${value.pinned ? "NULL" : "NOT NULL"}`,
						value.pinned ? now : null,
						now,
						value.id,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					appendHistory(guard, now, "opportunity", value.id, value.pinned ? "pin" : "unpin", {
						revision: value.revision,
						pinnedAt: value.pinned ? now : null,
					}),
				],
			);
		},
		async deleteOpportunity(input: unknown) {
			const value = v.parse(deleteOpportunityInput, input);
			return mutation(
				value.requestId,
				{ operation: "delete-opportunity", ...value },
				{ id: value.id, revision: value.revision },
				(guard, now) => {
					// Resolve checklist ids via subqueries in SQL since the statements builder is sync.
					return [
						// 1. checklist_progress for this opportunity's checklists
						stmt(
							"DELETE FROM checklist_progress WHERE checklist_id IN (SELECT id FROM stage_checklists WHERE opportunity_id = ?)",
							value.id,
						),
						// 2. checklist_items for this opportunity's checklists
						stmt(
							"DELETE FROM checklist_items WHERE checklist_id IN (SELECT id FROM stage_checklists WHERE opportunity_id = ?)",
							value.id,
						),
						// 3. stage_checklists for this opportunity
						stmt("DELETE FROM stage_checklists WHERE opportunity_id = ?", value.id),
						// 4. record_references for this opportunity
						stmt("DELETE FROM record_references WHERE opportunity_id = ?", value.id),
						// 5. opportunity_clients for this opportunity
						stmt("DELETE FROM opportunity_clients WHERE opportunity_id = ?", value.id),
						// 6. tasks promoted from this opportunity's checklists
						stmt("DELETE FROM tasks WHERE opportunity_id = ?", value.id),
						// 7. history for this opportunity
						stmt("DELETE FROM history WHERE record_kind = 'opportunity' AND record_id = ?", value.id),
						// 8. the opportunity itself (guarded by revision match)
						stmt("DELETE FROM opportunities WHERE id = ? AND revision = ?", value.id, value.revision),
						stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
						// append a final history row is impossible for a deleted record; skip.
					];
				},
			);
		},
		async bulkArchive(input: unknown) {
			const value = v.parse(bulkArchiveInput, input);
			const placeholders = value.clients
				.map(() => "(id = ? AND revision = ? AND archived_at IS NULL)")
				.join(" OR ");
			return mutation(
				value.requestId,
				{ operation: "bulk-archive", ...value },
				{ ids: value.clients.map((client) => client.id) },
				(guard, now) => [
					stmt(
						`INSERT INTO mutation_guards VALUES (?, CASE WHEN (SELECT count(*) FROM clients WHERE ${placeholders}) = ? THEN 1 ELSE 0 END)`,
						guard,
						...value.clients.flatMap((client) => [client.id, client.revision]),
						value.clients.length,
					),
					...value.clients.flatMap((client) => [
						stmt(
							"UPDATE clients SET archived_at = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND " +
								guardExists,
							now,
							now,
							client.id,
							client.revision,
							guard,
						),
						appendHistory(guard, now, "client", client.id, "archive", {
							revision: client.revision,
							archivedAt: now,
						}),
					]),
				],
			);
		},
		async saveClient(input: unknown) {
			const value = v.parse(saveClientInput, input);
			const before = await orm
				.select()
				.from(clients)
				.where(eq(clients.id, value.id))
				.then((rows) => rows[0]);
			if (!before) throw new DataConflict();
			// A field left out keeps what the record already holds; an explicit null clears it.
			const leadSource = value.leadSource !== undefined ? value.leadSource : before.leadSource;
			const preferences = value.preferences !== undefined ? value.preferences : before.preferences;
			const preferredContactMethod =
				value.preferredContactMethod !== undefined
					? value.preferredContactMethod
					: before.preferredContactMethod;
			// Referred by is one value in two forms: naming a form replaces the other, and the record never holds both.
			const linkProvided = value.referredByClientId !== undefined;
			const nameProvided = value.referredByName !== undefined;
			const linkGiven = linkProvided && value.referredByClientId !== null;
			const nameGiven = nameProvided && !!value.referredByName?.trim();
			if (linkGiven && nameGiven)
				throw new DataInvalid("Referred by is either a linked client or a typed name, not both.");
			let referredByClientId = before.referredByClientId;
			let referredByName = before.referredByName;
			if (linkGiven) {
				referredByClientId = value.referredByClientId ?? null;
				referredByName = null;
			} else if (nameGiven) {
				referredByClientId = null;
				referredByName = value.referredByName!.trim();
			} else if (linkProvided && nameProvided) {
				referredByClientId = null;
				referredByName = null;
			} else if (linkProvided) {
				referredByClientId = null;
			} else if (nameProvided) {
				referredByName = null;
			}
			const consentCall = value.consentCall !== undefined ? value.consentCall : before.consentCall;
			const consentText = value.consentText !== undefined ? value.consentText : before.consentText;
			const consentEmail = value.consentEmail !== undefined ? value.consentEmail : before.consentEmail;
			const consentMail = value.consentMail !== undefined ? value.consentMail : before.consentMail;
			const notes = value.notes !== undefined ? value.notes : before.notes;
			const people = value.people;
			const addresses = value.addresses;
			const relationships = value.relationships;
			const keyDates = value.keyDates;
			const tagIds = value.tagIds;
			const references = value.references;
			if (referredByClientId === value.id)
				throw new DataInvalid("A client cannot be the client that referred it.");
			for (const relationship of relationships ?? [])
				if (relationship.relatedClientId === value.id)
					throw new DataInvalid("A client cannot be related to itself.");
			if (referredByClientId) {
				const referredBy = await orm
					.select({ id: clients.id })
					.from(clients)
					.where(eq(clients.id, referredByClientId))
					.then((rows) => rows[0]);
				if (!referredBy) throw new DataConflict();
			}
			const relatedIds = [...new Set((relationships ?? []).map((row) => row.relatedClientId))];
			if (relatedIds.length) {
				const found = await orm
					.select({ id: clients.id })
					.from(clients)
					.where(inArray(clients.id, relatedIds))
					.then((rows) => rows.map((row) => row.id));
				if (found.length !== relatedIds.length) throw new DataConflict();
			}
			const beforePeople = await orm
				.select()
				.from(clientPeople)
				.where(eq(clientPeople.clientId, value.id));
			const beforeAddresses = await orm
				.select()
				.from(clientAddresses)
				.where(eq(clientAddresses.clientId, value.id));
			const beforeRelationships = await orm
				.select()
				.from(clientRelationships)
				.where(eq(clientRelationships.clientId, value.id));
			const beforeKeyDates = await orm
				.select()
				.from(clientKeyDates)
				.where(eq(clientKeyDates.clientId, value.id));
			const beforeTags = await orm
				.select({ tagId: clientTags.tagId })
				.from(clientTags)
				.where(eq(clientTags.clientId, value.id));
			return mutation(
				value.requestId,
				{ operation: "save-client", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => {
					const stmts: D1PreparedStatement[] = [];
					stmts.push(
						stmt(
							"UPDATE clients SET name = ?, lead_source = ?, preferences = ?, preferred_contact_method = ?, referred_by_client_id = ?, referred_by_name = ?, consent_call = ?, consent_text = ?, consent_email = ?, consent_mail = ?, notes = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?",
							value.name,
							leadSource,
							preferences,
							preferredContactMethod,
							referredByClientId,
							referredByName,
							consentCall ? 1 : 0,
							consentText ? 1 : 0,
							consentEmail ? 1 : 0,
							consentMail ? 1 : 0,
							notes,
							now,
							value.id,
							value.revision,
						),
					);
					stmts.push(stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard));
					// A collection that is left out keeps its rows; one that is sent replaces them.
					if (people !== undefined) {
						stmts.push(
							stmt(
								"DELETE FROM person_phones WHERE person_id IN (SELECT id FROM client_people WHERE client_id = ?)",
								value.id,
							),
							stmt(
								"DELETE FROM person_emails WHERE person_id IN (SELECT id FROM client_people WHERE client_id = ?)",
								value.id,
							),
							stmt("DELETE FROM client_people WHERE client_id = ?", value.id),
						);
						people.forEach((person, personIndex) => {
							stmts.push(
								stmt(
									"INSERT INTO client_people (id, client_id, name, birthday, position, revision, created_at, updated_at) SELECT ?, ?, ?, ?, ?, 1, ?, ? WHERE " +
										guardExists,
									person.id,
									value.id,
									person.name,
									person.birthday ?? null,
									personIndex,
									now,
									now,
									guard,
								),
							);
							(person.phones ?? []).forEach((phone, phoneIndex) => {
								stmts.push(
									stmt(
										"INSERT INTO person_phones (id, person_id, label, value, position, revision, created_at, updated_at) SELECT ?, ?, ?, ?, ?, 1, ?, ? WHERE " +
											guardExists,
										phone.id,
										person.id,
										phone.label,
										phone.value,
										phoneIndex,
										now,
										now,
										guard,
									),
								);
							});
							(person.emails ?? []).forEach((email, emailIndex) => {
								stmts.push(
									stmt(
										"INSERT INTO person_emails (id, person_id, label, value, position, revision, created_at, updated_at) SELECT ?, ?, ?, ?, ?, 1, ?, ? WHERE " +
											guardExists,
										email.id,
										person.id,
										email.label,
										email.value,
										emailIndex,
										now,
										now,
										guard,
									),
								);
							});
						});
					}
					if (addresses !== undefined) {
						stmts.push(stmt("DELETE FROM client_addresses WHERE client_id = ?", value.id));
						addresses.forEach((address, addressIndex) => {
							stmts.push(
								stmt(
									"INSERT INTO client_addresses (id, client_id, label, address, owned, position, revision, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, 1, ?, ? WHERE " +
										guardExists,
									address.id,
									value.id,
									address.label,
									address.address,
									address.owned ? 1 : 0,
									addressIndex,
									now,
									now,
									guard,
								),
							);
						});
					}
					if (relationships !== undefined) {
						stmts.push(stmt("DELETE FROM client_relationships WHERE client_id = ?", value.id));
						relationships.forEach((relationship) => {
							stmts.push(
								stmt(
									"INSERT INTO client_relationships (id, client_id, related_client_id, label, revision, created_at, updated_at) SELECT ?, ?, ?, ?, 1, ?, ? WHERE " +
										guardExists,
									relationship.id,
									value.id,
									relationship.relatedClientId,
									relationship.label,
									now,
									now,
									guard,
								),
							);
						});
					}
					if (keyDates !== undefined) {
						stmts.push(stmt("DELETE FROM client_key_dates WHERE client_id = ?", value.id));
						keyDates.forEach((keyDate) => {
							stmts.push(
								stmt(
									"INSERT INTO client_key_dates (id, client_id, name, date, revision, created_at, updated_at) SELECT ?, ?, ?, ?, 1, ?, ? WHERE " +
										guardExists,
									keyDate.id,
									value.id,
									keyDate.name,
									keyDate.date,
									now,
									now,
									guard,
								),
							);
						});
					}
					if (tagIds !== undefined) {
						stmts.push(stmt("DELETE FROM client_tags WHERE client_id = ?", value.id));
						for (const tagId of tagIds) {
							stmts.push(
								stmt(
									"INSERT INTO client_tags (client_id, tag_id) SELECT ?, ? WHERE " + guardExists,
									value.id,
									tagId,
									guard,
								),
							);
						}
					}
					stmts.push(...writeReferences(guard, now, "client_id", value.id, references));
					stmts.push(
						appendHistory(guard, now, "client", value.id, "edit", {
							revision: value.revision,
							before: {
								...before,
								people: beforePeople,
								addresses: beforeAddresses,
								relationships: beforeRelationships,
								keyDates: beforeKeyDates,
								tagIds: beforeTags.map((row) => row.tagId),
							},
							after: {
								name: value.name,
								leadSource,
								preferences,
								preferredContactMethod,
								referredByClientId,
								referredByName,
								consentCall,
								consentText,
								consentEmail,
								consentMail,
								notes,
								people: people ?? beforePeople,
								addresses: addresses ?? beforeAddresses,
								relationships: relationships ?? beforeRelationships,
								keyDates: keyDates ?? beforeKeyDates,
								tagIds: tagIds ?? beforeTags.map((row) => row.tagId),
							},
						}),
					);
					return stmts;
				},
			);
		},
	};
}

export type DataService = ReturnType<typeof createDataService>;
