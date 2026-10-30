import { expect, test } from "@playwright/test";

test.skip("toolbar reveal waits for intent and remains keyboard accessible", async ({
	page,
}, info) => {
	await page.goto("/pipeline");
	const button = page.getByRole("button", { name: "New opportunity", exact: true });
	const archived = page.getByRole("link", { name: "View archived opportunities", exact: true });
	await expect(button).toBeEnabled();
	for (const control of [button, archived]) {
		const label = control.locator(".control-label");
		if (info.project.name === "desktop") {
			await expect
				.poll(() => label.evaluate((node) => node.getBoundingClientRect().width))
				.toBeLessThan(1);
			await control.hover();
			await expect(label).toHaveCSS("transition-delay", "0.18s");
			await expect
				.poll(() => label.evaluate((node) => node.getBoundingClientRect().width))
				.toBeGreaterThan(45);
			await page.mouse.move(0, 0);
			await control.focus();
			await expect(label).toHaveCSS("transition-delay", "0s");
		} else {
			await expect
				.poll(() => label.evaluate((node) => node.getBoundingClientRect().width))
				.toBeGreaterThan(45);
		}
	}
	await button.click();
	await expect(page.getByRole("dialog")).toBeVisible();
});

test("bottom bookmarks stay within the viewport while resizing and collapsing", async ({
	page,
}, info) => {
	test.skip(info.project.name !== "desktop", "The rail is desktop-only.");
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/pipeline");
	await page.evaluate(() =>
		localStorage.setItem(
			"meadow:bookmarks:business-realtor",
			JSON.stringify([
				"fictional-opportunity-willow",
				"fictional-opportunity-maple",
				"fictional-opportunity-alder",
			]),
		),
	);
	await page.reload();
	const stack = page.getByRole("button", { name: "Bookmarks, 3 opportunities", exact: true });
	const fan = page.getByRole("group", { name: "Bookmarks", exact: true });
	for (const width of [1440, 1024, 834, 375, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await expect(stack).toBeVisible();
		if (width >= 1024) {
			await expect(stack.locator(".stack-count")).toHaveCSS("opacity", "1");
			const collapse = page.getByRole("button", { name: "Collapse sidebar", exact: true });
			await expect
				.poll(async () => (await collapse.boundingBox())!.y - (await stack.boundingBox())!.y)
				.toBeGreaterThan(50);
		}
		await stack.click();
		await expect(fan).toBeVisible();
		const box = (await fan.boundingBox())!;
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y + box.height).toBeLessThanOrEqual(900);
		await page.screenshot({
			path: `/private/var/folders/qd/s59kh68n4p77w44fcr8tnknc0000gn/T/opencode/workspace-${width}.png`,
		});
		await page.keyboard.press("Escape");
	}
	await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
	await stack.click();
	await expect(fan).toBeVisible();
	await page.screenshot({
		path: "/private/var/folders/qd/s59kh68n4p77w44fcr8tnknc0000gn/T/opencode/workspace-collapsed.png",
	});
	await page.keyboard.press("Escape");
	await page.emulateMedia({ reducedMotion: "reduce" });
	await stack.click();
	await expect(fan).toBeVisible();
	await expect(page.locator("html")).toHaveCSS("overscroll-behavior", "none");
	await expect(page.locator(".main-surface")).toHaveCSS("overscroll-behavior", "none");
	await page.keyboard.press("Escape");
	await page.goto("/");
	await stack.click();
	await fan.getByRole("link", { name: /^Maple first home/ }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	expect(errors).toEqual([]);
});
