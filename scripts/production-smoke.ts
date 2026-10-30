import assert from "node:assert/strict";
import { stringify } from "devalue";
import { unstable_dev } from "wrangler";

const manifestPath = new URL("../.svelte-kit/output/server/manifest.js", import.meta.url).href;
const { manifest } = await import(manifestPath);
const ids = Object.keys(manifest.remotes);
assert.equal(ids.length, 1, "Update the smoke test when another remote module is introduced.");
// Local library API runs the already-vp-built Worker in workerd; this does not invoke the Wrangler CLI, rebuild the app, or contact a Cloudflare account.
const server = await unstable_dev(".svelte-kit/cloudflare/_worker.js", {
	config: "wrangler.jsonc",
	local: true,
	persist: false,
	ip: "127.0.0.1",
	port: 5181,
	logLevel: "error",
	vars: {
		BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(),
		BETTER_AUTH_URL: "https://meadow.example.invalid",
		LOCAL_IDENTITY_STUB: "true",
	},
	experimental: {
		forceLocal: true,
		watch: false,
		disableExperimentalWarning: true,
		disableDevRegistry: true,
	},
});
const origin = "http://127.0.0.1:5181";
try {
	const headers = {
		origin,
		cookie: "LOCAL_DEMO_USER=assistant; actorUserId=admin",
		"x-demo-user": "realtor",
	};
	const payload = Buffer.from(stringify({ archived: false })).toString("base64url");
	const query = await fetch(`${origin}/_app/remote/${ids[0]}/getWorkspace?payload=${payload}`, {
		headers,
	});
	assert.equal(query.status, 401);
	assert.match((await query.json()).message, /verified identity/);
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
	assert.match((await command.json()).message, /verified identity/);
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
	console.log(
		"Production query, command, and form fail closed despite configured or forged demo identities.",
	);
} finally {
	await server.stop();
}
