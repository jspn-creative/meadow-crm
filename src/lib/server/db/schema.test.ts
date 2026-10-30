import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { getPlatformProxy } from "wrangler";
import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { readMigrations } from "../../../../scripts/migrations.ts";
import { migrate } from "./migrate.ts";
import { clients, opportunities } from "./schema.ts";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
let db: D1Database;
const now = "2026-10-13T12:00:00.000Z";

beforeAll(async () => {
	proxy = await getPlatformProxy<{ DB: D1Database }>({
		configPath: "wrangler.jsonc",
		persist: false,
	});
	db = proxy.env.DB;
	await migrate(db, await readMigrations());
}, 30_000);

afterAll(async () => {
	await proxy?.dispose();
});

test("fresh and repeated local migrations retain records and have no broken foreign keys", async () => {
	const orm = drizzle(db);
	await orm
		.insert(clients)
		.values({ id: "client-a", name: "Fictional client", createdAt: now, updatedAt: now });
	await orm.insert(opportunities).values({
		id: "opportunity-a",
		title: "Fictional engagement",
		type: "buyer",
		stage: "active-lead",
		budgetCents: 12500050,
		createdAt: now,
		updatedAt: now,
	});
	await migrate(db, await readMigrations());
	expect(
		(await db.prepare("SELECT count(*) AS n FROM meadow_migrations").first<{ n: number }>())?.n,
	).toBe(7);
	expect(
		(await db.prepare("SELECT budget_cents FROM opportunities WHERE id = 'opportunity-a'").first())
			?.budget_cents,
	).toBe(12500050);
	expect((await db.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
});

test("D1 rejects invalid enum, money, revision, relationship, and duplicate link writes", async () => {
	for (const query of [
		"UPDATE opportunities SET stage = 'pending' WHERE id = 'opportunity-a'",
		"UPDATE opportunities SET type = 'other' WHERE id = 'opportunity-a'",
		"UPDATE opportunities SET timeline = 'tomorrow' WHERE id = 'opportunity-a'",
		"UPDATE opportunities SET budget_cents = 1.5 WHERE id = 'opportunity-a'",
		"UPDATE opportunities SET revision = 0 WHERE id = 'opportunity-a'",
		"INSERT INTO opportunity_clients VALUES ('opportunity-a', 'missing')",
	])
		await expect(db.prepare(query).run()).rejects.toThrow();
	await db.prepare("INSERT INTO opportunity_clients VALUES ('opportunity-a', 'client-a')").run();
	await expect(
		db.prepare("INSERT INTO opportunity_clients VALUES ('opportunity-a', 'client-a')").run(),
	).rejects.toThrow();
	await db.prepare("UPDATE clients SET archived_at = ? WHERE id = 'client-a'").bind(now).run();
	expect((await db.prepare("SELECT count(*) AS n FROM opportunity_clients").first())?.n).toBe(1);
	expect(
		(await db.prepare("SELECT archived_at FROM opportunities WHERE id = 'opportunity-a'").first())
			?.archived_at,
	).toBeNull();
});

test("visited-stage sources, stable item IDs, overrides, and progress cannot cross stages", async () => {
	for (const [id, stage] of [
		["template-a", "active-lead"],
		["template-b", "closed"],
	]) {
		await db
			.prepare(
				"INSERT INTO checklist_templates (id, type, stage, created_at, updated_at) VALUES (?, 'buyer', ?, ?, ?)",
			)
			.bind(id, stage, now, now)
			.run();
		await db
			.prepare(
				"INSERT INTO checklist_items (id, template_id, title, position, created_at, updated_at) VALUES (?, ?, 'Step', 0, ?, ?)",
			)
			.bind(`${id}-item`, id, now, now)
			.run();
	}
	await db
		.prepare(
			"INSERT INTO stage_checklists (id, opportunity_id, stage, template_id, created_at, updated_at) VALUES ('checklist-a', 'opportunity-a', 'active-lead', 'template-a', ?, ?)",
		)
		.bind(now, now)
		.run();
	await expect(
		db
			.prepare(
				"INSERT INTO stage_checklists (id, opportunity_id, stage, template_id, created_at, updated_at) VALUES ('wrong', 'opportunity-a', 'closed', 'template-a', ?, ?)",
			)
			.bind(now, now)
			.run(),
	).rejects.toThrow();
	const progress = (item: string) =>
		db
			.prepare(
				"INSERT INTO checklist_progress (checklist_id, item_id, due_date, created_at, updated_at) VALUES ('checklist-a', ?, '2026-10-12', ?, ?)",
			)
			.bind(item, now, now)
			.run();
	await expect(progress("template-b-item")).rejects.toThrow(/stage source/);
	await progress("template-a-item");
	await db
		.prepare(
			"UPDATE checklist_items SET title = 'Renamed', position = 1 WHERE id = 'template-a-item'",
		)
		.run();
	expect((await db.prepare("SELECT due_date FROM checklist_progress").first())?.due_date).toBe(
		"2026-10-12",
	);
	await expect(
		db.prepare("DELETE FROM checklist_items WHERE id = 'template-a-item'").run(),
	).rejects.toThrow();
	await db.prepare("DELETE FROM checklist_progress").run();
	await db
		.prepare(
			"INSERT INTO checklist_items (id, checklist_id, title, position, created_at, updated_at) VALUES ('override-a', 'checklist-a', 'Custom step', 0, ?, ?)",
		)
		.bind(now, now)
		.run();
	await progress("override-a");
	await progress("template-a-item");
});

test("history requires both identities and tasks reject assistant assignment or malformed references", async () => {
	await db
		.prepare(
			"INSERT INTO history (id, record_kind, record_id, actor_user_id, effective_user_id, action, data, created_at) VALUES ('history-a', 'opportunity', 'opportunity-a', 'support-admin', 'business-assistant', 'edit', '{}', ?)",
		)
		.bind(now)
		.run();
	expect(await db.prepare("SELECT actor_user_id, effective_user_id FROM history").first()).toEqual({
		actor_user_id: "support-admin",
		effective_user_id: "business-assistant",
	});
	await expect(db.prepare("UPDATE history SET effective_user_id = ''").run()).rejects.toThrow();
	await expect(
		db
			.prepare(
				"INSERT INTO tasks (id, title, assigned_user_id, assigned_role, created_at, updated_at) VALUES ('task-a', 'Task', 'assistant', 'assistant', ?, ?)",
			)
			.bind(now, now)
			.run(),
	).rejects.toThrow();
	await expect(
		db
			.prepare(
				"INSERT INTO record_references (id, opportunity_id, label, kind, url, created_at, updated_at) VALUES ('ref-a', 'opportunity-a', 'Unsafe', 'url', 'javascript:alert(1)', ?, ?)",
			)
			.bind(now, now)
			.run(),
	).rejects.toThrow();
});
