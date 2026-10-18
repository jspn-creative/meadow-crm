import { expect, test } from "@playwright/test";

async function createOpportunity(
	page: import("@playwright/test").Page,
	{
		title,
		stage,
		timeline,
		client,
	}: {
		title: string;
		stage: string;
		timeline: string;
		client?: string;
	},
) {
	await page.getByRole("button", { name: "New opportunity", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Opportunity title", { exact: true }).fill(title);
	await dialog.getByLabel("Initial stage", { exact: true }).selectOption(stage);
	await dialog.getByLabel("Timeline (optional)", { exact: true }).selectOption(timeline);
	if (client) await dialog.getByRole("checkbox", { name: client, exact: true }).check();
	await dialog.getByRole("button", { name: "Save opportunity", exact: true }).click();
	// Saving closes the create dialog and opens the new opportunity's detail dialog.
	await expect(
		page.getByRole("dialog").getByRole("heading", { name: title, exact: true }),
	).toBeVisible();
	await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
}

test("board filters by type and timeline, sorts by timeline, and exposes the tag filter", async ({
	page,
}) => {
	await page.goto("/pipeline");

	// Archived opportunities never appear on the board.
	await expect(page.getByRole("button", { name: /Willow home sale/ })).toBeVisible();
	await expect(page.getByRole("button", { name: /Archived Alder search/ })).not.toBeVisible();

	// The tag filter lists the tags exposed on clients and filters opportunities by them.
	await page.getByLabel("Tag").selectOption("sphere");
	await expect(page.getByRole("button", { name: /Maple first home/ })).toBeVisible();
	await page.getByLabel("Tag").selectOption("All tags");

	// Create two New lead opportunities with different timelines.
	const alpha = `QA alpha ${crypto.randomUUID()}`;
	const beta = `QA beta ${crypto.randomUUID()}`;
	await createOpportunity(page, {
		title: alpha,
		stage: "new-lead",
		timeline: "1-3-mo",
		client: "Ada Maple",
	});
	await createOpportunity(page, {
		title: beta,
		stage: "new-lead",
		timeline: "6-plus-mo",
		client: "Ada Maple",
	});

	// Within New lead, 1–3 mo sorts ahead of 6+ mo (undated opportunities sort last).
	const newLead = page.locator("section[aria-label='New lead']");
	const titles = await newLead
		.locator("button")
		.evaluateAll((buttons) => buttons.map((b) => b.textContent!));
	const alphaIndex = titles.findIndex((text) => text.includes(alpha));
	const betaIndex = titles.findIndex((text) => text.includes(beta));
	expect(alphaIndex).toBeGreaterThanOrEqual(0);
	expect(betaIndex).toBeGreaterThanOrEqual(0);
	expect(alphaIndex).toBeLessThan(betaIndex);

	// Type filter narrows to Buyer opportunities.
	await page.getByLabel("Type").selectOption("Buyer");
	await expect(page.getByRole("button", { name: new RegExp(alpha) })).toBeVisible();
	await expect(page.getByRole("button", { name: new RegExp(beta) })).toBeVisible();
	await expect(page.getByRole("button", { name: /Willow home sale/ })).not.toBeVisible();

	// Timeline filter narrows to 1–3 mo.
	await page.getByLabel("Type").selectOption("All types");
	await page.getByLabel("Timeline").selectOption("1–3 mo");
	await expect(page.getByRole("button", { name: new RegExp(alpha) })).toBeVisible();
	await expect(page.getByRole("button", { name: new RegExp(beta) })).not.toBeVisible();
});
