import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { D1Database } from "@cloudflare/workers-types";
import { getPlatformProxy } from "wrangler";
import { readMigrations } from "./migrations.ts";
import { migrate } from "../src/lib/server/db/migrate.ts";

const state = await mkdtemp(join(tmpdir(), "meadow-dev-startup-"));
const migrations = await readMigrations();
const config = { configPath: "wrangler.jsonc", persist: { path: state } };
const original = await getPlatformProxy<{ DB: D1Database }>(config);
try {
	// Reproduce a database from before the client data model without touching normal local storage.
	await migrate(
		original.env.DB,
		migrations.filter(({ name }) => name < "0004"),
	);
	await original.env.DB.prepare(
		"INSERT INTO clients (id, name, created_at, updated_at) VALUES ('startup-survivor', 'Preserved client', '2026-10-23', '2026-10-23')",
	).run();
} finally {
	await original.dispose();
}

for (let attempt = 0; attempt < 2; attempt++) {
	const server = spawn("vp", ["dev", "--host", "127.0.0.1", "--port", "5183", "--strictPort"], {
		cwd: import.meta.dirname + "/..",
		env: { ...process.env, MEADOW_LOCAL_STATE_DIR: state, LOCAL_IDENTITY_STUB: "true" },
		stdio: ["ignore", "pipe", "pipe"],
		detached: true,
	});
	let output = "";
	const exited = once(server, "exit");
	// The detached group contains only this smoke test's vp process and its dev-server children.
	const stop = () => {
		if (server.pid && server.exitCode === null && server.signalCode === null)
			process.kill(-server.pid, "SIGTERM");
	};
	const timeout = setTimeout(stop, 60_000);
	try {
		await new Promise<void>((resolve, reject) => {
			const capture = (chunk: Buffer) => {
				output += chunk.toString();
				if (output.includes("http://127.0.0.1:5183")) resolve();
			};
			server.stdout.on("data", capture);
			server.stderr.on("data", capture);
			server.once("error", reject);
			server.once("exit", () => reject(new Error(`Dev stopped before readiness:\n${output}`)));
		});
		// Vite prints its URL before SvelteKit finishes generating its dev manifest.
		for (let probe = 0; probe < 40; probe++) {
			const response = await fetch("http://127.0.0.1:5183");
			await response.text();
			if (response.status === 200) break;
			await delay(250);
		}
		for (const route of ["/", "/registry", "/pipeline", "/settings"]) {
			const response = await fetch(`http://127.0.0.1:5183${route}`);
			assert.equal(response.status, 200, `${route}\n${await response.text()}\n${output}`);
		}
		assert.doesNotMatch(output, /no such table/);
	} finally {
		clearTimeout(timeout);
		stop();
		await exited;
	}
	const verified = await getPlatformProxy<{ DB: D1Database }>(config);
	try {
		const db = verified.env.DB;
		assert.equal(
			(await db.prepare("SELECT count(*) AS n FROM meadow_migrations").first())?.n,
			migrations.length,
		);
		assert.equal(
			(await db.prepare("SELECT name FROM clients WHERE id = 'startup-survivor'").first())?.name,
			"Preserved client",
		);
		await db.prepare("SELECT id FROM client_people").all();
		assert.deepEqual((await db.prepare("PRAGMA foreign_key_check").all()).results, []);
	} finally {
		await verified.dispose();
	}
}
console.log(
	`Dev startup upgrades old local D1, preserves records, and restarts safely. Isolated state: ${state}`,
);
