import { test, expect } from "@playwright/test";

test("dashboard fits four compact scores and gives widgets room to wrap", async ({
	page,
}, testInfo) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	for (const width of [375, 640, 768, 1034, 1280, 1440, 1920]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/");
		await page.evaluate(() => document.fonts.ready);
		const scores = await page.locator('[data-interactive="score"]').evaluateAll((elements) =>
			elements.map((element) => {
				const { top, height } = element.getBoundingClientRect();
				return { top, height };
			}),
		);
		expect(new Set(scores.map((score) => score.top)).size).toBe(width < 640 ? 2 : 1);
		for (const score of scores) expect(score.height).toBeLessThanOrEqual(140);
		const layout = await page.locator(".dashboard-content").evaluate((element) => {
			const widgets = Array.from(element.querySelectorAll(":scope > div > section"));
			return {
				overflow: element.scrollWidth > element.clientWidth,
				widths: widgets.map((widget) => widget.getBoundingClientRect().width),
				dividers: widgets.map(
					(widget) => getComputedStyle(widget.firstElementChild!).borderBottomWidth,
				),
			};
		});
		expect(layout.overflow).toBe(false);
		for (const widgetWidth of layout.widths) expect(widgetWidth).toBeGreaterThanOrEqual(280);
		expect(layout.dividers).toEqual(["0px", "0px", "0px", "0px"]);
		await expect(page.locator(".motif img")).toHaveJSProperty("complete", true);
		await expect(page.locator(".motif img")).not.toHaveJSProperty("naturalWidth", 0);
		if ([375, 1034, 1440].includes(width))
			await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`) });
	}
	const task = page.locator("[data-tasks] details").first();
	await task.locator("summary").focus();
	await task.locator("summary").press("Enter");
	await expect(task).toHaveAttribute("open", "");
	await expect(task.getByText("Assigned to the realtor")).toBeVisible();
	expect(errors).toEqual([]);
});

test("background preserves all default Quiet Cream ring paths", async ({ page }) => {
	const referenceResponse = await page.request.get("/dashboards/04-quiet-cream.html");
	expect(referenceResponse.ok()).toBe(true);
	const original = (await referenceResponse.text()).match(
		/<svg data-motif="rings"[\s\S]*?<\/svg>/,
	)![0];
	await page.goto("/");
	const assetUrl = await page.locator(".motif img").getAttribute("src");
	const assetResponse = await page.request.get(assetUrl!);
	expect(assetResponse.ok()).toBe(true);
	const asset = await assetResponse.text();
	const paths = (svg: string) => [...svg.matchAll(/\bd="([^"]+)"/g)].map((match) => match[1]);
	expect(paths(asset)).toEqual(paths(original));
	expect(paths(asset)).toHaveLength(31);
});

test("background moves above the header on small screens and returns to the desktop crop", async ({
	page,
}) => {
	await page.goto("/");
	for (const width of [375, 768, 1034]) {
		await page.setViewportSize({ width, height: 900 });
		const motif = (await page.locator(".motif").boundingBox())!;
		if (width < 1024) {
			expect(motif.x + motif.width / 2).toBeCloseTo(width / 2, 0);
			expect(motif.y).toBe(width < 640 ? -448 : -544);
			expect(motif.width).toBe(width < 640 ? 768 : 960);
		} else {
			expect(motif.x).toBe(-528);
			expect(motif.y).toBe(-368);
			expect(motif.width).toBe(960);
		}
	}
});
