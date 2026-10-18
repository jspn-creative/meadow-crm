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

test("moving an opportunity from the board moves it to the new stage's column", async ({
	page,
}) => {
	await page.goto("/pipeline");

	const title = `QA board move ${crypto.randomUUID()}`;
	await createOpportunity(page, {
		title,
		stage: "new-lead",
		timeline: "1-3-mo",
		client: "Ada Maple",
	});

	// It starts in New lead.
	const newLead = page.locator("section[aria-label='New lead']");
	await expect(newLead.getByRole("button", { name: new RegExp(title) })).toBeVisible();

	// Move it to Active lead from the card's stage select.
	const activeLead = page.locator("section[aria-label='Active lead']");
	const card = newLead.getByRole("button", { name: new RegExp(title) }).locator("..");
	await card.getByLabel("Move to stage").selectOption("active-lead");

	// It appears in Active lead once the move completes, then leaves New lead.
	await expect(activeLead.getByRole("button", { name: new RegExp(title) })).toBeVisible();
	await expect(newLead.getByRole("button", { name: new RegExp(title) })).not.toBeVisible();
});
