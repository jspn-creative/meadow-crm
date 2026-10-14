import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { getPlatformProxy } from "wrangler";
import type { D1Database } from "@cloudflare/workers-types";
import { readMigrations } from "../../../../scripts/migrations.ts";
import { seedFictional } from "../../../../scripts/fictional-seed.ts";
import { createDataService, DataConflict } from "../data.ts";
import { resolveLocalIdentity } from "../identity.ts";
import { migrate } from "./migrate.ts";
import { seedDefaults } from "./seed.ts";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
let db: D1Database;
let realtor: ReturnType<typeof createDataService>;
let assistant: ReturnType<typeof createDataService>;
const opportunityId = "fictional-opportunity-maple";

test("persisted slice inherits defaults and retains guarded step saves across stage visits", async () => {
	const clientId = crypto.randomUUID();
	const id = crypto.randomUUID();
	await realtor.createClient({
		requestId: crypto.randomUUID(),
		id: clientId,
		name: "Independent slice client",
	});
	const creation = {
		requestId: crypto.randomUUID(),
		id,
		clientId,
		title: "Slice buyer",
		type: "buyer",
		stage: "active-lead",
	};
	await realtor.createOpportunity(creation);
	await realtor.createOpportunity(creation);
	let workspace = await realtor.workspace({ archived: false });
	expect(workspace.links.filter((link) => link.opportunityId === id)).toEqual([
		{ opportunityId: id, clientId },
	]);
	const list = workspace.checklists.find((row) => row.opportunityId === id)!;
	expect(list.stage).toBe("active-lead");
	expect(list.items.length).toBeGreaterThan(0);
	const item = list.items[0]!;
	const save = {
		requestId: crypto.randomUUID(),
		checklistId: list.id,
		revision: list.revision,
		itemId: item.id,
		itemRevision: item.revision,
		completed: true,
		dueDate: "2026-10-20",
	};
	await realtor.saveChecklistStep(save);
	await realtor.saveChecklistStep(save);
	await expect(
		realtor.saveChecklistStep({ ...save, requestId: crypto.randomUUID(), dueDate: "2026-10-21" }),
	).rejects.toBeInstanceOf(DataConflict);
	await expect(
		realtor.saveChecklistStep({
			...save,
			requestId: crypto.randomUUID(),
			revision: list.revision + 1,
			dueDate: "2026-02-30",
		}),
	).rejects.toThrow();
	await realtor.moveStage({
		requestId: crypto.randomUUID(),
		id,
		revision: 1,
		stage: "under-contract",
	});
	await realtor.moveStage({ requestId: crypto.randomUUID(), id, revision: 2, stage: "active-lead" });
	workspace = await realtor.workspace({ archived: false });
	expect(workspace.checklists.filter((row) => row.opportunityId === id)).toHaveLength(2);
	const saved = workspace.checklists.find((row) => row.id === list.id)!;
	expect(saved.revision).toBe(list.revision + 1);
	expect(saved.items[0]!.dueDate).toBe("2026-10-20");
	expect(saved.items[0]!.completedAt).not.toBeNull();
	expect(
		await db
			.prepare(
				"SELECT count(*) AS n FROM history WHERE record_id = ? AND action = 'save-checklist-step'",
			)
			.bind(id)
			.first("n"),
	).toBe(1);
	await expect(
		realtor.createOpportunity({
			...creation,
			requestId: crypto.randomUUID(),
			id: crypto.randomUUID(),
			clientId: "missing-client",
		}),
	).rejects.toBeInstanceOf(DataConflict);
});

beforeAll(async () => {
	proxy = await getPlatformProxy<{ DB: D1Database }>({
		configPath: "wrangler.jsonc",
		persist: false,
	});
	db = proxy.env.DB;
	await migrate(db, await readMigrations());
	await seedDefaults(db);
	await seedFictional(db, "2026-10-13");
	realtor = createDataService(db, {
		actorUserId: "business-realtor",
		effectiveUserId: "business-realtor",
		role: "realtor",
	});
	assistant = createDataService(db, {
		actorUserId: "support-admin",
		effectiveUserId: "business-assistant",
		role: "assistant",
	});
}, 30_000);
afterAll(async () => {
	await proxy?.dispose();
});

