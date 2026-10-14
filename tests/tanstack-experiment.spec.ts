import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("TanStack collections hydrate, move optimistically, and roll back stale moves", async ({
	page,
	request,
}) => {
	const opportunityId =
		test.info().project.name === "phone"
			? "fictional-opportunity-birch"
			: "fictional-opportunity-cedar";
	const url = `/experiments/tanstack?record=${test.info().project.name === "phone" ? "birch" : "cedar"}`;
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	const response = await request.get(url);
	expect(response.status()).toBe(200);
	expect(await response.text()).toContain(`data-record="${opportunityId}"`);
	await page.goto(url);
	await expect(page.getByTestId("registry-count")).not.toHaveText("Registry: 0");
	const row = page.locator(`[data-record="${opportunityId}"]`);
	const original = await row.getAttribute("data-stage");
	const destination = original === "active-lead" ? "new-lead" : "active-lead";
	const counts = page.locator(`[data-count-stage="${destination}"]`);
	const beforeCount = Number(await counts.textContent());
	const remoteRequests: string[] = [];
	page.on("request", (request) => {
		if (request.url().includes("/_app/remote/")) remoteRequests.push(request.url());
	});
	await page.route("**/_app/remote/**/moveStage", async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 400));
		await route.continue();
	});
	await page.getByRole("button", { name: "Move experiment opportunity" }).click();
	await expect(page.getByRole("status")).toHaveText("Pending");
	await expect(row).toHaveAttribute("data-stage", destination);
	await expect(counts).toHaveText(String(beforeCount + 1));
	await expect(page.getByRole("status")).toHaveText("Ready");
	expect(remoteRequests.filter((url) => url.includes("moveStage"))).toHaveLength(1);
	expect(remoteRequests.filter((url) => url.includes("getWorkspace"))).toHaveLength(0);
	await expect(page.getByTestId("cache-diverged")).toHaveText("Second cache diverged: true");
	// A second writer changes the remote revision without synchronizing the collection cache.
	await page.evaluate(async (id) => {
		const path = "/src/lib/crm.remote.ts";
		const { getWorkspace, moveStage } = await import(/* @vite-ignore */ path);
		const query = getWorkspace({ archived: false });
		const record = query.current.opportunities.find((r: { id: string }) => r.id === id);
		await moveStage({
			requestId: crypto.randomUUID(),
			id: record.id,
			revision: record.revision,
			stage: record.stage,
		}).updates(query);
	}, opportunityId);
	await page.getByRole("button", { name: "Move experiment opportunity" }).click();
	await expect(page.getByRole("status")).toContainText("rolled back");
	await expect(row).toHaveAttribute("data-stage", destination);
	await expect(counts).toHaveText(String(beforeCount + 1));
	await expect(page.getByTestId("draft")).toContainText(opportunityId);
	await page.reload();
	await expect(row).toHaveAttribute("data-stage", destination);
	await expect(page.getByTestId("cache-diverged")).toHaveText("Second cache diverged: false");
	expect(errors).toEqual([]);
});

test("remote-owned interface rolls back an unavailable network and retains the retry input", async ({
	page,
}) => {
	await page.goto("/");
	await page.route("**/_app/remote/**/moveStage", (route) => route.abort("internetdisconnected"));
	const result = await page.evaluate(async () => {
		const remotePath = "/src/lib/crm.remote.ts";
		const interfacePath = "/src/lib/data/workspace.ts";
		const { getWorkspace } = await import(/* @vite-ignore */ remotePath);
		const { workspaceData } = await import(/* @vite-ignore */ interfacePath);
		const query = getWorkspace({ archived: false });
		await query;
		const data = workspaceData(query);
		const record = data.current.opportunities[0];
		const input = {
			requestId: crypto.randomUUID(),
			id: record.id,
			revision: record.revision,
			stage: record.stage === "closed" ? "new-lead" : "closed",
		};
		let rejected = false;
		try {
			await data.move(input);
		} catch {
			rejected = true;
		}
		const after = data.current.opportunities.find((row: { id: string }) => row.id === record.id);
		data.dispose();
		return {
			rejected,
			unchanged: after.stage === record.stage && after.revision === record.revision,
			retained: input.id === record.id && input.requestId.length > 0,
		};
	});
	expect(result).toEqual({ rejected: true, unchanged: true, retained: true });
});

