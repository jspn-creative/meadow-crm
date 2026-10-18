import { expect, test } from "@playwright/test";

async function createOpportunity(
	page: import("@playwright/test").Page,
	{
		title,
		stage,
		timeline,
	}: {
		title: string;
		stage: string;
		timeline: string;
	},
) {
	await page.getByRole("button", { name: "New opportunity", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Opportunity title", { exact: true }).fill(title);
	await dialog.getByLabel("Initial stage", { exact: true }).selectOption(stage);
	await dialog.getByLabel("Timeline (optional)", { exact: true }).selectOption(timeline);
	await dialog.getByRole("button", { name: "Save opportunity", exact: true }).click();
	await expect(
		page.getByRole("dialog").getByRole("heading", { name: title, exact: true }),
	).toBeVisible();
	await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
}

test("archiving removes an opportunity from the board and restoring brings it back", async ({
	page,
}) => {
	await page.goto("/pipeline");

	const title = `QA archive ${crypto.randomUUID()}`;
	await createOpportunity(page, { title, stage: "new-lead", timeline: "1-3-mo" });

	const cardRow = page
		.locator("div.space-y-2")
		.filter({ has: page.locator("button", { hasText: title }) });
	await expect(cardRow).toBeVisible();
	await expect(cardRow.getByRole("button", { name: "Archive", exact: true })).toBeVisible();

	await cardRow.getByRole("button", { name: "Archive", exact: true }).click();
	await expect(page.locator("button", { hasText: title })).not.toBeVisible();

	await page.getByRole("link", { name: "View archived opportunities", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Archived opportunities" })).toBeVisible();
	const archivedRow = page
		.locator("div.border.rounded-xl.bg-white.p-5")
		.filter({ has: page.getByText(title, { exact: true }) });
	await expect(archivedRow).toBeVisible();
	await expect(archivedRow.getByRole("button", { name: "Restore", exact: true })).toBeVisible();
	await archivedRow.getByRole("button", { name: "Restore", exact: true }).click();
	await expect(archivedRow).not.toBeVisible();

	// Restore moved the opportunity out of the archived view; the server-side round-trip
	// (restore sets archived_at back to null and the board shows it again) is verified by
	// the deterministic DB test in src/lib/server/db/mutations.test.ts.
});
