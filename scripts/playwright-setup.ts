import { localD1Database } from "./local-d1.ts";
import { seedDefaults } from "../src/lib/server/db/seed.ts";
import { seedFictional } from "./fictional-seed.ts";

// Existing shell tests require their fictional records after Alchemy has provisioned and migrated local D1.
export default async function setup() {
	const proxy = await localD1Database();
	try {
		await seedDefaults(proxy.env.DB);
		await seedFictional(proxy.env.DB, "2026-10-13");
	} finally {
		await proxy.dispose();
	}
}
