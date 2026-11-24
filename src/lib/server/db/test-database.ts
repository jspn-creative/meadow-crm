import { readdir, readFile } from "node:fs/promises";
import { getPlatformProxy } from "@alchemy.run/cloudflare-runtime/core/platform-proxy";
import { D1 } from "@alchemy.run/cloudflare-runtime/core/bindings";
import type { D1Database } from "@cloudflare/workers-types";

/** Splits at semicolons outside quotes and comments, because reviewed data migrations have no breakpoints and one of them is larger than a single D1 statement allows. Migrations hold no triggers, whose bodies this would cut. */
function splitStatements(sql: string) {
	const statements: string[] = [];
	let start = 0;
	for (let i = 0; i < sql.length; i++) {
		const char = sql[i];
		if (char === "'" || char === '"') {
			const end = sql.indexOf(char, i + 1);
			i = end < 0 ? sql.length : end;
		} else if (char === "-" && sql[i + 1] === "-") {
			const end = sql.indexOf("\n", i);
			i = end < 0 ? sql.length : end;
		} else if (char === "/" && sql[i + 1] === "*") {
			const end = sql.indexOf("*/", i + 2);
			i = end < 0 ? sql.length : end + 1;
		} else if (char === ";") {
			statements.push(sql.slice(start, i + 1));
			start = i + 1;
		}
	}
	statements.push(sql.slice(start));
	return statements;
}

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
				.flatMap(splitStatements)
				.map((statement) => statement.trim())
				.filter((statement) => statement.replace(/--[^\n]*/g, "").trim());
			await proxy.env.DB.batch(statements.map((statement) => proxy.env.DB.prepare(statement)));
		}
		return proxy;
	} catch (error) {
		await proxy.dispose();
		throw error;
	}
}
