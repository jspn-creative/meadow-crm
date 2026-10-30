import { expect, test, type Page } from "@playwright/test";
import { allTerms } from "../src/lib/glossary/tree.ts";

const outlineItem = (page: Page, term: string) =>
	page.locator("[data-outline-item]").filter({ has: page.getByText(term, { exact: true }) });

test.skip("glossary opens from the account menu", async ({ page }, testInfo) => {
	await page.goto("/");
	const account = page.getByRole("button", { name: "Workspace account", exact: true });
	await expect(account).toBeEnabled();
	if (testInfo.project.name === "phone") await account.tap();
	else await account.focus();
	await page.getByRole("link", { name: "Glossary", exact: true }).click();
	await expect(page).toHaveURL(/\/glossary$/);
	await expect(page.getByRole("heading", { name: "Glossary", level: 1 })).toBeVisible();
});

test("search keeps the path to a matching term and lives in the URL", async ({ page }) => {
	await page.goto("/glossary");
	await expect(page.getByRole("button", { name: "Collapse all" })).toBeEnabled();
	await page.getByLabel("Search terms").fill("lead source");
	await expect(page.getByRole("status")).toHaveText("4 matching terms");
	await expect(page.locator("[data-outline-item]")).toHaveCount(4);
	await expect(outlineItem(page, "Registry")).toBeVisible();
	await expect(outlineItem(page, "Client")).toBeVisible();
	await expect(outlineItem(page, "Lead source")).toBeVisible();
	await expect(outlineItem(page, "Tag")).toBeVisible();
	await expect(page).toHaveURL(/\?q=lead\+source$/);
	await page.getByLabel("Search terms").fill("zzz");
	await expect(page.getByText("Nothing matches")).toBeVisible();
	await page.getByRole("button", { name: "Clear search" }).last().click();
	await expect(page.getByRole("status")).toHaveText(`${allTerms.length} terms`);
});

test("a word to avoid points to the term to use", async ({ page }) => {
	await page.goto("/glossary?q=deal");
	await expect(page.getByText("“deal” isn't a Meadow word.")).toBeVisible();
	const say = page.getByRole("button", { name: "Say Opportunity" });
	await expect(say).toBeEnabled();
	await say.click();
	await expect(page.getByLabel("Search terms")).toHaveValue("Opportunity");
	await expect(page.getByRole("heading", { name: "Opportunity", level: 2 }).first()).toBeVisible();
	await outlineItem(page, "Stage").click();
	await expect(page.getByRole("heading", { name: "Stage", level: 2 }).first()).toBeVisible();
});

test.skip("choosing a term shows its detail with a kind tooltip", async ({ page }) => {
	await page.goto("/glossary");
	await expect(page.getByRole("button", { name: "Collapse all" })).toBeEnabled();
	await outlineItem(page, "Client").click();
	const detail = page
		.locator("article")
		.filter({ has: page.getByRole("heading", { name: "Client", level: 2 }) })
		.filter({ visible: true });
	await expect(detail).toBeVisible();
	await expect(detail.getByText("Don't say it this way")).toBeVisible();
	await detail.locator("button[aria-describedby]").focus();
	await expect(detail.getByRole("tooltip")).toBeVisible();
	await expect(detail.getByRole("tooltip")).toContainText("opens in its own detail view");
});

test("branches collapse and expand", async ({ page }) => {
	await page.goto("/glossary");
	await expect(outlineItem(page, "Realtor")).toBeVisible();
	const collapse = page.getByRole("button", { name: "Collapse all" });
	await expect(collapse).toBeEnabled();
	await collapse.click();
	await expect(outlineItem(page, "Realtor")).toHaveCount(0);
	const business = page.getByRole("button", { name: "Show terms under Business" });
	await expect(business).toHaveAttribute("aria-expanded", "false");
	await business.click();
	await expect(outlineItem(page, "User")).toBeVisible();
	await expect(outlineItem(page, "Realtor")).toHaveCount(0);
	await page.getByRole("button", { name: "Expand all" }).click();
	await expect(outlineItem(page, "Realtor")).toBeVisible();
});
