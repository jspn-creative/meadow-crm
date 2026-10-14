import { expect, test } from "@playwright/test";

test("client, opportunity and visited-stage checklist persist across reloads", async ({
	page,
}, info) => {
	const name = `Slice client ${info.project.name} ${crypto.randomUUID()}`;
	const title = `Slice opportunity ${info.project.name} ${crypto.randomUUID()}`;
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/registry");
	await page.getByRole("button", { name: "New client", exact: true }).click();
	await page.getByLabel("Client name", { exact: true }).fill(name);
	await page.getByRole("button", { name: "Save client", exact: true }).click();
	await expect(page.getByRole("status")).toContainText("Client saved");
	await page.reload();
	await page.getByLabel("Search clients", { exact: true }).fill(name);
	await expect(page.getByText(name, { exact: true })).toBeVisible();
	await expect(page.getByText("0 linked opportunities", { exact: true })).toBeVisible();
	await page.getByRole("link", { name: `New opportunity for ${name}`, exact: true }).click();
	await page.getByRole("button", { name: "New opportunity", exact: true }).click();
	await expect(page.getByRole("checkbox", { name, exact: true })).toBeChecked();
	await page.getByLabel("Opportunity title", { exact: true }).fill(title);
	await page.getByLabel("Initial stage", { exact: true }).selectOption("active-lead");
	await page.getByRole("button", { name: "Save opportunity", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByRole("heading", { name: title, exact: true })).toBeVisible();
	await expect(dialog.getByText(name, { exact: true })).toBeVisible();
	const step = dialog.locator("form").first();
	await step.getByRole("checkbox").check();
	await step.getByLabel(/Due date/).fill("2026-10-20");
	await step.getByRole("button", { name: /Save step/ }).click();
	await expect(dialog.getByRole("status")).toHaveText("Step saved.");
	await dialog.getByLabel("Pipeline stage", { exact: true }).selectOption("under-contract");
	await expect(
		dialog.getByRole("heading", { name: "Under contract checklist", exact: true }),
	).toBeVisible();
	await expect(dialog.getByRole("status")).toHaveText("Stage saved.");
	await dialog.getByLabel("Pipeline stage", { exact: true }).selectOption("active-lead");
	await expect(dialog.getByRole("status")).toHaveText("Stage saved.");
	await expect(step.getByRole("checkbox")).toBeChecked();
	await expect(step.getByLabel(/Due date/)).toHaveValue("2026-10-20");
	await page.reload();
	await page.getByRole("button", { name: new RegExp(title) }).click();
	await expect(dialog.getByLabel("Pipeline stage", { exact: true })).toHaveValue("active-lead");
	await expect(step.getByRole("checkbox")).toBeChecked();
	await expect(step.getByLabel(/Due date/)).toHaveValue("2026-10-20");
	await page.route("**/_app/remote/**/saveChecklistStep", (route) =>
		route.abort("internetdisconnected"),
	);
	await step.getByRole("checkbox").uncheck();
	await step.getByLabel(/Due date/).fill("2026-10-21");
	await step.getByRole("button", { name: /Save step/ }).click();
	await expect(dialog.getByRole("alert")).toContainText("Your draft is retained");
	await expect(step.getByRole("checkbox")).not.toBeChecked();
	await expect(step.getByLabel(/Due date/)).toHaveValue("2026-10-21");
	await page.unroute("**/_app/remote/**/saveChecklistStep");
	await page.keyboard.press("Escape");
	await expect(dialog).not.toBeVisible();
	await expect(page.getByRole("button", { name: new RegExp(title) })).toBeFocused();
	await page.getByRole("button", { name: new RegExp(title) }).click();
	await expect(step.getByRole("checkbox")).toBeChecked();
	await expect(step.getByLabel(/Due date/)).toHaveValue("2026-10-20");
	await step.getByRole("checkbox").uncheck();
	await step.getByLabel(/Due date/).fill("2000-01-01");
	await step.getByRole("button", { name: /Save step/ }).click();
	await expect(dialog.getByRole("status")).toHaveText("Step saved.");
	await dialog.getByLabel("Pipeline stage", { exact: true }).selectOption("under-contract");
	await expect(dialog.getByRole("status")).toHaveText("Stage saved.");
	await dialog.getByRole("button", { name: "Close", exact: true }).click();
	await page.goto("/");
	const source = page.getByRole("link").filter({ hasText: title });
	await expect(source).toBeVisible();
	await expect(source).toContainText("Active lead");
	await source.click();
	await expect(dialog.getByLabel("Pipeline stage", { exact: true })).toHaveValue("under-contract");
	await expect(
		dialog.getByRole("heading", { name: "Active lead checklist", exact: true }),
	).toBeVisible();
	await page.reload();
	await expect(
		dialog.getByRole("heading", { name: "Active lead checklist", exact: true }),
	).toBeVisible();
	await step.getByRole("checkbox").check();
	await step.getByRole("button", { name: /Save step/ }).click();
	await expect(dialog.getByRole("status")).toHaveText("Step saved.");
	await dialog.getByRole("button", { name: "Return to current checklist", exact: true }).click();
	await expect(
		dialog.getByRole("heading", { name: "Under contract checklist", exact: true }),
	).toBeVisible();
	await dialog.getByRole("button", { name: "Close", exact: true }).click();
	await page.goto("/");
	await expect(source).toHaveCount(0);
	expect(errors).toEqual([]);
});

test("slice controls remain usable through content and shell breakpoints", async ({
	page,
}, info) => {
	test.skip(info.project.name !== "desktop", "One bounded cross-width interaction pass.");
	for (const width of [375, 768, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto("/pipeline");
		await page.getByRole("button", { name: /Maple first home/ }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
		await dialog.locator("form").last().getByRole("checkbox").scrollIntoViewIfNeeded();
		expect(await dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
		expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
		await page.keyboard.press("Escape");
		if (width === 1440) {
			await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
			await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
		}
		await page
			.locator("#workspace-main")
			.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "smooth" }));
		await page.setViewportSize({ width: width === 1440 ? 1023 : 1024, height: 900 });
		await page.setViewportSize({ width, height: 900 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
			true,
		);
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.getByRole("button", { name: /Maple first home/ }).click();
		await expect(dialog).toBeVisible();
		await dialog.getByRole("button", { name: "Close", exact: true }).click();
		await expect(dialog).not.toBeVisible();
	}
});
