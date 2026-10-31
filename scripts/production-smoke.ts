import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "devalue";
import { Miniflare } from "miniflare";

const manifestPath = new URL("../.svelte-kit/output/server/manifest.js", import.meta.url).href;
const { manifest } = await import(manifestPath);
const ids = Object.keys(manifest.remotes);
assert.equal(ids.length, 1, "Update the smoke test when another remote module is introduced.");
// Isolated prebuilt production Worker in workerd: no Wrangler config, rebuild, migration runner, or Cloudflare account. Development and operational scripts use Alchemy's simulator instead.
const root = fileURLToPath(new URL("../dist/server/", import.meta.url));
const files = (await readdir(root, { recursive: true }))
	.filter((file) => file.endsWith(".js") && file !== "index.js")
	.sort();
const server = new Miniflare({
	modules: ["index.js", ...files].map((file) => ({ type: "ESModule", path: join(root, file) })),
	modulesRoot: root,
	compatibilityDate: "2026-07-30",
	compatibilityFlags: ["nodejs_compat"],
	d1Databases: ["DB"],
	d1Persist: false,
	port: 0,
	assets: {
		directory: ".svelte-kit/cloudflare",
		binding: "ASSETS",
		routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true },
	},
	bindings: {
		BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(),
		BETTER_AUTH_URL: "https://meadow.example.invalid",
		LOCAL_IDENTITY_STUB: "true",
	},
});
const origin = (await server.ready).origin;
try {
	const headers = {
		origin,
		cookie:
			"LOCAL_DEMO_USER=assistant; actorUserId=support-admin; impersonatedBy=support-admin; meadow_support_session=forged",
		"x-demo-user": "realtor",
		"x-impersonate-user": "business-assistant",
	};
	const payload = Buffer.from(stringify({ archived: false })).toString("base64url");
	const query = await fetch(`${origin}/_app/remote/${ids[0]}/getWorkspace?payload=${payload}`, {
		headers,
	});
	assert.equal(query.status, 401);
	assert.match(((await query.json()) as { message: string }).message, /verified identity/);
	const command = await fetch(`${origin}/_app/remote/${ids[0]}/moveStage`, {
		method: "POST",
		headers: { ...headers, "content-type": "application/json" },
		body: JSON.stringify({
			payload: Buffer.from(
				stringify({
					requestId: "production-denied",
					id: "fictional-opportunity-maple",
					revision: 1,
					stage: "closed",
				}),
			).toString("base64url"),
			refreshes: [],
		}),
	});
	assert.equal(command.status, 401);
	assert.match(((await command.json()) as { message: string }).message, /verified identity/);
	const form = new FormData();
	form.set(`requestId/${ids[0]}/createClient`, "production-form-denied");
	form.set(`id/${ids[0]}/createClient`, "production-client");
	form.set(`name/${ids[0]}/createClient`, "Must not save");
	const submitted = await fetch(
		`${origin}/?/remote=${encodeURIComponent(`${ids[0]}/createClient`)}`,
		{ method: "POST", headers: { ...headers, accept: "text/html" }, body: form },
	);
	assert.equal(submitted.status, 401);
	const page = await fetch(origin, { headers, redirect: "manual" });
	assert.equal(page.status, 303);
	assert.equal(page.headers.get("location"), "/login?next=%2F");
	assert.equal(page.headers.get("cache-control"), "private, no-store");
	const login = await fetch(`${origin}/login`);
	assert.equal(login.status, 200);
	assert.match(await login.text(), /Sign in/);
	const impersonation = await fetch(`${origin}/api/support/choose`, {
		method: "POST",
		headers: { ...headers, "content-type": "application/json" },
		body: JSON.stringify({ userId: "business-assistant", actorUserId: "support-admin" }),
	});
	assert.equal(impersonation.status, 401);
	console.log(
		"Production query, command, and form fail closed despite configured or forged demo identities.",
	);
} finally {
	await server.dispose();
}
