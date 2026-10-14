import { readdir, readFile } from "node:fs/promises";
import type { Migration } from "../src/lib/server/db/migrate.ts";

export async function readMigrations(): Promise<Migration[]> {
	const directory = new URL("../drizzle/", import.meta.url);
	const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
	return Promise.all(
		names.map(async (name) => ({ name, sql: await readFile(new URL(name, directory), "utf8") })),
	);
}
