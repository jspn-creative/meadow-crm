import { expect, test, type Page } from "@playwright/test";

const key = "meadow:bookmarks:business-realtor";
const willow = "fictional-opportunity-willow";
const maple = "fictional-opportunity-maple";
const alder = "fictional-opportunity-alder";
const missing = "qa-deleted-opportunity";

async function seed(page: Page, ids: string[], path = "/") {
	await page.goto(path);
	await page.evaluate(
		([key, value]) => localStorage.setItem(key, value),
		[key, JSON.stringify(ids)],
	);
	await page.reload();
}

function saved(page: Page) {
	return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]") as string[], key);
}

test("the bookmarks stack stays hidden without bookmarks", async ({ page }) => {
	await seed(page, []);
	await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
	await expect(page.getByRole("button", { name: /^Bookmarks,/ })).toHaveCount(0);
});

test("archived and unavailable bookmarks stay until removed", async ({ page }) => {
	await seed(page, [missing, alder, willow]);
	const stack = page.getByRole("button", { name: "Bookmarks, 3 opportunities", exact: true });
	await stack.click();
	const fan = page.getByRole("group", { name: "Bookmarks", exact: true });
	await expect(fan.getByRole("link", { name: /^Archived Alder search/ })).toHaveAttribute(
		"href",
		"/pipeline/archived",
	);
	await expect(fan.getByText("No longer available")).toBeVisible();

	await fan
		.getByRole("button", { name: "Remove bookmark: Unavailable opportunity", exact: true })
		.click();
	await expect(
		page.getByRole("status").filter({ hasText: "Removed Unavailable opportunity from bookmarks" }),
	).toBeAttached();
	await expect(fan.getByRole("listitem")).toHaveCount(2);
	await expect(fan.getByRole("link", { name: /^Archived Alder search/ })).toBeFocused();
	await expect(
		page.getByRole("button", { name: "Bookmarks, 2 opportunities", exact: true }),
	).toBeVisible();
	expect(await saved(page)).toEqual([alder, willow]);

	await fan
		.getByRole("button", { name: "Remove bookmark: Archived Alder search", exact: true })
		.click();
	await fan.getByRole("button", { name: "Remove bookmark: Willow home sale", exact: true }).click();
	await expect(page.getByRole("button", { name: /^Bookmarks,/ })).toHaveCount(0);
	await expect(page.locator("#workspace-main")).toBeFocused();
	expect(await saved(page)).toEqual([]);
});

test("bookmarks follow changes made in another tab", async ({ page, context }) => {
	await seed(page, [willow, maple]);
	const other = await context.newPage();
	await other.goto("/registry");
	await expect(
		other.getByRole("button", { name: "Bookmarks, 2 opportunities", exact: true }),
	).toBeVisible();

	await page.getByRole("button", { name: "Bookmarks, 2 opportunities", exact: true }).click();
	await page
		.getByRole("group", { name: "Bookmarks", exact: true })
		.getByRole("button", { name: "Remove bookmark: Maple first home", exact: true })
		.click();
	await expect(
		other.getByRole("button", { name: "Bookmarks, 1 opportunity", exact: true }),
	).toBeVisible();
});
