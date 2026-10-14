import assert from "node:assert/strict";
import { getPlatformProxy } from "wrangler";
import type { D1Database } from "@cloudflare/workers-types";

// This uses the adapter's local binding API, never the Wrangler CLI or a remote database.
const proxy = await getPlatformProxy<{ DB: D1Database }>({
	configPath: "wrangler.jsonc",
	persist: false,
});
try {
	const row = await proxy.env.DB.prepare("SELECT 1 AS ready").first<{ ready: number }>();
	assert.equal(row?.ready, 1);
	console.log("Local Workers/D1 binding smoke passed (isolated, no persistence).");
} finally {
	await proxy.dispose();
}
