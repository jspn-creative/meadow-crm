import { expect, test } from "@playwright/test";

test("opportunity editor persists multiple clients, optional USD fields, references and history", async ({
	page,
}, info) => {
	const title = `Editor ${info.project.name} ${crypto.randomUUID()}`;
	await page.goto("/pipeline");
	await page.getByRole("button", { name: "New opportunity", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
	await dialog.getByLabel("Opportunity title", { exact: true }).fill(title);
	await dialog.getByRole("checkbox", { name: "Inez Cedar", exact: true }).check();
	await dialog.getByLabel("Initial stage", { exact: true }).selectOption("active-lead");
	await page.keyboard.press("Escape");
	await expect(dialog).not.toBeVisible();
	await expect(page.getByRole("button", { name: "New opportunity", exact: true })).toBeFocused();
	await page.getByRole("button", { name: "New opportunity", exact: true }).click();
	await expect(dialog.getByLabel("Opportunity title", { exact: true })).toHaveValue(title);
	await dialog.getByRole("button", { name: "Save opportunity", exact: true }).click();
	await expect(dialog.getByRole("heading", { name: title, exact: true })).toBeVisible();
	await expect(
		dialog.getByRole("heading", { name: "Active lead checklist", exact: true }),
	).toBeVisible();
	await expect(dialog.getByText("Not set", { exact: true })).toHaveCount(3);
	await dialog.getByRole("button", { name: "Edit opportunity", exact: true }).click();
	await dialog.getByLabel("Budget (USD, optional)", { exact: true }).fill("125000.29");
	await dialog.getByLabel("Property address (optional)", { exact: true }).fill("123 Fictional Lane");
	await dialog.getByLabel("Timeline (optional)", { exact: true }).selectOption("3-6-mo");
	await dialog
		.getByLabel("Notes", { exact: true })
		.fill("A fictional note. <script>not executable</script>");
	await dialog.getByRole("button", { name: "Add reference", exact: true }).click();
	await dialog.getByLabel("Reference 1 label", { exact: true }).fill("Document");
	await dialog.getByLabel("Reference 1 destination", { exact: true }).fill("javascript:alert(1)");
	await dialog.getByRole("button", { name: "Save opportunity", exact: true }).click();
	await expect(dialog.getByRole("alert")).toContainText("Your draft is retained");
	await dialog
		.getByLabel("Reference 1 destination", { exact: true })
		.fill("https://example.com/document");
	await dialog.getByRole("button", { name: "Add reference", exact: true }).click();
	await dialog.getByLabel("Reference 2 label", { exact: true }).fill("Related opportunity");
	await dialog.getByLabel("Reference 2 kind", { exact: true }).selectOption("opportunity");
	await dialog
		.getByLabel("Reference 2 destination", { exact: true })
		.selectOption("fictional-opportunity-maple");
	await dialog.getByRole("button", { name: "Save opportunity", exact: true }).click();
	await expect(dialog.getByRole("status")).toHaveText("Opportunity saved.");
	await expect(dialog.getByText("$125,000.29", { exact: true })).toBeVisible();
	const documentLink = dialog.getByRole("link", { name: "Document (opens a new tab)", exact: true });
	await expect(documentLink).toHaveAttribute("href", "https://example.com/document");
	await expect(documentLink).toHaveAttribute("rel", "noopener noreferrer");
	await dialog.getByText("History", { exact: true }).click();
	await expect(dialog.getByText(/edit · business-realtor/)).toBeVisible();
	await dialog.getByRole("button", { name: "Close", exact: true }).click();
	await page.reload();
	await page.getByRole("button", { name: new RegExp(title) }).click();
	await expect(dialog.getByText("$125,000.29", { exact: true })).toBeVisible();
	await dialog.getByRole("button", { name: "Edit opportunity", exact: true }).click();
	await page.route("**/_app/remote/**/saveOpportunity", (route) =>
		route.abort("internetdisconnected"),
	);
	await dialog.getByLabel("Notes", { exact: true }).fill("Retained offline draft");
	await dialog.getByRole("button", { name: "Save opportunity", exact: true }).click();
	await expect(dialog.getByRole("alert")).toContainText("Your draft is retained");
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: new RegExp(title) }).click();
	await dialog.getByRole("button", { name: "Edit opportunity", exact: true }).click();
	await expect(dialog.getByLabel("Notes", { exact: true })).toHaveValue("Retained offline draft");
	await page.unroute("**/_app/remote/**/saveOpportunity");
	await dialog.getByRole("button", { name: "Remove reference 1", exact: true }).click();
	await dialog.getByLabel("Type", { exact: true }).selectOption("seller");
	await dialog.getByRole("button", { name: "Save opportunity", exact: true }).click();
	await expect(documentLink).toHaveCount(0);
	await dialog.getByRole("link", { name: "Related opportunity", exact: true }).click();
	await expect(dialog.getByRole("heading", { name: "Maple first home", exact: true })).toBeVisible();
});

test("opportunity modal keyboard and scrolling work at phone, tablet and desktop widths", async ({
	page,
}, info) => {
	test.skip(info.project.name !== "desktop", "One bounded responsive interaction pass.");
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto("/pipeline");
	for (const width of [375, 768, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		const card = page.getByRole("button", { name: /Maple first home/ });
		await card.click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
		await dialog.getByRole("button", { name: "Edit opportunity", exact: true }).click();
		await dialog.getByLabel("Notes", { exact: true }).fill("Responsive retained draft");
		await dialog.getByRole("button", { name: "Add reference", exact: true }).scrollIntoViewIfNeeded();
		expect(await dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
		expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
		await page.screenshot({ path: `test-results/editor-${width}.png` });
		await page.setViewportSize({ width: width === 1440 ? 1023 : 1024, height: 900 });
		await expect(dialog.getByLabel("Notes", { exact: true })).toHaveValue(
			"Responsive retained draft",
		);
		await page.setViewportSize({ width, height: 900 });
		await page.keyboard.press("Escape");
		await expect(card).toBeFocused();
		if (width === 1440) {
			await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
			await card.click();
			await expect(dialog).toBeVisible();
			await page.keyboard.press("Escape");
			await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
		}
	}
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.getByRole("button", { name: /Maple first home/ }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).not.toBeVisible();
});
