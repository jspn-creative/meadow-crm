import { expect, test } from "@playwright/test";

async function createOpportunity(page: import("@playwright/test").Page, title: string) {
	await page.getByRole("button", { name: "New opportunity", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Opportunity title", { exact: true }).fill(title);
	await dialog.getByRole("button", { name: "Save opportunity", exact: true }).click();
	await expect(dialog.getByRole("heading", { name: title, exact: true })).toBeVisible();
	return dialog;
}

test("a collapsed column expands from anywhere on it", async ({ page }, info) => {
	test.skip(info.project.name !== "desktop", "The desktop board shows the collapsed rails.");
	await page.goto("/pipeline");
	const column = page.locator("section[aria-label='New lead']");
	await expect(column).toHaveAttribute("data-collapsed", "false");
	await column.getByRole("button", { name: "Collapse New lead", exact: true }).click();
	await expect(column).toHaveAttribute("data-collapsed", "true");
	await expect(column.getByRole("button", { name: /Expand New lead/ })).toBeVisible();
	// A point on the vertical rail away from the header count and badge still expands.
	await column.getByTitle("Expand New lead").click({ position: { x: 20, y: 130 } });
	await expect(column).toHaveAttribute("data-collapsed", "false");
	// The used control becomes inert, so its counterpart takes the keyboard back.
	await expect(column.getByRole("button", { name: "Collapse New lead", exact: true })).toBeFocused();
});

test.skip("an opportunity's budget and address edit in place", async ({ page }, info) => {
	test.skip(info.project.name !== "desktop", "One bounded pass on the desktop dialog.");
	const title = `QA inline ${crypto.randomUUID()}`;
	await page.goto("/pipeline");
	const dialog = await createOpportunity(page, title);
	await expect(dialog.getByText("Not set", { exact: true })).toHaveCount(2);

	await dialog.getByRole("button", { name: "Edit budget", exact: true }).click();
	await dialog.getByLabel("Budget (USD)", { exact: true }).fill("125000.75");
	await page.keyboard.press("Enter");
	await expect(dialog.getByRole("status")).toHaveText("Budget saved.");
	await expect(dialog.getByText("$125,000.75", { exact: true })).toBeVisible();

	// Escape discards an address edit without saving anything.
	await dialog.getByRole("button", { name: "Edit address", exact: true }).click();
	await dialog.getByLabel("Property address", { exact: true }).fill("9 QA Lane");
	await page.keyboard.press("Escape");
	await expect(dialog.getByText("9 QA Lane", { exact: true })).toHaveCount(0);

	// Blurring commits the address edit.
	await dialog.getByRole("button", { name: "Edit address", exact: true }).click();
	await dialog.getByLabel("Property address", { exact: true }).fill("9 QA Lane");
	await dialog.getByRole("heading", { name: title, exact: true }).click();
	await expect(dialog.getByRole("status")).toHaveText("Address saved.");

	await page.reload();
	await page.getByRole("button", { name: new RegExp(title) }).click();
	await expect(dialog.getByText("$125,000.75", { exact: true })).toBeVisible();
	await expect(dialog.getByText("9 QA Lane", { exact: true })).toBeVisible();
});

test("a reference is added and removed from the read view", async ({ page }, info) => {
	test.skip(info.project.name !== "desktop", "One bounded pass on the desktop dialog.");
	const title = `QA references ${crypto.randomUUID()}`;
	await page.goto("/pipeline");
	const dialog = await createOpportunity(page, title);
	await dialog.getByRole("button", { name: "Add reference", exact: true }).click();
	await dialog.getByLabel("New reference label", { exact: true }).fill("Listing");
	await dialog.getByLabel("New reference link", { exact: true }).fill("https://example.com/listing");
	await dialog.getByRole("button", { name: "Add reference", exact: true }).click();
	await expect(dialog.getByRole("status")).toHaveText("Reference added.");
	const link = dialog.getByRole("link", { name: "Listing (opens a new tab)", exact: true });
	await expect(link).toHaveAttribute("href", "https://example.com/listing");
	await page.reload();
	await page.getByRole("button", { name: new RegExp(title) }).click();
	await expect(link).toHaveAttribute("href", "https://example.com/listing");
	// Removing asks for confirmation, then drops the tile.
	page.on("dialog", (notice) => notice.accept());
	await dialog.getByRole("button", { name: "Remove reference Listing", exact: true }).click();
	await expect(dialog.getByRole("status")).toHaveText("Reference removed.");
	await expect(link).toHaveCount(0);
});

test("checklist items reorder by dragging the handle", async ({ page }, info) => {
	test.skip(
		info.project.name !== "desktop",
		"Drag and drop is a fine-pointer enhancement; the item menu covers touch.",
	);
	const title = `QA reorder ${crypto.randomUUID()}`;
	await page.goto("/pipeline");
	const dialog = await createOpportunity(page, title);
	const items = dialog.locator("section[aria-label='Inspected-stage checklist'] li");
	const count = await items.count();
	await dialog.getByRole("button", { name: "Add item", exact: true }).click();
	await dialog.getByLabel("New checklist item", { exact: true }).fill("First");
	await page.keyboard.press("Enter");
	await expect(items.last()).toContainText("First");
	// The add-input stays open across a save, so the next item fills the same field.
	await dialog.getByLabel("New checklist item", { exact: true }).fill("Second");
	await page.keyboard.press("Enter");
	await expect(items.last()).toContainText("Second");
	await items
		.last()
		.getByRole("button", { name: /Reorder Second/ })
		.dragTo(items.nth(count), { targetPosition: { x: 120, y: 10 } });
	await expect(items.nth(count)).toContainText("Second");
	await expect(items.nth(count + 1)).toContainText("First");
	await expect(dialog.getByRole("status")).toHaveText("Checklist item moved.");
	// The handle carries keyboard reordering behind the drag.
	await items
		.last()
		.getByRole("button", { name: /Reorder First/ })
		.press("ArrowUp");
	await expect(dialog.getByRole("status")).toHaveText("Checklist item moved.");
	await expect(items.nth(count)).toContainText("First");
});

test("the opportunity dialog pins and bookmarks", async ({ page }, info) => {
	test.skip(info.project.name !== "desktop", "One bounded pass on the desktop dialog.");
	const title = `QA pin ${crypto.randomUUID()}`;
	await page.goto("/pipeline");
	const dialog = await createOpportunity(page, title);
	await expect(dialog.getByRole("button", { name: "Pin opportunity", exact: true })).toBeVisible();
	await expect(
		dialog.getByRole("button", { name: "Bookmark opportunity", exact: true }),
	).toBeVisible();
	await dialog.getByRole("button", { name: "Pin opportunity", exact: true }).click();
	await expect(dialog.getByRole("status")).toHaveText("Pinned to the top of New lead.");
	await expect(dialog.getByRole("button", { name: "Unpin opportunity", exact: true })).toBeVisible();
	await dialog.getByRole("button", { name: "Bookmark opportunity", exact: true }).click();
	await expect(dialog.getByRole("status")).toHaveText("Kept in the Bookmarks stack.");
	await page.reload();
	await page.getByRole("button", { name: new RegExp(title) }).click();
	await dialog.getByRole("button", { name: "Remove bookmark", exact: true }).click();
	await expect(dialog.getByRole("status")).toHaveText("Removed from the Bookmarks stack.");
});
