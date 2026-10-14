import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

// Bundle only the isolated experiment; vp still owns the app build, and no account/config/deployment is touched.
const bundle = await build({
	entryPoints: ["scripts/experiments/auth-worker.ts"],
	bundle: true,
	write: false,
	format: "esm",
	platform: "neutral",
	conditions: ["workerd", "worker", "browser"],
	external: ["node:*"],
	target: "es2022",
});
const runtime = new Miniflare({
	modules: [{ type: "ESModule", path: "auth-smoke.js", contents: bundle.outputFiles[0].text }],
	compatibilityDate: "2026-07-30",
	compatibilityFlags: ["nodejs_compat"],
	d1Databases: ["DB"],
	d1Persist: false,
});
try {
	const response = await runtime.dispatchFetch("http://localhost:5190/");
	assert.equal(response.status, 200, await response.clone().text());
	assert.deepEqual(await response.json(), {
		passwordHash: true,
		persistedSession: true,
		independentLookup: true,
		invalidLoginDenied: true,
		logoutRevoked: true,
		transactionCalls: 0,
	});
	console.log(
		"Better Auth/Drizzle/D1 Workers smoke passed: hashing, persisted session, independent lookup, invalid login, logout; zero interactive transactions (isolated, no persistence).",
	);
} finally {
	await runtime.dispose();
}
