import assert from "node:assert/strict";
import { getPlatformProxy } from "@alchemy.run/cloudflare-runtime/core/platform-proxy";
import { D1 } from "@alchemy.run/cloudflare-runtime/core/bindings";
import type { D1Database } from "@cloudflare/workers-types";

// Isolated Alchemy simulator binding only; no application state, migration runner, or Cloudflare account.
const proxy = await getPlatformProxy<{ DB: D1Database }>({
	bindings: [D1.local({ binding: "DB", id: crypto.randomUUID() })],
	persist: false,
});
try {
	const row = await proxy.env.DB.prepare("SELECT 1 AS ready").first<{ ready: number }>();
	assert.equal(row?.ready, 1);
	console.log("Local Workers/D1 binding smoke passed (isolated, no persistence).");
} finally {
	await proxy.dispose();
}
