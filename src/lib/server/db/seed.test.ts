import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { createTestDatabase } from "./test-database.ts";
import type { D1Database } from "@cloudflare/workers-types";
import { resetFictional, seedFictional } from "../../../../scripts/fictional-seed.ts";
import { defaultChecklists, defaultItemId } from "./defaults.ts";
import { seedDefaults } from "./seed.ts";

let proxy: Awaited<ReturnType<typeof createTestDatabase>>;
let db: D1Database;
const now = "2026-10-13T12:00:00.000Z";

beforeAll(async () => {
	proxy = await createTestDatabase();
	db = proxy.env.DB;
}, 30_000);
afterAll(async () => {
	await proxy?.dispose();
});

test("production defaults exactly preserve all 16 documented checklists and do not seed fictional records", async () => {
	const doc = await readFile(new URL("../../../../docs/checklists.md", import.meta.url), "utf8");
	const documentedTitles = doc
		.split("## Editing notes")[0]
		.split("\n")
		.filter((line) => line.startsWith("- "))
		.map((line) => line.slice(2));
	const defaults = Object.values(defaultChecklists).flatMap((type) =>
		Object.values(type).flatMap((items) => items.map(([, title]) => title)),
	);
	expect(defaults).toEqual(documentedTitles);
	await seedDefaults(db, now);
	expect((await db.prepare("SELECT count(*) AS n FROM checklist_templates").first())?.n).toBe(16);
	expect((await db.prepare("SELECT count(*) AS n FROM checklist_items").first())?.n).toBe(
		defaults.length,
	);
	expect((await db.prepare("SELECT name FROM tags ORDER BY name").all()).results).toEqual([
		{ name: "nurture" },
		{ name: "sphere" },
	]);
	for (const table of ["clients", "opportunities", "tasks", "stage_checklists", "history"])
		expect((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first())?.n).toBe(0);
});

test("repeat defaults preserve edits, removed steps, empty templates, tag changes, and settings", async () => {
	await db
		.prepare("UPDATE checklist_items SET title = 'Edited default', revision = 2 WHERE id = ?")
		.bind(defaultItemId("buyer", "new-lead", "01"))
		.run();
	await db
		.prepare("DELETE FROM checklist_items WHERE id = ?")
		.bind(defaultItemId("buyer", "new-lead", "02"))
		.run();
	await db
		.prepare("DELETE FROM checklist_items WHERE template_id = 'default-construction-active-lead'")
		.run();
	await db
		.prepare("UPDATE tags SET name = 'sphere edited', retired_at = ? WHERE id = 'tag-sphere'")
		.bind(now)
		.run();
	await db.prepare("UPDATE business_settings SET timezone = 'America/Chicago'").run();
	await seedDefaults(db, "2027-01-01T12:00:00.000Z");
	expect(
		(
			await db
				.prepare("SELECT title FROM checklist_items WHERE id = ?")
				.bind(defaultItemId("buyer", "new-lead", "01"))
				.first()
		)?.title,
	).toBe("Edited default");
	expect(
		await db
			.prepare("SELECT id FROM checklist_items WHERE id = ?")
			.bind(defaultItemId("buyer", "new-lead", "02"))
			.first(),
	).toBeNull();
	expect(
		(
			await db
				.prepare(
					"SELECT count(*) AS n FROM checklist_items WHERE template_id = 'default-construction-active-lead'",
				)
				.first()
		)?.n,
	).toBe(0);
	expect((await db.prepare("SELECT name FROM tags WHERE id = 'tag-sphere'").first())?.name).toBe(
		"sphere edited",
	);
	expect((await db.prepare("SELECT timezone FROM business_settings").first())?.timezone).toBe(
		"America/Chicago",
	);
});

test("fictional fixtures are mixed, relative-dated, multi-client, archived, and idempotent without overwriting edits", async () => {
	await seedFictional(db, "2026-10-13");
	expect(
		(await db.prepare("SELECT DISTINCT type FROM opportunities ORDER BY type").all()).results.map(
			(row) => row.type,
		),
	).toEqual(["buyer", "construction", "estate-sale", "seller"]);
	expect(
		(await db.prepare("SELECT DISTINCT stage FROM opportunities ORDER BY stage").all()).results,
	).toHaveLength(4);
	expect(
		(
			await db
				.prepare(
					"SELECT count(*) AS n FROM opportunity_clients WHERE opportunity_id = 'fictional-opportunity-maple'",
				)
				.first()
		)?.n,
	).toBe(2);
	expect(
		(
			await db.prepare("SELECT count(*) AS n FROM opportunities WHERE archived_at IS NOT NULL").first()
		)?.n,
	).toBe(1);
	expect(
		(
			await db
				.prepare(
					"SELECT count(*) AS n FROM stage_checklists WHERE opportunity_id = 'fictional-opportunity-birch'",
				)
				.first()
		)?.n,
	).toBe(2);
	expect(
		(await db.prepare("SELECT DISTINCT due_date FROM checklist_progress ORDER BY due_date").all())
			.results,
	).toEqual(
		["2026-10-10", "2026-10-12", "2026-10-13", "2026-10-14"].map((due_date) => ({ due_date })),
	);
	await db
		.prepare("UPDATE clients SET name = 'Local edited fixture' WHERE id = 'fictional-client-ada'")
		.run();
	await db
		.prepare("UPDATE tasks SET title = 'Local edited task' WHERE id = 'fictional-task-call'")
		.run();
	await seedFictional(db, "2026-12-01");
	expect((await db.prepare("SELECT count(*) AS n FROM clients").first())?.n).toBe(6);
	expect(
		(await db.prepare("SELECT name FROM clients WHERE id = 'fictional-client-ada'").first())?.name,
	).toBe("Local edited fixture");
	expect(
		await db.prepare("SELECT title, due_date FROM tasks WHERE id = 'fictional-task-call'").first(),
	).toEqual({ title: "Local edited task", due_date: "2026-10-12" });
	expect((await db.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
});

test("reset refuses user-owned dependencies and otherwise retains non-fictional records and defaults", async () => {
	await db
		.prepare(
			"INSERT INTO clients (id, name, created_at, updated_at) VALUES ('local-client', 'User created', ?, ?)",
		)
		.bind(now, now)
		.run();
	await db
		.prepare(
			"INSERT INTO opportunities (id, title, type, stage, created_at, updated_at) VALUES ('local-opportunity', 'User created', 'buyer', 'new-lead', ?, ?)",
		)
		.bind(now, now)
		.run();
	await db
		.prepare("INSERT INTO opportunity_clients VALUES ('local-opportunity', 'fictional-client-ada')")
		.run();
	await expect(resetFictional(db)).rejects.toThrow(/user-created records/);
	expect(
		(await db.prepare("SELECT count(*) AS n FROM clients WHERE fictional = 1").first())?.n,
	).toBe(6);
	await db
		.prepare("DELETE FROM opportunity_clients WHERE opportunity_id = 'local-opportunity'")
		.run();
	await resetFictional(db);
	expect((await db.prepare("SELECT name FROM clients").first())?.name).toBe("User created");
	expect((await db.prepare("SELECT count(*) AS n FROM opportunities").first())?.n).toBe(1);
	expect((await db.prepare("SELECT count(*) AS n FROM checklist_templates").first())?.n).toBe(16);
	expect((await db.prepare("SELECT count(*) AS n FROM tags").first())?.n).toBe(2);
	await seedFictional(db, "2026-12-01");
	expect(
		(await db.prepare("SELECT due_date FROM tasks WHERE id = 'fictional-task-call'").first())
			?.due_date,
	).toBe("2026-11-30");
	expect((await db.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
});
