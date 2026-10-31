import { spawn } from "node:child_process";
import { createServer } from "node:net";
import {
	loadProjectEnv,
	requireProjectCloudflareCredentials,
	projectCloudflareAccountId,
} from "./project-env.ts";

loadProjectEnv();
process.env.CLOUDFLARE_ACCOUNT_ID ??= projectCloudflareAccountId;
requireProjectCloudflareCredentials();
if (process.env.LOCAL_IDENTITY_STUB === "true")
	throw new Error("Live development requires real login.");
if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32)
	throw new Error("The production BETTER_AUTH_SECRET is required in ignored .env.");
const databaseId = "f3dcaa0f-97ad-4403-b32d-a2164027c64d";
if (process.env.MEADOW_D1_DATABASE_ID && process.env.MEADOW_D1_DATABASE_ID !== databaseId)
	throw new Error("Live development is restricted to the retained Meadow production database.");
await new Promise<void>((resolve, reject) => {
	const probe = createServer();
	probe.once("error", () =>
		reject(
			new Error(
				"Port 1337 is unavailable. Stop the existing dev server, then run vp dev again; no running process was stopped.",
			),
		),
	);
	probe.listen(1337, "localhost", () => probe.close((error) => (error ? reject(error) : resolve())));
});
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${projectCloudflareAccountId}/d1/database/${databaseId}`;
const headers = {
	authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
	"content-type": "application/json",
};
try {
	const response = await fetch(endpoint, { headers });
	const details = (await response.json()) as {
		success?: boolean;
		result?: { uuid?: string; name?: string };
	};
	if (
		!response.ok ||
		!details.success ||
		details.result?.uuid !== databaseId ||
		details.result.name !== "meadow-db"
	)
		throw new Error();
	const readback = await fetch(`${endpoint}/query`, {
		method: "POST",
		headers,
		body: JSON.stringify({ sql: "SELECT count(*) AS clients FROM clients", params: [] }),
	});
	const counts = (await readback.json()) as {
		success?: boolean;
		result?: { success?: boolean; results?: { clients: number }[] }[];
	};
	const clients = counts.result?.[0]?.results?.[0]?.clients;
	if (!readback.ok || !counts.success || !counts.result?.[0]?.success || typeof clients !== "number")
		throw new Error();
	console.log(
		`LIVE PRODUCTION D1: meadow-db (${databaseId}), JSPN; ${clients} clients. App changes write to production. No migrations or fixtures run.`,
	);
} catch {
	throw new Error("Live production D1 identity/read-only preflight failed; no server started.");
}
const child = spawn(
	"vp",
	["exec", "--", "alchemy", "dev", "alchemy.live.ts", "--stage", "live", "--env-file", ".env"],
	{
		stdio: "inherit",
		env: { ...process.env, MEADOW_LIVE_PRODUCTION: "true", LOCAL_IDENTITY_STUB: "false" },
	},
);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
child.on("error", () => {
	console.error("Failed to start live development.");
	process.exitCode = 1;
});
child.on("exit", (code) => {
	process.exitCode = code ?? 1;
});
