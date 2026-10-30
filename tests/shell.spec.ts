import { test, expect } from "@playwright/test";

test.skip("dashboard character, empty states, and exactly three module destinations", async ({
	page,
}) => {
	await page.goto("/");
	const nav = page.getByRole("navigation", { name: "Sections" });
	await expect(nav.getByRole("link")).toHaveCount(3);
	for (const name of ["Dashboard", "Pipeline", "Registry"])
		await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
	await expect(
		page
			.getByRole("list", { name: "No workspace activity yet. A playful history of the universe." })
			.getByRole("listitem"),
	).toHaveCount(4);
	await expect(page.getByText("Nothing on the calendar for the next two weeks.")).toBeVisible();
	await expect(page.getByText("One shared dashboard", { exact: false })).toHaveCount(0);
	const colors = await page
		.locator('[data-interactive="score"]')
		.evaluateAll((elements) =>
			elements.map((element) => getComputedStyle(element).getPropertyValue("--item-hue").trim()),
		);
	expect(new Set(colors).size).toBe(4);
	const task = page.locator("[data-tasks] details").first();
	await task.locator("summary").click();
	await expect(task).toHaveAttribute("open", "");
	await expect(task.getByText("Assigned to the realtor")).toBeVisible();
});

test.skip("account chip reveals Settings and demo login for keyboard and touch", async ({
	page,
}, testInfo) => {
	await page.goto("/");
	const login = page.getByRole("link", { name: "Demo login", exact: true });
	await expect(login).toBeHidden();
	const account = page.getByRole("button", { name: "Workspace account", exact: true });
	await expect(account).toBeEnabled();
	if (testInfo.project.name === "phone") await account.tap();
	else await account.focus();
	await expect(login).toBeVisible();
	await page.getByRole("link", { name: "Settings", exact: true }).click();
	await expect(page).toHaveURL(/\/settings$/);
	await expect
		.poll(() => page.locator("#workspace-main").evaluate((element) => element.scrollTop))
		.toBe(0);
	const sections = page.getByRole("navigation", { name: "Settings sections" });
	await sections.getByRole("link", { name: "Pipeline", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Checklist defaults" })).toBeVisible();
	await page.getByLabel("Opportunity type", { exact: true }).selectOption("Seller");
	await expect(page.getByRole("button", { name: "Edit Seller New lead template" })).toBeDisabled();
	await sections.getByRole("link", { name: "Client registry", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Client tags" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Manage sphere tag" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Manage nurture tag" })).toBeVisible();
	await expect(page.getByRole("button", { name: /Manage .* tag/ })).toHaveCount(2);
	await expect(page.getByText("referral", { exact: true })).toHaveCount(0);
	await page.goBack();
	await expect(page.getByRole("heading", { name: "Checklist defaults" })).toBeVisible();
	await sections.getByRole("link", { name: "General", exact: true }).click();
	await expect(page.getByLabel("Business name", { exact: true })).toHaveValue(
		"Meadow Lane Realty & Development",
	);
	await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
});

test.skip("Quiet Cream score wash supports focus and reduced motion", async ({
	page,
}, testInfo) => {
	await page.goto("/");
	const score = page.locator('[data-interactive="score"]').first();
	await score.focus();
	await expect
		.poll(() => score.evaluate((element) => getComputedStyle(element, "::before").opacity))
		.toBe("1");
	await expect(score).toBeFocused();
	if (testInfo.project.name === "desktop") {
		await score.hover();
		await expect
			.poll(() => score.evaluate((element) => getComputedStyle(element).transform))
			.not.toBe("none");
		await page.emulateMedia({ reducedMotion: "reduce" });
		await expect
			.poll(() => score.evaluate((element) => getComputedStyle(element).transform))
			.toBe("none");
		await expect
			.poll(() => score.evaluate((element) => getComputedStyle(element, "::before").opacity))
			.toBe("1");
	}
});

test.skip("compiled native controls expose focus, disabled, press, and pending states", async ({
	page,
}) => {
	await page.goto("/registry");
	const field = page.getByLabel("Search clients", { exact: true });
	await expect(field).toBeEnabled();
	await field.focus();
	await expect(field).toBeFocused();
	await expect
		.poll(() => field.evaluate((element) => getComputedStyle(element).outlineWidth))
		.toBe("2px");
	await page.getByRole("button", { name: "New client", exact: true }).click();
	await expect(page.getByRole("dialog").getByLabel("Client name", { exact: true })).toBeVisible();
	await page.goto("/login?next=%2Fregistry");
	const submit = page.getByRole("button", { name: "Enter demo workspace" });
	await expect(submit).toBeEnabled();
	await expect
		.poll(() => submit.evaluate((element) => getComputedStyle(element).minHeight))
		.toBe("44px");
	const bounds = await submit.boundingBox();
	await page.mouse.move(bounds!.x + 20, bounds!.y + 20);
	await page.mouse.down();
	await expect
		.poll(() => submit.evaluate((element) => getComputedStyle(element).transform))
		.not.toBe("none");
	await page.mouse.move(0, 0);
	await page.mouse.up();
	await page.route("**/src/routes/registry/+page.svelte*", async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 600));
		await route.continue();
	});
	await submit.click();
	const pending = page.getByRole("button", { name: "Opening preview…" });
	await expect(pending).toHaveAttribute("aria-busy", "true");
	await expect(pending).toBeDisabled();
	await expect(field).toBeVisible();
});

test("destinations, history, dashboard tasks, and uncluttered workspace", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute(
		"aria-current",
		"page",
	);
	await expect(page.getByText(/fictional|no records are saved/i)).toHaveCount(0);
	await page.getByRole("link", { name: "Registry", exact: true }).click();
	await expect(page.getByLabel("Search clients", { exact: true })).toBeVisible();
	await page.getByRole("link", { name: "Pipeline", exact: true }).click();
	await expect(page.getByRole("link", { name: "Pipeline", exact: true })).toHaveAttribute(
		"aria-current",
		"page",
	);
	await page.goBack();
	await expect(page.getByRole("link", { name: "Registry", exact: true })).toHaveAttribute(
		"aria-current",
		"page",
	);
	await page.goForward();
	await expect(page.getByRole("link", { name: "Pipeline", exact: true })).toHaveAttribute(
		"aria-current",
		"page",
	);
	await expect(page.getByRole("link", { name: "Tasks", exact: true })).toHaveCount(0);
	await page.getByRole("link", { name: "Dashboard", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Today's Tasks" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
	await expect(
		page
			.getByRole("navigation", { name: "Sections" })
			.getByRole("link", { name: "Tasks", exact: true }),
	).toHaveCount(0);
	await expect(page.getByRole("link", { name: "Calendar", exact: true })).toHaveCount(0);
});

test("sidebar retains route, search draft, and focus through interruption", async ({
	page,
}, testInfo) => {
	await page.goto("/registry");
	await page.getByLabel("Search clients", { exact: true }).fill("Jamie");
	if (testInfo.project.name === "phone") {
		await expect(
			page.getByRole("button", { name: /Collapse navigation|Collapse sidebar/ }),
		).toBeHidden();
		await expect(page.getByLabel("Search clients", { exact: true })).toHaveValue("Jamie");
		return;
	}
	const collapseName = "Collapse sidebar";
	const expandName = "Expand sidebar";
	const collapse = page.getByRole("button", { name: collapseName, exact: true });
	await expect(collapse).toBeEnabled();
	await collapse.focus();
	await collapse.press("Enter");
	await expect(page.getByRole("button", { name: expandName, exact: true })).toBeFocused();
	const expand = page.getByRole("button", { name: expandName, exact: true });
	await expand.press("Enter");
	await expect(page.getByLabel("Search clients", { exact: true })).toHaveValue("Jamie");
	await expect(page).toHaveURL(/\/registry$/);
	await expect(page.getByRole("link", { name: "Registry", exact: true })).toHaveAttribute(
		"aria-current",
		"page",
	);
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth,
	);
	expect(overflow).toBe(false);
});

for (const fallback of ["normal", "reduced", "unsupported"] as const) {
	test(`demo login reaches the requested route: ${fallback}`, async ({ page }) => {
		if (fallback === "reduced") await page.emulateMedia({ reducedMotion: "reduce" });
		if (fallback === "unsupported")
			await page.addInitScript(() => {
				Object.defineProperty(document, "startViewTransition", { value: undefined });
			});
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.goto("/login?next=%2Fregistry");
		await expect(page.locator('input[type="password"]')).toHaveCount(0);
		await page.getByRole("button", { name: "Enter demo workspace" }).click();
		await expect(page.getByLabel("Search clients", { exact: true })).toBeVisible({ timeout: 3000 });
		await expect(page).toHaveURL(/\/registry$/);
		expect(errors).toEqual([]);
	});
}

test("slow and interrupted navigation cannot strand the shell", async ({ page }) => {
	await page.goto("/");
	await page.route("**/src/routes/registry/+page.svelte*", async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 900));
		await route.continue();
	});
	await page.getByRole("link", { name: "Registry", exact: true }).click();
	await expect(page.getByLabel("Search clients", { exact: true })).toBeVisible({ timeout: 4000 });
	await page.getByRole("link", { name: "Pipeline", exact: true }).click();
	await page.getByRole("button", { name: "Workspace account", exact: true }).click();
	await page.getByRole("link", { name: "Settings", exact: true }).click();
	await expect(page).toHaveURL(/\/settings$/);
	await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(
				() => document.getAnimations().filter((animation) => animation.playState === "running").length,
			),
		)
		.toBe(0);
});