async function snapshot() {
	return {
		opportunity: await db
			.prepare("SELECT * FROM opportunities WHERE id = ?")
			.bind(opportunityId)
			.first(),
		links: (
			await db
				.prepare("SELECT * FROM opportunity_clients WHERE opportunity_id = ? ORDER BY client_id")
				.bind(opportunityId)
				.all()
		).results,
		history: (await db.prepare("SELECT * FROM history ORDER BY id").all()).results,
		receipts: (await db.prepare("SELECT * FROM mutation_receipts ORDER BY id").all()).results,
	};
}

test("local identity is explicit server configuration and always fails closed in production or on non-loopback hosts", () => {
	expect(
		resolveLocalIdentity(true, new URL("http://127.0.0.1:5180"), "assistant")?.effectiveUserId,
	).toBe("business-assistant");
	for (const user of ["realtor", "assistant", "admin", undefined]) {
		expect(resolveLocalIdentity(false, new URL("http://localhost"), user)).toBeNull();
		expect(resolveLocalIdentity(true, new URL("https://meadow.example"), user)).toBeNull();
	}
	expect(resolveLocalIdentity(true, new URL("http://localhost"), "admin")).toBeNull();
});

test("zero-row stale update changes neither the opportunity, its links, history, nor receipts", async () => {
	const before = await snapshot();
	await expect(
		realtor.saveOpportunity({
			requestId: "stale-save",
			id: opportunityId,
			revision: 99,
			title: "Stale title",
			clientIds: ["fictional-client-inez"],
		}),
	).rejects.toBeInstanceOf(DataConflict);
	expect(await snapshot()).toEqual(before);
	expect((await db.prepare("SELECT count(*) AS n FROM mutation_guards").first())?.n).toBe(0);
});

test("invalid links roll back even a successful primary revision update", async () => {
	const before = await snapshot();
	await expect(
		realtor.saveOpportunity({
			requestId: "bad-link",
			id: opportunityId,
			revision: 1,
			title: "Invalid link",
			clientIds: ["missing-client"],
		}),
	).rejects.toBeInstanceOf(DataConflict);
	expect(await snapshot()).toEqual(before);
});

test("successful and concurrent retries commit once and reject altered payload or actor", async () => {
	const value = {
		requestId: "save-once",
		id: opportunityId,
		revision: 1,
		title: "Saved Maple title",
		clientIds: ["fictional-client-ada", "fictional-client-inez"],
	};
	const [first, retry] = await Promise.all([
		assistant.saveOpportunity(value),
		assistant.saveOpportunity(value),
	]);
	expect(retry).toEqual(first);
	expect(await assistant.saveOpportunity(value)).toEqual(first);
	expect(
		(await db.prepare("SELECT revision FROM opportunities WHERE id = ?").bind(opportunityId).first())
			?.revision,
	).toBe(2);
	expect(
		(
			await db
				.prepare("SELECT count(*) AS n FROM history WHERE record_id = ? AND action = 'edit'")
				.bind(opportunityId)
				.first()
		)?.n,
	).toBe(1);
	expect(
		await db
			.prepare("SELECT actor_user_id, effective_user_id FROM history WHERE action = 'edit'")
			.first(),
	).toEqual({ actor_user_id: "support-admin", effective_user_id: "business-assistant" });
	await expect(assistant.saveOpportunity({ ...value, title: "Different payload" })).rejects.toThrow(
		/request ID/,
	);
	await expect(realtor.saveOpportunity(value)).rejects.toThrow(/identity/);
});

