/** One-way copy of production D1 data into the local simulator database, which it replaces in one transaction: vp run db:pull-prod shows what would change, and -- --confirm-replace-local applies it. Production is only ever read. Start vp run dev:local once first so Alchemy has migrated local D1; the local schema must match production's. Login sessions, rate limits, and verifications are not copied, and feedback notes stay in KV. Output is limited to table names and counts because the copy holds real client data and password hashes. */
import type { D1Database } from "@cloudflare/workers-types";
import { localD1Database } from "./local-d1.ts";
import { projectCloudflareAccountId } from "./project-env.ts";
import { remoteD1Database } from "./remote-d1.ts";

const confirmFlag = "--confirm-replace-local";
const args = process.argv.slice(2).filter((arg: string) => arg !== "--");
if (args.some((arg: string) => arg !== confirmFlag))
	throw new Error(`Use vp run db:pull-prod, then add -- ${confirmFlag} to replace local data.`);
const apply = args.includes(confirmFlag);

process.env.CLOUDFLARE_ACCOUNT_ID ??= projectCloudflareAccountId;
process.env.MEADOW_D1_DATABASE_ID ??= "f3dcaa0f-97ad-4403-b32d-a2164027c64d";

// Cleared locally but never copied: sessions and verifications would carry live tokens to this machine.
const uncopied = [
	"auth_session",
	"auth_support_impersonation",
	"auth_rate_limit",
	"auth_verification",
];
const pageSize = 1000;
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** Maps each application table to its sorted columns, leaving out tables owned by SQLite, D1, or Alchemy's migrator. */
async function tableColumns(db: D1Database) {
	const { results } = await db
		.prepare(
			"SELECT m.name AS tableName, c.name AS columnName FROM sqlite_master m JOIN pragma_table_info(m.name) c WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE '_cf_%' AND m.name NOT LIKE '%migrations'",
		)
		.all<{ tableName: string; columnName: string }>();
	const tables = new Map<string, string[]>();
	for (const { tableName, columnName } of results)
		tables.set(tableName, [...(tables.get(tableName) ?? []), columnName]);
	for (const columns of tables.values()) columns.sort();
	return tables;
}

async function readRows(db: D1Database, table: string) {
	const rows: Record<string, unknown>[] = [];
	for (let offset = 0; ; offset += pageSize) {
		const { results } = await db
			.prepare(`SELECT * FROM ${quote(table)} ORDER BY rowid LIMIT ? OFFSET ?`)
			.bind(pageSize, offset)
			.all<Record<string, unknown>>();
		rows.push(...results);
		if (results.length < pageSize) return rows;
	}
}

async function countRows(db: D1Database, table: string) {
	return (
		(await db.prepare(`SELECT count(*) AS total FROM ${quote(table)}`).first<number>("total")) ?? 0
	);
}

const production = remoteD1Database({ readOnly: true });
const proxy = await localD1Database();
try {
	const local = proxy.env.DB;
	const [productionTables, localTables] = await Promise.all([
		tableColumns(production),
		tableColumns(local),
	]);
	const fingerprint = (tables: Map<string, string[]>) =>
		JSON.stringify([...tables].sort(([a], [b]) => a.localeCompare(b)));
	if (fingerprint(productionTables) !== fingerprint(localTables))
		throw new Error(
			"Local and production schemas differ. Deploy, or restart vp run dev:local so Alchemy migrates local D1, then try again.",
		);

	const copied = [...productionTables.keys()].filter((table) => !uncopied.includes(table)).sort();
	const rows = new Map<string, Record<string, unknown>[]>();
	for (const table of copied) rows.set(table, await readRows(production, table));
	for (const table of copied)
		console.log(
			`${table}: ${await countRows(local, table)} local, ${rows.get(table)!.length} production`,
		);
	if (!apply) {
		console.log(`Nothing changed. Add -- ${confirmFlag} to replace local data with production's.`);
	} else {
		const statements = [local.prepare("PRAGMA defer_foreign_keys = true")];
		for (const table of [...localTables.keys()])
			statements.push(local.prepare(`DELETE FROM ${quote(table)}`));
		for (const table of copied) {
			const columns = productionTables.get(table)!;
			const insert = local.prepare(
				`INSERT INTO ${quote(table)} (${columns.map(quote).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
			);
			for (const row of rows.get(table)!)
				statements.push(insert.bind(...columns.map((column) => row[column] ?? null)));
		}
		await local.batch(statements);
		for (const table of copied)
			if ((await countRows(local, table)) !== rows.get(table)!.length)
				throw new Error(`Local ${table} does not match the rows read from production.`);
		console.log("Local D1 now matches production. Sign in with a production account and password.");
	}
} finally {
	await proxy.dispose();
}
