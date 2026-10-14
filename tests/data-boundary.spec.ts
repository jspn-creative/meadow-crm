import { expect, test } from "@playwright/test";
import { stringify } from "devalue";

test("direct remote form persists once and cross-origin query requests are denied", async ({
	page,
	request,
}) => {
	await page.goto("/");
	const binding = await page.evaluate(async () => {
		const path = "/src/lib/crm.remote.ts";
		const { createClient } = await import(/* @vite-ignore */ path);
		return {
			action: createClient.action,
			requestId: createClient.fields.requestId.as("hidden", "placeholder").name,
			id: createClient.fields.id.as("hidden", "placeholder").name,
			name: createClient.fields.name.as("text").name,
		};
	});
	const id = `boundary-${crypto.randomUUID()}`;
	const fields = {
		[binding.requestId]: crypto.randomUUID(),
		[binding.id]: id,
		[binding.name]: "Boundary test client",
	};
	for (let retry = 0; retry < 2; retry++) {
		const response = await request.post(binding.action, {
			multipart: fields,
			headers: { origin: "http://127.0.0.1:5180", accept: "text/html" },
		});
		expect(response.status()).toBe(200);
	}
	const rows = await page.evaluate(async (id) => {
		const path = "/src/lib/crm.remote.ts";
		const { getWorkspace } = await import(/* @vite-ignore */ path);
		await getWorkspace({ archived: false }).refresh();
		return (await getWorkspace({ archived: false })).clients.filter(
			(row: { id: string }) => row.id === id,
		);
	}, id);
	expect(rows).toHaveLength(1);
	expect(rows[0].name).toBe("Boundary test client");
	const remoteId = new URL(binding.action, "http://127.0.0.1:5180").searchParams.get("/remote")!;
	const hash = remoteId.split("/")[0];
	const response = await request.get(
		`/_app/remote/${hash}/getWorkspace?payload=${btoa(stringify({ archived: false }))
			.replaceAll("=", "")
			.replaceAll("+", "-")
			.replaceAll("/", "_")}`,
		{ headers: { origin: "https://untrusted.example" } },
	);
	const denied = await response.json();
	expect(denied.type).toBe("error");
	expect(denied.error.status).toBe(403);
});

test("request bootstrap uses local identity and remote queries reject forged actor fields", async ({
	page,
	request,
}) => {
	await page.goto("/");
	const workspace = await page.evaluate(async () => {
		const path = "/src/lib/crm.remote.ts";
		const { getWorkspace } = await import(/* @vite-ignore */ path);
		return await getWorkspace({ archived: false });
	});
	expect(workspace.identity.effectiveUserId).toBe("business-realtor");
	expect(workspace.clients.length).toBeGreaterThan(0);
	const denied = await page.evaluate(async () => {
		const path = "/src/lib/crm.remote.ts";
		const { getWorkspace } = await import(/* @vite-ignore */ path);
		try {
			await getWorkspace({ archived: false, actorUserId: "admin" });
			return false;
		} catch {
			return true;
		}
	});
	expect(denied).toBe(true);
	const response = await request.get("/");
	expect(response.headers()["cache-control"]).toContain("no-store");
	expect(await response.text()).toContain("fictional-client-ada");
});

test("single-flight stage command refreshes both requested query variants and invalid links retain committed data", async ({
	page,
}, testInfo) => {
	await page.goto("/");
	const result = await page.evaluate(
		async (opportunityId) => {
			const path = "/src/lib/crm.remote.ts";
			const { getWorkspace, moveStage, saveOpportunity } = await import(/* @vite-ignore */ path);
			const active = getWorkspace({ archived: false });
			const archived = getWorkspace({ archived: true });
			const before = await active;
			await archived;
			const record = before.opportunities.find((row: { id: string }) => row.id === opportunityId);
			const destination = record.stage === "active-lead" ? "new-lead" : "active-lead";
			await moveStage({
				requestId: crypto.randomUUID(),
				id: record.id,
				revision: record.revision,
				stage: destination,
			}).updates(active, archived);
			const confirmed = active.current.opportunities.find(
				(row: { id: string }) => row.id === record.id,
			);
			let invalidLinkRejected = false;
			try {
				await saveOpportunity({
					requestId: crypto.randomUUID(),
					id: record.id,
					revision: confirmed.revision,
					title: "Invalid save",
					clientIds: ["missing-client"],
				});
			} catch {
				invalidLinkRejected = true;
			}
			await active.refresh();
			return {
				destination,
				stage: confirmed.stage,
				revision: confirmed.revision,
				oldRevision: record.revision,
				archivedReady: archived.ready,
				invalidLinkRejected,
				title: active.current.opportunities.find((row: { id: string }) => row.id === record.id).title,
			};
		},
		testInfo.project.name === "phone"
			? "fictional-opportunity-willow"
			: "fictional-opportunity-maple",
	);
	expect(result.stage).toBe(result.destination);
	expect(result.revision).toBe(result.oldRevision + 1);
	expect(result.archivedReady).toBe(true);
	expect(result.invalidLinkRejected).toBe(true);
	expect(result.title).not.toBe("Invalid save");
});
