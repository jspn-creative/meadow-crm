import { expect, test } from "@playwright/test";

test("client panel creates a client, saves every field and reopens it with the saved details", async ({
	page,
}, info) => {
	const name = `Panel ${info.project.name} ${crypto.randomUUID()}`;
	await page.goto("/registry");
	await page.getByRole("button", { name: "New client", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Client name", { exact: true }).fill(name);
	await dialog.getByRole("button", { name: "Create client", exact: true }).click();
	await expect(dialog.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
	await dialog.getByLabel("Lead source", { exact: true }).selectOption("A referral");
	await dialog.getByRole("button", { name: "Add person", exact: true }).click();
	await dialog.getByLabel("Person 1 name", { exact: true }).fill("Fictional Person");
	await dialog.getByLabel("Person 1 birthday", { exact: true }).fill("1980-04-12");
	await dialog.getByRole("button", { name: "Add phone", exact: true }).click();
	await dialog.getByLabel("Person 1 phone 1 label", { exact: true }).fill("Mobile");
	await dialog.getByLabel("Person 1 phone 1 number", { exact: true }).fill("555-0142");
	await dialog.getByRole("button", { name: "Add email", exact: true }).click();
	await dialog.getByLabel("Person 1 email 1 label", { exact: true }).fill("Work");
	await dialog.getByLabel("Person 1 email 1 address", { exact: true }).fill("fictional@example.com");
	await dialog.getByRole("button", { name: "Add address", exact: true }).click();
	await dialog.getByLabel("Address 1 label", { exact: true }).fill("Home");
	await dialog.getByLabel("Address 1", { exact: true }).fill("123 Fictional Lane");
	await dialog.getByRole("button", { name: "Add key date", exact: true }).click();
	await dialog.getByLabel("Key date 1 name", { exact: true }).fill("Wedding anniversary");
	await dialog.getByLabel("Key date 1 date", { exact: true }).fill("2001-06-02");
	await dialog.getByRole("button", { name: "Save client", exact: true }).click();
	await expect(page.getByText("Client saved.", { exact: true })).toBeVisible();
	await dialog.getByRole("checkbox", { name: "Call", exact: true }).uncheck();
	await dialog.getByRole("checkbox", { name: "Text", exact: true }).uncheck();
	await dialog.getByRole("checkbox", { name: "Email", exact: true }).uncheck();
	await dialog.getByRole("checkbox", { name: "Mail", exact: true }).uncheck();
	await expect(dialog.getByText("marked as not to be contacted", { exact: false })).toBeVisible();
	await dialog.getByRole("button", { name: "Save client", exact: true }).click();
	await expect(page.getByText("Client saved.", { exact: true })).toBeVisible();
	await dialog.getByRole("button", { name: "Close", exact: true }).click();
	await expect(dialog).not.toBeVisible();
	await page.reload();
	await page.getByRole("button", { name, exact: true }).click();
	await expect(dialog.getByLabel("Lead source", { exact: true })).toHaveValue("A referral");
	await expect(dialog.getByLabel("Person 1 name", { exact: true })).toHaveValue("Fictional Person");
	await expect(dialog.getByLabel("Person 1 birthday", { exact: true })).toHaveValue("1980-04-12");
	await expect(dialog.getByLabel("Person 1 phone 1 number", { exact: true })).toHaveValue(
		"555-0142",
	);
	await expect(dialog.getByLabel("Person 1 email 1 address", { exact: true })).toHaveValue(
		"fictional@example.com",
	);
	await expect(dialog.getByLabel("Address 1", { exact: true })).toHaveValue("123 Fictional Lane");
	await expect(dialog.getByLabel("Key date 1 name", { exact: true })).toHaveValue(
		"Wedding anniversary",
	);
	await expect(dialog.getByText("marked as not to be contacted", { exact: false })).toBeVisible();
	await expect(dialog.getByText("No opportunities yet.", { exact: true })).toBeVisible();
	await dialog.getByText("History", { exact: true }).click();
	await expect(dialog.getByText(/edit · Realtor/).first()).toBeVisible();
});

test("client panel closes on Escape and returns focus to the client that opened it", async ({
	page,
}) => {
	await page.goto("/registry");
	const dialog = page.getByRole("dialog");
	await page.getByRole("button", { name: "New client", exact: true }).click();
	await expect(
		dialog.getByRole("heading", { level: 2, name: "New client", exact: true }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(dialog).not.toBeVisible();
	await expect(page.getByRole("button", { name: "New client", exact: true })).toBeFocused();
});
