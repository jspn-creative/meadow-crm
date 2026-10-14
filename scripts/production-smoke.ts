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
	// Kit remote calls carry application errors in a 200 protocol envelope; assert denial inside it, not the transport status.
	const queryError = await query.json();
	assert.equal(queryError.type, "error");
	assert.equal(queryError.error.status, 401);
	assert.match(queryError.error.message, /verified identity/);
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
	const commandError = await command.json();
	assert.equal(commandError.type, "error");
	assert.equal(commandError.error.status, 401);
	assert.match(commandError.error.message, /verified identity/);
	const form = new FormData();
	form.set(`requestId/${ids[0]}/createClient`, "production-form-denied");
	form.set(`id/${ids[0]}/createClient`, "production-client");
	form.set(`name/${ids[0]}/createClient`, "Must not save");
	const submitted = await fetch(
		`${origin}/?/remote=${encodeURIComponent(`${ids[0]}/createClient`)}`,
		{ method: "POST", headers: { ...headers, accept: "text/html" }, body: form },
	);
	assert.equal(submitted.status, 401);
	const page = await fetch(origin, { headers });
	assert.equal(page.status, 200);
	assert.match(await page.text(), /available only in local development/);
	const experiment = await fetch(`${origin}/experiments/tanstack`, { headers });
	assert.equal(experiment.status, 404);
	assert.doesNotMatch(await experiment.text(), /fictional-opportunity-maple|Maple first home/);
	console.log(
		"Production query, command, and form fail closed despite configured or forged demo identities.",
	);
} finally {
	await server.stop();
}