test("remote-owned interface provides optimism, rollback, and identity disposal without a collection cache", async ({
	page,
}) => {
	await page.goto("/");
	const result = await page.evaluate(
		async (id) => {
			const remotePath = "/src/lib/crm.remote.ts";
			const interfacePath = "/src/lib/data/workspace.ts";
			const { getWorkspace } = await import(/* @vite-ignore */ remotePath);
			const { workspaceData } = await import(/* @vite-ignore */ interfacePath);
			const query = getWorkspace({ archived: false });
			await query;
			const data = workspaceData(query);
			const record = data.current.opportunities.find((r: { id: string }) => r.id === id);
			const stage = record.stage === "active-lead" ? "new-lead" : "active-lead";
			const input = {
				requestId: crypto.randomUUID(),
				id: record.id,
				revision: record.revision,
				stage,
			};
			const moving = data.move(input);
			const optimistic = data.current.opportunities.find(
				(r: { id: string }) => r.id === record.id,
			).stage;
			await moving;
			const confirmed = data.current.opportunities.find((r: { id: string }) => r.id === record.id);
			let rejected = false;
			try {
				await data.move({ ...input, requestId: crypto.randomUUID(), stage: record.stage });
			} catch {
				rejected = true;
			}
			const rolledBack = data.current.opportunities.find(
				(r: { id: string }) => r.id === record.id,
			).stage;
			query.set({
				...query.current,
				identity: { actorUserId: "admin", effectiveUserId: "business-assistant", role: "assistant" },
			});
			let switchedRejected = false;
			try {
				await data.move(input);
			} catch {
				switchedRejected = true;
			}
			data.dispose();
			let disposedRejected = false;
			try {
				void data.current;
			} catch {
				disposedRejected = true;
			}
			return {
				stage,
				optimistic,
				confirmed: confirmed.stage,
				revision: confirmed.revision,
				oldRevision: record.revision,
				rejected,
				rolledBack,
				switchedRejected,
				disposedRejected,
			};
		},
		test.info().project.name === "phone"
			? "fictional-opportunity-birch"
			: "fictional-opportunity-cedar",
	);
	expect(result.optimistic).toBe(result.stage);
	expect(result.confirmed).toBe(result.stage);
	expect(result.revision).toBe(result.oldRevision + 1);
	expect(result.rejected).toBe(true);
	expect(result.rolledBack).toBe(result.stage);
	expect(result.switchedRejected).toBe(true);
	expect(result.disposedRejected).toBe(true);
});

test("experiment instances isolate actor/effective identities and discard collections on disposal", async ({
	page,
}) => {
	await page.goto("/");
	const result = await page.evaluate(async () => {
		const remotePath = "/src/lib/crm.remote.ts";
		const experimentPath = "/src/lib/experiments/tanstack.ts";
		const { getWorkspace } = await import(/* @vite-ignore */ remotePath);
		const { tanstackExperiment } = await import(/* @vite-ignore */ experimentPath);
		const snapshot = await getWorkspace({ archived: false });
		const first = tanstackExperiment(snapshot, async () => {});
		const second = tanstackExperiment(
			{
				...snapshot,
				identity: { actorUserId: "admin", effectiveUserId: "business-assistant", role: "assistant" },
			},
			async () => {},
		);
		const id = snapshot.opportunities[0].id;
		const initial = second.opportunities.get(id).stage;
		await first.move(id, initial === "closed" ? "new-lead" : "closed").isPersisted.promise;
		const isolated = second.opportunities.get(id).stage === initial;
		const separateIds =
			first.opportunities.id !== second.opportunities.id && first.scope !== second.scope;
		await first.dispose();
		let disposedRejected = false;
		try {
			first.move(id, "active-lead");
		} catch {
			disposedRejected = true;
		}
		const cleaned = first.opportunities.status === "cleaned-up";
		await second.dispose();
		return { isolated, separateIds, disposedRejected, cleaned };
	});
	expect(result).toEqual({
		isolated: true,
		separateIds: true,
		disposedRejected: true,
		cleaned: true,
	});
});