test("stage moves visit defaults, retain previous progress, reject stale movement, and roll back missing defaults", async () => {
	const progress = (
		await db.prepare("SELECT * FROM checklist_progress ORDER BY checklist_id, item_id").all()
	).results;
	await realtor.moveStage({
		requestId: "move-active",
		id: opportunityId,
		revision: 2,
		stage: "active-lead",
	});
	await expect(
		realtor.moveStage({ requestId: "move-stale", id: opportunityId, revision: 2, stage: "closed" }),
	).rejects.toBeInstanceOf(DataConflict);
	await realtor.moveStage({
		requestId: "move-back",
		id: opportunityId,
		revision: 3,
		stage: "new-lead",
	});
	expect(
		(await db.prepare("SELECT * FROM checklist_progress ORDER BY checklist_id, item_id").all())
			.results,
	).toEqual(progress);
	expect(
		(
			await db
				.prepare("SELECT count(*) AS n FROM stage_checklists WHERE opportunity_id = ?")
				.bind(opportunityId)
				.first()
		)?.n,
	).toBe(2);
	await db.prepare("DELETE FROM checklist_items WHERE template_id = 'default-buyer-closed'").run();
	await db.prepare("DELETE FROM checklist_templates WHERE id = 'default-buyer-closed'").run();
	const before = await snapshot();
	await expect(
		realtor.moveStage({
			requestId: "move-missing-default",
			id: opportunityId,
			revision: 4,
			stage: "closed",
		}),
	).rejects.toBeInstanceOf(DataConflict);
	expect(await snapshot()).toEqual(before);
});

test("one stale or missing selected client prevents every bulk record and history change", async () => {
	const before = (await db.prepare("SELECT * FROM clients ORDER BY id").all()).results;
	const historyBefore = (await db.prepare("SELECT * FROM history ORDER BY id").all()).results;
	for (const row of [
		{ id: "fictional-client-eli", revision: 99 },
		{ id: "missing-client", revision: 1 },
	]) {
		await expect(
			assistant.bulkArchive({
				requestId: `bulk-${row.id}`,
				clients: [{ id: "fictional-client-ada", revision: 1 }, row],
			}),
		).rejects.toBeInstanceOf(DataConflict);
	}
	expect((await db.prepare("SELECT * FROM clients ORDER BY id").all()).results).toEqual(before);
	expect((await db.prepare("SELECT * FROM history ORDER BY id").all()).results).toEqual(
		historyBefore,
	);
	const input = {
		requestId: "bulk-good",
		clients: [
			{ id: "fictional-client-ada", revision: 1 },
			{ id: "fictional-client-eli", revision: 1 },
		],
	};
	await assistant.bulkArchive(input);
	await assistant.bulkArchive(input);
	expect(
		(await db.prepare("SELECT count(*) AS n FROM history WHERE action = 'archive'").first())?.n,
	).toBe(2);
	expect(
		(
			await db
				.prepare("SELECT count(*) AS n FROM opportunity_clients WHERE opportunity_id = ?")
				.bind(opportunityId)
				.first()
		)?.n,
	).toBe(2);
});

test("strict validation rejects forged identities and duplicate links; request-scoped services retain independent identities", async () => {
	await expect(
		realtor.createClient({
			requestId: "forged",
			id: "new-client",
			name: "Client",
			actorUserId: "admin",
		}),
	).rejects.toThrow();
	await expect(
		realtor.saveOpportunity({
			requestId: "duplicate-link",
			id: opportunityId,
			revision: 4,
			title: "Client",
			clientIds: ["fictional-client-ada", "fictional-client-ada"],
		}),
	).rejects.toThrow();
	await realtor.createClient({ requestId: "new-client-once", id: "new-client", name: "Client" });
	const [a, b] = await Promise.all([
		realtor.workspace({ archived: false }),
		assistant.workspace({ archived: false }),
	]);
	expect(a.identity.effectiveUserId).toBe("business-realtor");
	expect(b.identity.effectiveUserId).toBe("business-assistant");
	expect(a.clients).toEqual(b.clients);
	expect(
		(await db.prepare("SELECT actor_user_id FROM history WHERE record_id = 'new-client'").first())
			?.actor_user_id,
	).toBe("business-realtor");
});
