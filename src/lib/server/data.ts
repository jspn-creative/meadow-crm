import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { eq, isNull, isNotNull } from "drizzle-orm";
import * as v from "valibot";
import type { BusinessIdentity } from "./identity.ts";
import { businessDate } from "../data/attention.ts";
import {
	businessSettings,
	clients,
	opportunities,
	opportunityClients,
	stageChecklists,
	checklistItems,
	checklistProgress,
} from "./db/schema.ts";
import {
	bulkArchiveInput,
	createClientInput,
	createOpportunityInput,
	saveChecklistStepInput,
	moveStageInput,
	saveOpportunityInput,
	workspaceInput,
} from "./validation.ts";

export class DataConflict extends Error {
	constructor() {
		super(
			"This record changed or a linked record is unavailable. Refresh and reselect before saving.",
		);
	}
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

	return {
		identity: user,
		async workspace(input: unknown) {
			const { archived } = v.parse(workspaceInput, input);
			const [clientRows, opportunityRows, settings, links, checklists, items, progress] =
				await Promise.all([
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
				]);
			return {
				identity: user,
				businessToday: businessDate(settings[0]?.timezone ?? "America/New_York"),
				clients: clientRows,
				opportunities: opportunityRows,
				links: links.filter((link) => opportunityRows.some((row) => row.id === link.opportunityId)),
				checklists: checklists
					.filter((list) => opportunityRows.some((row) => row.id === list.opportunityId))
					.map((list) => ({
						...list,
						items: items
							.filter((item) =>
								list.customized ? item.checklistId === list.id : item.templateId === list.templateId,
							)
							.sort((a, b) => a.position - b.position)
							.map((item) => {
								const saved = progress.find((row) => row.checklistId === list.id && row.itemId === item.id);
								return {
									...item,
									completedAt: saved?.completedAt ?? null,
									dueDate: saved?.dueDate ?? null,
								};
							}),
					})),
				settings: settings[0] ?? null,
			};
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
						"INSERT INTO clients (id, name, created_at, updated_at) SELECT ?, ?, ?, ? WHERE " +
							guardExists,
						value.id,
						value.name,
						now,
						now,
						guard,
					),
					appendHistory(guard, now, "client", value.id, "create", { after: { name: value.name } }),
				],
			);
		},
		async createOpportunity(input: unknown) {
			const value = v.parse(createOpportunityInput, input);
			return mutation(
				value.requestId,
				{ operation: "create-opportunity", ...value },
				{ id: value.id, revision: 1 },
				(guard, now) => [
					stmt(
						"INSERT INTO mutation_guards VALUES (?, CASE WHEN NOT EXISTS (SELECT 1 FROM opportunities WHERE id = ?) AND EXISTS (SELECT 1 FROM clients WHERE id = ? AND archived_at IS NULL) AND EXISTS (SELECT 1 FROM checklist_templates WHERE type = ? AND stage = ?) THEN 1 ELSE 0 END)",
						guard,
						value.id,
						value.clientId,
						value.type,
						value.stage,
					),
					stmt(
						"INSERT INTO opportunities (id, title, type, stage, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ? WHERE " +
							guardExists,
						value.id,
						value.title,
						value.type,
						value.stage,
						now,
						now,
						guard,
					),
					stmt(
						"INSERT INTO opportunity_clients (opportunity_id, client_id) SELECT ?, ? WHERE " +
							guardExists,
						value.id,
						value.clientId,
						guard,
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
			return mutation(
				value.requestId,
				{ operation: "save-opportunity", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						"UPDATE opportunities SET title = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?",
						value.title,
						now,
						value.id,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					stmt(
						"DELETE FROM opportunity_clients WHERE opportunity_id = ? AND " + guardExists,
						value.id,
						guard,
					),
					...value.clientIds.map((clientId) =>
						stmt(
							"INSERT INTO opportunity_clients (opportunity_id, client_id) SELECT ?, ? WHERE " +
								guardExists,
							value.id,
							clientId,
							guard,
						),
					),
					appendHistory(guard, now, "opportunity", value.id, "edit", {
						revision: value.revision,
						after: { title: value.title, clientIds: value.clientIds },
					}),
				],
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
	};
}

export type DataService = ReturnType<typeof createDataService>;
