/** Create: pipe JSON {"role":"realtor"|"assistant"|"support-admin","email":"…","password":"…"} to vp run auth:create. Reset: pipe JSON {"role":"…","password":"…"} to vp run auth:reset-password. Use protected stdin, not command-line arguments; passwords must be 12–128 characters. Local D1 is the default and shares Alchemy's dev database; start vp run dev first. Production: append -- --remote with approved project credentials. This script never provisions, migrates, deploys, or prints credentials. Reset revokes all sessions, including impersonation. */
import { hashPassword } from "better-auth/crypto";
import { loadProjectEnv } from "./project-env.ts";
import { remoteD1Database } from "./remote-d1.ts";
import { localD1Database } from "./local-d1.ts";

loadProjectEnv();

type Statement = { sql: string; params: (string | number)[] };
const args = process.argv.slice(2).filter((arg: string) => arg !== "--");
const [command] = args;
if (
	!["create", "reset-password"].includes(command) ||
	args.some((arg: string, i: number) => i > 0 && arg !== "--remote")
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
const proxy = args.includes("--remote") ? undefined : await localD1Database();
try {
	const db = proxy?.env.DB ?? remoteD1Database();
	const result = await db.batch(
		statements.map(({ sql, params }) => db.prepare(sql).bind(...params)),
	);
	if (command === "reset-password" && !result[0].results.length)
		throw new Error("No credential account exists for that role.");
} catch {
	throw new Error(
		"Account operation failed. Check the database and whether the account exists; no credentials are logged.",
	);
} finally {
	await proxy?.dispose();
}
console.log(`Account ${command} complete (${args.includes("--remote") ? "remote" : "local"}).`);
