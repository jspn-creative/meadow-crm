import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { createTestDatabase } from "./test-database.ts";
import type { D1Database } from "@cloudflare/workers-types";
import { seedFictional } from "../../../../scripts/fictional-seed.ts";
import { notToBeContacted } from "../../data/consent.ts";
import { createDataService, DataConflict, DataInvalid } from "../data.ts";
import { seedDefaults } from "./seed.ts";

let proxy: Awaited<ReturnType<typeof createTestDatabase>>;
let db: D1Database;
let realtor: ReturnType<typeof createDataService>;
let assistant: ReturnType<typeof createDataService>;

const newClient = (id: string, name = "Fictional client") => ({
	requestId: crypto.randomUUID(),
	id,
	name,
});

async function clientRow(id: string) {
	const workspace = await realtor.workspace({ archived: false });
	return workspace.clients.find((row) => row.id === id)!;
}

beforeAll(async () => {
	proxy = await createTestDatabase();
	db = proxy.env.DB;
	await seedDefaults(db);
	await seedFictional(db, "2026-10-13");
	realtor = createDataService(db, {
		actorUserId: "business-realtor",
		effectiveUserId: "business-realtor",
		role: "realtor",
	});
	assistant = createDataService(db, {
		actorUserId: "support-admin",
		effectiveUserId: "business-assistant",
		role: "assistant",
	});
}, 30_000);

afterAll(async () => {
	await proxy?.dispose();
});

test("a client saved with every field round-trips through the workspace", async () => {
	const id = crypto.randomUUID();
	const relatedClientId = crypto.randomUUID();
	await realtor.createClient(newClient(relatedClientId, "Fictional related client"));
	await realtor.createClient(newClient(id));

	await assistant.saveClient({
		requestId: crypto.randomUUID(),
		id,
		revision: 1,
		name: "The Millers",
		leadSource: "Open house",
		preferences: "Call after six.",
		preferredContactMethod: "call",
		consentCall: true,
		consentText: false,
		consentEmail: true,
		consentMail: false,
		notes: "Fictional notes",
		people: [
			{
				id: crypto.randomUUID(),
				name: "Ada Maple",
				birthday: "1988-04-12",
				phones: [{ id: crypto.randomUUID(), label: "Home", value: "202-555-0100" }],
				emails: [{ id: crypto.randomUUID(), label: "Work", value: "ada@example.invalid" }],
			},
			{
				id: crypto.randomUUID(),
				name: "Eli Maple",
				birthday: "1986-11-02",
				phones: [{ id: crypto.randomUUID(), label: "Mobile", value: "202-555-0101" }],
				emails: [],
			},
		],
		addresses: [
			{
				id: crypto.randomUUID(),
				label: "Home",
				address: "12 Fictional Lane, Example City",
				owned: true,
			},
			{
				id: crypto.randomUUID(),
				label: "Cabin",
				address: "3 Example Road, Example City",
				owned: false,
			},
		],
		relationships: [{ id: crypto.randomUUID(), relatedClientId, label: "sibling" }],
		keyDates: [{ id: crypto.randomUUID(), name: "Home purchase", date: "2026-11-14" }],
		tagIds: ["tag-sphere"],
	});

	const client = await clientRow(id);
	expect(client).toMatchObject({
		name: "The Millers",
		leadSource: "Open house",
		preferences: "Call after six.",
		preferredContactMethod: "call",
		consentCall: true,
		consentText: false,
		consentEmail: true,
		consentMail: false,
		notes: "Fictional notes",
		revision: 2,
	});
	expect(client.people.map((person) => person.name)).toEqual(["Ada Maple", "Eli Maple"]);
	expect(client.people[0]).toMatchObject({ name: "Ada Maple", birthday: "1988-04-12" });
	expect(client.people[0]!.phones).toEqual([
		expect.objectContaining({ label: "Home", value: "202-555-0100" }),
	]);
	expect(client.people[0]!.emails).toEqual([
		expect.objectContaining({ label: "Work", value: "ada@example.invalid" }),
	]);
	expect(client.people[1]!.emails).toEqual([]);
	expect(client.addresses).toEqual([
		expect.objectContaining({ label: "Home", owned: true }),
		expect.objectContaining({ label: "Cabin", owned: false }),
	]);
	expect(client.relationships).toEqual([
		expect.objectContaining({ relatedClientId, label: "sibling" }),
	]);
	expect(client.keyDates).toEqual([
		expect.objectContaining({ name: "Home purchase", date: "2026-11-14" }),
	]);
	expect(client.tags.map((tag) => tag.name)).toEqual(["sphere"]);

	const workspace = await realtor.workspace({ archived: false });
	expect(
		workspace.history.filter((change) => change.recordId === id).map((change) => change.action),
	).toEqual(["edit", "create"]);
});

test("consent starts on for every channel and survives an edit that leaves it out", async () => {
	const id = crypto.randomUUID();
	await realtor.createClient(newClient(id));
	const channels = (row: {
		consentCall: boolean;
		consentText: boolean;
		consentEmail: boolean;
		consentMail: boolean;
	}) => [row.consentCall, row.consentText, row.consentEmail, row.consentMail];

	let client = await clientRow(id);
	expect(channels(client)).toEqual([true, true, true, true]);
	expect(notToBeContacted(client)).toBe(false);

	await realtor.saveClient({
		requestId: crypto.randomUUID(),
		id,
		revision: client.revision,
		name: "Fictional renamed",
	});
	client = await clientRow(id);
	expect(channels(client)).toEqual([true, true, true, true]);

	await realtor.saveClient({
		requestId: crypto.randomUUID(),
		id,
		revision: client.revision,
		name: "Fictional renamed",
		consentMail: false,
	});
	client = await clientRow(id);
	expect(channels(client)).toEqual([true, true, true, false]);
	expect(notToBeContacted(client)).toBe(false);

	await realtor.saveClient({
		requestId: crypto.randomUUID(),
		id,
		revision: client.revision,
		name: "Fictional renamed",
		consentCall: false,
		consentText: false,
		consentEmail: false,
	});
	client = await clientRow(id);
	expect(channels(client)).toEqual([false, false, false, false]);
	expect(notToBeContacted(client)).toBe(true);
});

