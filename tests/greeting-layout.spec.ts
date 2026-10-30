import { test, expect } from "@playwright/test";

test("desktop collapse stays desktop-only after resizing", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	await page.getByRole("button", { name: "Collapse sidebar" }).click();
	await expect(page.locator(".workspace")).toHaveAttribute("data-collapsed", "true");
	await page.setViewportSize({ width: 768, height: 900 });
	await expect(page.locator(".workspace")).toHaveAttribute("data-collapsed", "false");
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
});

test("short desktop viewports shed rail chrome progressively and fade scrolled content", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto("/");
	await page.evaluate(() => document.fonts.ready);
	// Assert on the motion wrapper's height: a collapsed overflow-hidden wrapper
	// still reports its full inner paragraph height.
	const wrapper = page.getByText("Good morning, Meadow Lane.").locator("..");
	const wrapperHeight = () => wrapper.evaluate((element) => element.getBoundingClientRect().height);
	const collapse = page.getByRole("button", { name: "Collapse sidebar", exact: true });
	const content = page.locator(".dashboard-content");
	const main = page.locator("#workspace-main");

	expect(await wrapperHeight()).toBeGreaterThan(50);
	await expect(collapse).toBeVisible();

	await page.setViewportSize({ width: 1280, height: 460 });
	await expect.poll(wrapperHeight).toBe(0);
	await expect(collapse).toBeVisible();
	await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Workspace account" })).toBeVisible();

	await page.setViewportSize({ width: 1280, height: 350 });
	await expect(collapse).toBeHidden();
	await expect(page.getByRole("link", { name: "Pipeline", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Workspace account" })).toBeVisible();

	await page.setViewportSize({ width: 1280, height: 900 });
	await expect.poll(wrapperHeight).toBeGreaterThan(50);

	await expect(content).toHaveCSS("mask-image", /linear-gradient/);
	await expect(main).toHaveCSS("mask-image", "none");
	await expect(content).toHaveCSS("transition-property", "none");
	// Stops are viewport-relative pixels: at rest the fade sits at the bottom edge,
	// and scrolling moves a fade onto the top edge.
	const mask = () => content.evaluate((element) => getComputedStyle(element).maskImage);
	expect(await mask()).toMatch(/rgba\(0, 0, 0, 0\) 0px/);
	await main.evaluate((element) => element.scrollTo({ top: 9999 }));
	await expect.poll(mask).toMatch(/rgba\(0, 0, 0, 0\) [1-9]/);
});
