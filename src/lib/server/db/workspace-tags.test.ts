import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { getPlatformProxy } from "wrangler";
import type { D1Database } from "@cloudflare/workers-types";
import { readMigrations } from "../../../../scripts/migrations.ts";
import { seedFictional } from "../../../../scripts/fictional-seed.ts";
import { createDataService } from "../data.ts";
import { migrate } from "./migrate.ts";
import { seedDefaults } from "./seed.ts";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
let db: D1Database;
let service: ReturnType<typeof createDataService>;

beforeAll(async () => {
	proxy = await getPlatformProxy<{ DB: D1Database }>({
		configPath: "wrangler.jsonc",
		persist: false,
	});
	db = proxy.env.DB;
	await migrate(db, await readMigrations());
	await seedDefaults(db);
	await seedFictional(db, "2026-10-13");
	service = createDataService(db, {
		actorUserId: "business-realtor",
		effectiveUserId: "business-realtor",
		role: "realtor",
	});
}, 30_000);

afterAll(async () => {
	await proxy?.dispose();
});

test("workspace exposes each client's non-retired tags on referenceClients", async () => {
	let workspace = await service.workspace({ archived: false });
	const byClient = new Map(workspace.referenceClients.map((client) => [client.id, client]));

	expect(byClient.get("fictional-client-ada")!.tags).toEqual([
		{ id: "tag-sphere", name: "sphere", color: "#6b7c5e" },
	]);
	expect(byClient.get("fictional-client-eli")!.tags).toEqual([
		{ id: "tag-sphere", name: "sphere", color: "#6b7c5e" },
	]);
	expect(byClient.get("fictional-client-mira")!.tags).toEqual([
		{ id: "tag-nurture", name: "nurture", color: "#b89b5e" },
	]);

	for (const client of workspace.referenceClients) {
		for (const tag of client.tags) {
			expect(Object.keys(tag).sort()).toEqual(["color", "id", "name"]);
		}
	}

	// A retired tag stops being exposed without removing the underlying link.
	await db
		.prepare("UPDATE tags SET retired_at = ? WHERE id = 'tag-nurture'")
		.bind("2026-10-13T12:00:00.000Z")
		.run();
	workspace = await service.workspace({ archived: false });
	expect(
		workspace.referenceClients.find((client) => client.id === "fictional-client-mira")!.tags,
	).toEqual([]);
	expect(
		workspace.referenceClients.find((client) => client.id === "fictional-client-ada")!.tags,
	).toEqual([{ id: "tag-sphere", name: "sphere", color: "#6b7c5e" }]);
});
