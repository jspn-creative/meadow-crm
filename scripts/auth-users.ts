/** Create: pipe JSON {"role":"realtor"|"assistant"|"support-admin","email":"…","password":"…"} to vp run auth:create. Reset: pipe JSON {"role":"…","password":"…"} to vp run auth:reset-password. Use a password manager or protected stdin, not command-line arguments; passwords must be 12–128 characters. Local D1 is the default, uses the same state as vp dev, and requires db:migrate first. Production, only after explicit approval: append -- --remote and supply CLOUDFLARE_ACCOUNT_ID, MEADOW_D1_DATABASE_ID and a D1-edit CLOUDFLARE_API_TOKEN as environment secrets. Verify those IDs before running; this script never provisions, migrates, deploys, or prints credentials. Reset revokes all sessions, including impersonation. */
import { getPlatformProxy } from "wrangler";
import { hashPassword } from "better-auth/crypto";
import type { D1Database } from "@cloudflare/workers-types";

type Statement = { sql: string; params: (string | number)[] };
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const [command] = args;
if (
	!["create", "reset-password"].includes(command) ||
	args.some((arg, i) => i > 0 && arg !== "--remote")
)
	throw new Error(
		"Use auth:create or auth:reset-password with JSON on stdin; optional --remote requires production approval.",
	);
let input = "";
for await (const chunk of process.stdin) input += chunk;
let data: { role: string; email?: string; password: string };
try {
	data = JSON.parse(input);
} catch {
	throw new Error("Expected account JSON on stdin.");
}
if (
	!data ||
	!["realtor", "assistant", "support-admin"].includes(data.role) ||
	typeof data.password !== "string" ||
	data.password.length < 12 ||
	data.password.length > 128
)
	throw new Error("A valid account role and a 12–128 character password are required.");
const id = data.role === "support-admin" ? "support-admin" : `business-${data.role}`;
const now = Date.now();
const hash = await hashPassword(data.password);
const statements: Statement[] = [];
if (command === "create") {
	const email = data.email?.trim().toLowerCase();
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		throw new Error("A valid email is required.");
	statements.push(
		{
			sql: "INSERT INTO auth_user (id, name, email, email_verified, created_at, updated_at, role) VALUES (?, ?, ?, 0, ?, ?, ?)",
			params: [
				id,
				data.role === "support-admin"
					? "Support admin"
					: data.role === "realtor"
						? "Realtor"
						: "Assistant",
				email,
				now,
				now,
				data.role === "support-admin" ? "admin" : "user",
			],
		},
		{
			sql: "INSERT INTO auth_account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, 'credential', ?, ?, ?, ?)",
			params: [crypto.randomUUID(), id, id, hash, now, now],
		},
	);
} else {
	statements.push(
		{
			sql: "UPDATE auth_account SET password = ?, updated_at = ? WHERE user_id = ? AND provider_id = 'credential' RETURNING id",
			params: [hash, now, id],
		},
		{ sql: "DELETE FROM auth_session WHERE user_id = ? OR impersonated_by = ?", params: [id, id] },
	);
}
if (args.includes("--remote")) {
	const {
		CLOUDFLARE_ACCOUNT_ID: account,
		MEADOW_D1_DATABASE_ID: database,
		CLOUDFLARE_API_TOKEN: token,
	} = process.env;
	if (
		!account ||
		!database ||
		!token ||
		!/^[a-f0-9]{32}$/.test(account) ||
		!/^[a-f0-9-]{36}$/.test(database)
	)
		throw new Error("Explicit production account, D1 ID, and API token are required.");
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`,
		{
			method: "POST",
			headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
			body: JSON.stringify({
				batch: statements.map(({ sql, params }) => ({ sql, params: params.map(String) })),
			}),
		},
	);
	const result = (await response.json()) as {
		success: boolean;
		result?: { success: boolean; results: unknown[] }[];
	};
	if (!response.ok || !result.success || !result.result?.every((row) => row.success))
		throw new Error("Remote account operation failed; no credentials are logged.");
	if (command === "reset-password" && !result.result[0].results.length)
		throw new Error("No credential account exists for that role.");
} else {
	const proxy = await getPlatformProxy<{ DB: D1Database }>({
		configPath: "wrangler.jsonc",
		persist: { path: process.env.MEADOW_LOCAL_STATE_DIR ?? ".wrangler/state/v3" },
	});
	try {
		const result = await proxy.env.DB.batch(
			statements.map(({ sql, params }) => proxy.env.DB.prepare(sql).bind(...params)),
		);
		if (command === "reset-password" && !result[0].results.length)
			throw new Error("No credential account exists for that role.");
	} catch {
		throw new Error(
			"Local account operation failed. Check migrations and whether the account already exists; no credentials are logged.",
		);
	} finally {
		await proxy.dispose();
	}
}
console.log(`Account ${command} complete (${args.includes("--remote") ? "remote" : "local"}).`);
