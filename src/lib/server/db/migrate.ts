import type { D1Database } from "@cloudflare/workers-types";

export interface Migration {
	name: string;
	sql: string;
}

// D1 batches are atomic; a migration and its receipt either both commit or both roll back.
export async function migrate(db: D1Database, migrations: Migration[]) {
	await db
		.prepare(
			"CREATE TABLE IF NOT EXISTS meadow_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
		)
		.run();
	for (const migration of migrations) {
		if (
			await db
				.prepare("SELECT name FROM meadow_migrations WHERE name = ?")
				.bind(migration.name)
				.first()
		)
			continue;
		const statements = migration.sql
			.split("--> statement-breakpoint")
			.map((statement) => statement.trim())
			.filter(Boolean);
		await db.batch([
			...statements.map((statement) => db.prepare(statement)),
			db
				.prepare("INSERT INTO meadow_migrations (name, applied_at) VALUES (?, ?)")
				.bind(migration.name, new Date().toISOString()),
		]);
	}
}
