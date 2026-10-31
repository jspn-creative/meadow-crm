import { readdir, readFile } from "node:fs/promises";
import { getPlatformProxy } from "@alchemy.run/cloudflare-runtime/core/platform-proxy";
import { D1 } from "@alchemy.run/cloudflare-runtime/core/bindings";
import type { D1Database } from "@cloudflare/workers-types";

// Test-only fixture initialization; application migrations are owned exclusively by Alchemy's D1 resource.
export async function createTestDatabase() {
	const proxy = await getPlatformProxy<{ DB: D1Database }>({
		name: `meadow-test-${crypto.randomUUID()}`,
		bindings: [D1.local({ binding: "DB", id: crypto.randomUUID() })],
		persist: false,
	});
	try {
		const root = new URL("../../../../migrations/", import.meta.url);
		const directories = (await readdir(root, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
			.map((entry) => entry.name)
			.sort();
		if (!directories.length)
			throw new Error("Generate the schema with alchemy dev before running DB tests.");
		for (const directory of directories) {
			const sql = await readFile(new URL(`${directory}/migration.sql`, root), "utf8");
			const statements = sql
				.split("--> statement-breakpoint")
				.map((statement) => statement.trim())
				.filter(Boolean);
			await proxy.env.DB.batch(statements.map((statement) => proxy.env.DB.prepare(statement)));
		}
		return proxy;
	} catch (error) {
		await proxy.dispose();
		throw error;
	}
}