test("Referred by is either a linked client or a typed name, never both", async () => {
	const id = crypto.randomUUID();
	const referredByClientId = crypto.randomUUID();
	await realtor.createClient(newClient(referredByClientId, "Fictional referring client"));
	await realtor.createClient(newClient(id));

	await realtor.saveClient({
		requestId: crypto.randomUUID(),
		id,
		revision: 1,
		name: "Fictional referred",
		leadSource: "Referral",
		referredByClientId,
	});
	let client = await clientRow(id);
	expect(client.referredByClientId).toBe(referredByClientId);
	expect(client.referredByName).toBeNull();

	await realtor.saveClient({
		requestId: crypto.randomUUID(),
		id,
		revision: client.revision,
		name: "Fictional referred",
		referredByClientId: null,
		referredByName: "Fictional Lender",
	});
	client = await clientRow(id);
	expect(client.referredByClientId).toBeNull();
	expect(client.referredByName).toBe("Fictional Lender");

	await expect(
		realtor.saveClient({
			requestId: crypto.randomUUID(),
			id,
			revision: client.revision,
			name: "Fictional referred",
			referredByClientId,
			referredByName: "Fictional Lender",
		}),
	).rejects.toBeInstanceOf(DataInvalid);
	await expect(
		realtor.saveClient({
			requestId: crypto.randomUUID(),
			id,
			revision: client.revision,
			name: "Fictional referred",
			referredByClientId: "missing-client",
		}),
	).rejects.toBeInstanceOf(DataConflict);
	await expect(
		realtor.saveClient({
			requestId: crypto.randomUUID(),
			id,
			revision: client.revision,
			name: "Fictional referred",
			referredByClientId: id,
		}),
	).rejects.toBeInstanceOf(DataInvalid);
});

test("a relationship cannot link a client to itself", async () => {
	const id = crypto.randomUUID();
	await realtor.createClient(newClient(id));
	await expect(
		realtor.saveClient({
			requestId: crypto.randomUUID(),
			id,
			revision: 1,
			name: "Fictional self-linked",
			relationships: [{ id: crypto.randomUUID(), relatedClientId: id, label: "sibling" }],
		}),
	).rejects.toBeInstanceOf(DataInvalid);
	const client = await clientRow(id);
	expect(client.relationships).toEqual([]);
	expect(client.revision).toBe(1);
});

test("a stale revision is refused and one client's rows never show under another", async () => {
	const id = crypto.randomUUID();
	const otherId = crypto.randomUUID();
	await realtor.createClient(newClient(id));
	await realtor.createClient(newClient(otherId));
	await realtor.saveClient({
		requestId: crypto.randomUUID(),
		id,
		revision: 1,
		name: "Fictional saved",
		people: [{ id: crypto.randomUUID(), name: "Fictional Person" }],
		addresses: [{ id: crypto.randomUUID(), label: "Home", address: "1 Fictional Lane", owned: true }],
		keyDates: [{ id: crypto.randomUUID(), name: "Fictional date", date: "2026-12-01" }],
		tagIds: ["tag-nurture"],
	});
	const before = JSON.stringify(await clientRow(id));
	await expect(
		realtor.saveClient({
			requestId: crypto.randomUUID(),
			id,
			revision: 1,
			name: "Fictional stale",
		}),
	).rejects.toBeInstanceOf(DataConflict);
	expect(JSON.stringify(await clientRow(id))).toBe(before);

	const other = await clientRow(otherId);
	expect(other.people).toEqual([]);
	expect(other.addresses).toEqual([]);
	expect(other.keyDates).toEqual([]);
	expect(other.tags).toEqual([]);
});

test("a collection left out of a save keeps its rows and the starting tags are sphere and nurture", async () => {
	const id = crypto.randomUUID();
	await realtor.createClient(newClient(id));
	await realtor.saveClient({
		requestId: crypto.randomUUID(),
		id,
		revision: 1,
		name: "Fictional kept",
		people: [{ id: crypto.randomUUID(), name: "Fictional Person" }],
		addresses: [{ id: crypto.randomUUID(), label: "Home", address: "1 Fictional Lane", owned: true }],
		tagIds: ["tag-sphere"],
	});
	const client = await clientRow(id);
	await realtor.saveClient({
		requestId: crypto.randomUUID(),
		id,
		revision: client.revision,
		name: "Fictional kept, renamed",
	});
	const kept = await clientRow(id);
	expect(kept.name).toBe("Fictional kept, renamed");
	expect(kept.people.map((person) => person.name)).toEqual(["Fictional Person"]);
	expect(kept.addresses.map((address) => address.label)).toEqual(["Home"]);
	expect(kept.tags.map((tag) => tag.name)).toEqual(["sphere"]);

	const workspace = await realtor.workspace({ archived: false });
	expect(workspace.tags.map((tag) => tag.name).sort()).toEqual(["nurture", "sphere"]);
});
