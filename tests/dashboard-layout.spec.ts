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
		const contentWidth = await page.locator(".dashboard-content").evaluate((element) => {
			const style = getComputedStyle(element);
			return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
		});
		expect(new Set(scores.map((score) => score.top)).size).toBe(contentWidth < 608 ? 2 : 1);
		for (const score of scores) expect(score.height).toBeLessThanOrEqual(118);
		await expect(page.locator('[data-interactive="score"] p.font-display').first()).toHaveCSS(
			"font-size",
			"36px",
		);
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

test("dashboard scores match persisted active pipeline records", async ({ page }) => {
	await page.goto("/");
	const counts = await page.evaluate(async () => {
		const path = "/src/lib/crm.remote.ts";
		const { getWorkspace } = await import(/* @vite-ignore */ path);
		const remote = getWorkspace({ archived: false });
		await remote.refresh();
		const workspace = await remote;
		return ["new-lead", "active-lead", "under-contract", "closed"].map(
			(stage) =>
				workspace.opportunities.filter((row: { stage: string }) => row.stage === stage).length,
		);
	});
	const scores = page.locator('[data-interactive="score"] p.font-display');
	await expect(scores).toHaveText(counts.map(String));
});

test("phone work is visible sooner and due states agree across widgets", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	await page.evaluate(() => document.fonts.ready);
	const firstRow = page
		.locator('[aria-labelledby="attention-heading"] [data-interactive="row"]')
		.first();
	await expect.poll(async () => (await firstRow.boundingBox())!.y).toBeLessThan(620);
	const badges = page.locator('[data-due-state="overdue"]');
	const treatments = await badges.evaluateAll((elements) =>
		elements.map((element) => {
			const style = getComputedStyle(element);
			return { color: style.color, background: style.backgroundColor, radius: style.borderRadius };
		}),
	);
	expect(treatments.length).toBeGreaterThanOrEqual(2);
	for (const treatment of treatments) expect(treatment).toEqual(treatments[0]);
	const undated = page.locator('[data-due-state="undated"]');
	await expect(undated).toHaveText("No due date");
	await expect(undated).toHaveCSS("color", "rgb(117, 109, 96)");
});

test("named content containers adapt while the desktop sidebar changes width", async ({ page }) => {
	await page.setViewportSize({ width: 1080, height: 900 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto("/");
	const workGrid = page.locator(".dashboard-content > div").first();
	await expect(workGrid).toHaveCSS("grid-template-columns", /^\S+$/);
	await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
	await expect(workGrid).toHaveCSS("grid-template-columns", /^\S+ \S+$/);
	await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
	await expect(workGrid).toHaveCSS("grid-template-columns", /^\S+$/);
	await page.getByRole("link", { name: "Pipeline", exact: true }).click();
	const board = page.locator('[class~="@container/board"] > div.grid');
	await expect(board).toHaveCSS("grid-template-columns", /^\S+ \S+$/);
	await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
	await expect(board).toHaveCSS("grid-template-columns", /^\S+ \S+ \S+ \S+$/);
	await page.setViewportSize({ width: 768, height: 900 });
	await expect(page.locator(".workspace")).toHaveAttribute("data-collapsed", "false");
	await expect(board).toHaveCSS("grid-template-columns", /^\S+ \S+$/);
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(board).toHaveCSS("grid-template-columns", /^\S+$/);
});

test("task rows retain their own presentation when reordered and accept neutral extra rows", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/login?next=%2F");
	await page.evaluate(async (path) => {
		const { tasks } = await import(path);
		tasks.reverse();
		tasks.push({
			id: "extra",
			title: "Review the next step",
			due: "No due date",
			dueState: "undated",
		});
	}, "/src/lib/shell/fixtures.ts");
	await page.getByRole("button", { name: "Enter demo workspace" }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator("[data-tasks] details")).toHaveCount(4);
	const call = page.locator('[data-task-id="call"]');
	await call.locator("summary").click();
	await expect(
		call.getByText("Confirm preferred neighborhoods and the next time to catch up."),
	).toBeVisible();
	expect(
		await call.evaluate((element) => getComputedStyle(element).getPropertyValue("--item-hue").trim()),
	).toBe("#e7eef0");
	const extra = page.locator('[data-task-id="extra"]');
	await extra.locator("summary").focus();
	await extra.locator("summary").press("Enter");
	await expect(extra.getByText("Assigned to the realtor")).toBeVisible();
	await expect
		.poll(() => extra.evaluate((element) => getComputedStyle(element, "::before").opacity))
		.toBe("1");
	await expect(extra.locator("summary")).toHaveCSS("outline-width", "2px");
	expect(
		await extra.evaluate((element) =>
			getComputedStyle(element).getPropertyValue("--item-hue").trim(),
		),
	).toBe("#f2efe3");
	expect(errors).toEqual([]);
});

test("widget stagger is explicit and reduced motion removes it", async ({ page }) => {
	await page.goto("/");
	const widgets = page.locator(".dashboard-content [data-widget]");
	const delays = await widgets.evaluateAll((elements) =>
		elements.map((element) => getComputedStyle(element).animationDelay),
	);
	expect(delays).toEqual(["0s", "0.06s", "0.12s", "0.18s", "0.24s"]);
	await page.emulateMedia({ reducedMotion: "reduce" });
	for (const widget of await widgets.all()) await expect(widget).toHaveCSS("animation-name", "none");
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
