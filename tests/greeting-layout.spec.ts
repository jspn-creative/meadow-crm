import { test, expect } from "@playwright/test";

for (const width of [375, 768, 1023]) {
	test(`scroll smoothly reclaims the greeting at ${width}px without a collapse button`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto("/");
		await expect(page.getByRole("button", { name: "Workspace account" })).toBeEnabled();
		await page.evaluate(() => document.fonts.ready);
		const greeting = page.getByText("Good morning, Meadow Lane.").locator("..");
		const main = page.locator("#workspace-main");
		await expect(
			page.getByRole("button", { name: /Collapse navigation|Collapse sidebar/ }),
		).toBeHidden();
		const expandedGreeting = (await greeting.boundingBox())!.height;
		const expandedMain = (await main.boundingBox())!.height;
		await main.evaluate((element) => {
			element.scrollTop = 120;
		});
		await expect(greeting).toHaveAttribute("inert", "");
		const frames = await greeting.evaluate(async (element) => {
			const heights: number[] = [];
			for (let index = 0; index < 30; index++) {
				await new Promise(requestAnimationFrame);
				heights.push(element.getBoundingClientRect().height);
			}
			return heights;
		});
		expect(frames.some((height) => height > 1 && height < expandedGreeting - 1)).toBe(true);
		await expect.poll(async () => (await greeting.boundingBox())!.height).toBe(0);
		expect((await main.boundingBox())!.height).toBeGreaterThan(expandedMain + expandedGreeting);
		await main.evaluate((element) => {
			element.scrollTop = 12;
		});
		await expect(greeting).toHaveAttribute("inert", "");
		await main.evaluate((element) => {
			element.scrollTop = 0;
		});
		await expect
			.poll(async () => (await greeting.boundingBox())!.height)
			.toBeCloseTo(expandedGreeting, 0);
		await expect(greeting).not.toHaveAttribute("inert");
	});
}

test("desktop collapse stays desktop-only after resizing and reduced motion stays immediate", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	await page.getByRole("button", { name: "Collapse sidebar" }).click();
	await expect(page.locator(".workspace")).toHaveAttribute("data-collapsed", "true");
	await page.setViewportSize({ width: 768, height: 900 });
	await expect(page.locator(".workspace")).toHaveAttribute("data-collapsed", "false");
	const greeting = page.getByText("Good morning, Meadow Lane.").locator("..");
	await expect(greeting).not.toHaveAttribute("inert");
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.locator("#workspace-main").evaluate((element) => {
		element.scrollTop = 120;
	});
	await expect.poll(async () => (await greeting.boundingBox())!.height).toBe(0);
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
});
