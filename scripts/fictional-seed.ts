import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import type { activity } from "../src/lib/server/db/schema.ts";

const receiptId = "fictional-seed-v1";
const activityReceiptId = "fictional-activity-v1";
const relativeDate = (today: string, offset: number) => {
	const date = new Date(`${today}T12:00:00Z`);
	date.setUTCDate(date.getUTCDate() + offset);
	return date.toISOString().slice(0, 10);
};

// This module is CLI/test-only. Never import it into the app or production defaults.
export async function seedFictional(db: D1Database, today: string) {
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(today) ||
		new Date(`${today}T12:00:00Z`).toISOString().slice(0, 10) !== today
	)
		throw new Error("Use a valid YYYY-MM-DD fixture date.");
	const previous = await db
		.prepare("SELECT result FROM mutation_receipts WHERE id = ?")
		.bind(receiptId)
		.first<string>("result");
	if (!previous) await seedFictionalRecords(db, today);
	await seedFictionalActivity(
		db,
		previous ? (JSON.parse(previous) as { today: string }).today : today,
	);
}

async function seedFictionalRecords(db: D1Database, today: string) {
	const now = `${today}T12:00:00.000Z`;
	const statements: D1PreparedStatement[] = [];
	const clients: {
		id: string;
		name: string;
		tag: string;
		birthday: string | null;
		preferences: string;
		contact: "call" | "text" | "email" | "mail" | null;
		referredByClient?: string;
		referredByName?: string;
	}[] = [
		{
			id: "ada",
			name: "Ada Maple",
			tag: "sphere",
			birthday: "1988-04-12",
			preferences: "Email first, then call after 9am.",
			contact: "email",
		},
		{
			id: "eli",
			name: "Eli Maple",
			tag: "sphere",
			birthday: "1986-11-02",
			preferences: "",
			contact: null,
			referredByClient: "ada",
		},
		{
			id: "mira",
			name: "Mira Willow",
			tag: "nurture",
			birthday: "1979-07-23",
			preferences: "Wants a short check-in each season.",
			contact: "text",
			referredByName: "Fictional Lender",
		},
		{ id: "leo", name: "Leo Birch", tag: "sphere", birthday: null, preferences: "", contact: null },
		{
			id: "inez",
			name: "Inez Cedar",
			tag: "sphere",
			birthday: "1968-09-05",
			preferences: "",
			contact: "mail",
		},
		{
			id: "remy",
			name: "Remy Alder",
			tag: "nurture",
			birthday: "2001-05-18",
			preferences: "",
			contact: null,
		},
	];
	for (const client of clients) {
		statements.push(
			db
				.prepare(
					"INSERT INTO clients (id, name, lead_source, preferences, preferred_contact_method, referred_by_client_id, referred_by_name, archived_at, fictional, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
				)
				.bind(
					`fictional-client-${client.id}`,
					client.name,
					client.referredByClient || client.referredByName ? "Referral" : "Website",
					client.preferences,
					client.contact,
					client.referredByClient ? `fictional-client-${client.referredByClient}` : null,
					client.referredByName ?? null,
					client.id === "remy" ? now : null,
					now,
					now,
				),
			db
				.prepare("INSERT INTO client_tags (client_id, tag_id) VALUES (?, ?)")
				.bind(`fictional-client-${client.id}`, `tag-${client.tag}`),
			db
				.prepare(
					"INSERT INTO client_people (id, client_id, name, birthday, position, revision, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 1, ?, ?)",
				)
				.bind(
					`fictional-person-${client.id}`,
					`fictional-client-${client.id}`,
					client.name,
					client.birthday,
					now,
					now,
				),
			db
				.prepare(
					"INSERT INTO person_phones (id, person_id, label, value, position, revision, created_at, updated_at) VALUES (?, ?, 'Home', '202-555-0100', 0, 1, ?, ?)",
				)
				.bind(`fictional-phone-${client.id}`, `fictional-person-${client.id}`, now, now),
			db
				.prepare(
					"INSERT INTO person_emails (id, person_id, label, value, position, revision, created_at, updated_at) VALUES (?, ?, 'Home', ?, 0, 1, ?, ?)",
				)
				.bind(
					`fictional-email-${client.id}`,
					`fictional-person-${client.id}`,
					`${client.id}@example.invalid`,
					now,
					now,
				),
		);
	}
	for (const [id, label, address, owned] of [
		["ada", "Home", "12 Fictional Lane, Example City", 0],
		["inez", "Lake house", "88 Example Road, Example City", 1],
	] as const) {
		statements.push(
			db
				.prepare(
					"INSERT INTO client_addresses (id, client_id, label, address, owned, position, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)",
				)
				.bind(`fictional-address-${id}`, `fictional-client-${id}`, label, address, owned, now, now),
		);
	}
	statements.push(
		db
			.prepare(
				"INSERT INTO client_relationships (id, client_id, related_client_id, label, revision, created_at, updated_at) VALUES ('fictional-relationship-eli-ada', 'fictional-client-eli', 'fictional-client-ada', 'sibling', 1, ?, ?)",
			)
			.bind(now, now),
	);
	for (const [id, name, date] of [
		["ada", "Home purchase", "2026-11-14"],
		["mira", "Wedding anniversary", "2026-09-05"],
	] as const) {
		statements.push(
			db
				.prepare(
					"INSERT INTO client_key_dates (id, client_id, name, date, revision, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
				)
				.bind(`fictional-key-date-${id}`, `fictional-client-${id}`, name, date, now, now),
		);
	}
	const opportunities = [
		{
			id: "maple",
			title: "Maple first home",
			type: "buyer",
			stage: "new-lead",
			timeline: "1-3-mo",
			clients: ["ada", "eli"],
		},
		{
			id: "willow",
			title: "Willow home sale",
			type: "seller",
			stage: "active-lead",
			timeline: "3-6-mo",
			clients: ["mira"],
		},
		{
			id: "birch",
			title: "Birch family introduction",
			type: "estate-sale",
			stage: "under-contract",
			timeline: null,
			clients: ["leo", "mira"],
		},
		{
			id: "cedar",
			title: "Cedar porch restoration",
			type: "construction",
			stage: "closed",
			timeline: "6-plus-mo",
			clients: ["inez"],
		},
		{
			id: "alder",
			title: "Archived Alder search",
			type: "buyer",
			stage: "active-lead",
			timeline: null,
			clients: ["remy"],
		},
	];
	for (const opportunity of opportunities) {
		const id = `fictional-opportunity-${opportunity.id}`;
		statements.push(
			db
				.prepare(
					"INSERT INTO opportunities (id, title, type, stage, timeline, budget_cents, archived_at, fictional, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
				)
				.bind(
					id,
					opportunity.title,
					opportunity.type,
					opportunity.stage,
					opportunity.timeline,
					opportunity.id === "maple" ? 42500050 : null,
					opportunity.id === "alder" ? now : null,
					now,
					now,
				),
		);
		for (const client of opportunity.clients)
			statements.push(
				db
					.prepare("INSERT INTO opportunity_clients VALUES (?, ?)")
					.bind(id, `fictional-client-${client}`),
			);
		const visited =
			opportunity.id === "birch" ? ["active-lead", opportunity.stage] : [opportunity.stage];
		for (const stage of visited) {
			const checklistId = `${id}-${stage}`;
			const templateId = `default-${opportunity.type}-${stage}`;
			statements.push(
				db
					.prepare(
						"INSERT INTO stage_checklists (id, opportunity_id, stage, template_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
					)
					.bind(checklistId, id, stage, templateId, now, now),
			);
			const items = (
				await db
					.prepare("SELECT id FROM checklist_items WHERE template_id = ? ORDER BY position LIMIT 4")
					.bind(templateId)
					.all<{ id: string }>()
			).results;
			for (const [index, item] of items.entries())
				statements.push(
					db
						.prepare(
							"INSERT INTO checklist_progress (checklist_id, item_id, completed_at, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
						)
						.bind(
							checklistId,
							item.id,
							index === 0 ? now : null,
							index === 0 ? relativeDate(today, -3) : relativeDate(today, index - 2),
							now,
							now,
						),
				);
		}
		statements.push(
			db
				.prepare(
					"INSERT INTO history (id, record_kind, record_id, actor_user_id, effective_user_id, action, data, fictional, created_at) VALUES (?, 'opportunity', ?, 'local-seed', 'business-realtor', 'seed', ?, 1, ?)",
				)
				.bind(
					`${id}-history`,
					id,
					JSON.stringify({ title: opportunity.title, stage: opportunity.stage }),
					now,
				),
		);
	}
	for (const [id, title, offset, completed, opportunityId] of [
		["call", "Confirm the Maple consultation", -1, false, "fictional-opportunity-maple"],
		["quote", "Review the Cedar materials quote", 0, false, "fictional-opportunity-cedar"],
		["research", "Review the fictional market notes", 1, false, null],
		["done", "Send the Willow introduction", -2, true, "fictional-opportunity-willow"],
		["undated", "Organize the example contacts", null, false, null],
		[
			"archived-link",
			"Follow up on the archived Alder search",
			-1,
			false,
			"fictional-opportunity-alder",
		],
	] as const) {
		statements.push(
			db
				.prepare(
					"INSERT INTO tasks (id, title, assigned_user_id, opportunity_id, date, due_date, completed_at, fictional, created_at, updated_at) VALUES (?, ?, 'business-realtor', ?, ?, ?, ?, 1, ?, ?)",
				)
				.bind(
					`fictional-task-${id}`,
					title,
					opportunityId,
					relativeDate(today, offset ?? 0),
					offset === null ? null : relativeDate(today, offset),
					completed ? now : null,
					now,
					now,
				),
		);
	}
	statements.push(
		db
			.prepare(
				"INSERT INTO record_references (id, opportunity_id, label, kind, url, created_at, updated_at) VALUES ('fictional-reference-maple', 'fictional-opportunity-maple', 'Example consultation notes', 'url', 'https://example.com/consultation', ?, ?)",
			)
			.bind(now, now),
	);
	statements.push(
		db
			.prepare(
				"INSERT INTO mutation_receipts (id, actor_user_id, effective_user_id, payload_hash, result, created_at) VALUES (?, 'local-seed', 'business-realtor', 'fictional-v1', ?, ?)",
			)
			.bind(receiptId, JSON.stringify({ today }), now),
	);
	await db.batch(statements);
}

type DemoActivity = Pick<typeof activity.$inferSelect, "kind" | "body"> &
	Partial<
		Pick<
			typeof activity.$inferSelect,
			"channel" | "channelLabel" | "direction" | "outcome" | "detail" | "automated"
		>
	> & {
		id: string;
		offset: number;
		imported?: boolean;
		client?: string;
		opportunities?: string[];
	};

const demoActivity: DemoActivity[] = [
	{
		id: "willow-needs",
		kind: "note",
		offset: -365,
		imported: true,
		client: "mira",
		body: "Mira would like to sell after the holidays. Ask about repairs before choosing a date.",
	},
	{
		id: "willow-report",
		kind: "note",
		offset: -360,
		imported: true,
		client: "mira",
		body: "Sent a market report for Example City",
		detail: {
			event: { summary: "sent a market report for Example City", automation: "market-report" },
		},
	},
	{
		id: "willow-intro",
		kind: "contact",
		offset: -359,
		imported: true,
		client: "mira",
		channel: "text",
		direction: "outgoing",
		automated: true,
		body: "Hi Mira, are you still looking for help with a sale?",
	},
	{
		id: "willow-reply",
		kind: "contact",
		offset: -357,
		imported: true,
		client: "mira",
		channel: "text",
		direction: "incoming",
		body: "Yes, please call me after 4.",
	},
	{
		id: "willow-voicemail",
		kind: "contact",
		offset: -356,
		imported: true,
		client: "mira",
		channel: "call",
		direction: "outgoing",
		outcome: "voicemail",
		body: "Left a number to call back.",
	},
	{
		id: "willow-zillow",
		kind: "contact",
		offset: -350,
		imported: true,
		client: "mira",
		channel: "zillow",
		direction: "incoming",
		body: "Is the Juniper Court house still available?",
		detail: { fields: [{ label: "Property", value: "18 Example Juniper Court" }] },
	},
	{
		id: "maple-note",
		kind: "note",
		offset: -6,
		client: "ada",
		body: "Ada and Eli want to see homes near a bus route.",
	},
	{
		id: "maple-call",
		kind: "contact",
		offset: -5,
		opportunities: ["maple"],
		channel: "call",
		direction: "outgoing",
		outcome: "talked",
		body: "Agreed to meet on Saturday.",
	},
	{
		id: "willow-sale-note",
		kind: "note",
		offset: -4,
		opportunities: ["willow"],
		body: "Take a second look at the porch before estimating repair costs.",
	},
	{
		id: "willow-meeting",
		kind: "contact",
		offset: -3,
		opportunities: ["willow", "birch"],
		channel: "meeting",
		direction: "outgoing",
		outcome: "met",
		body: "Discussed the home sale and the family's estate sale in one visit.",
	},
	{
		id: "willow-returned-email",
		kind: "contact",
		offset: -2,
		client: "mira",
		channel: "email",
		direction: "outgoing",
		outcome: "bounced",
		body: "The property summary came back undelivered.",
	},
	{
		id: "willow-card",
		kind: "contact",
		offset: -1,
		client: "mira",
		channel: "other",
		channelLabel: "Mailed card",
		direction: "outgoing",
		body: "Sent a handwritten thank-you card.",
	},
];

async function seedFictionalActivity(db: D1Database, today: string) {
	if (
		await db.prepare("SELECT id FROM mutation_receipts WHERE id = ?").bind(activityReceiptId).first()
	)
		return;
	const now = `${today}T12:00:00.000Z`;
	const statements: D1PreparedStatement[] = [];
	for (const row of demoActivity) {
		const id = `fictional-activity-${row.id}`;
		const clientId = row.client ? `fictional-client-${row.client}` : null;
		const opportunityIds = (row.opportunities ?? []).map((id) => `fictional-opportunity-${id}`);
		const at = `${relativeDate(today, row.offset)}T12:00:00.000Z`;
		const author = row.imported ? "support-admin" : "business-realtor";
		statements.push(
			db
				.prepare(
					`INSERT INTO activity (id, client_id, opportunity_id, kind, channel, channel_label, direction, outcome, occurred_at, body, detail, actor_user_id, effective_user_id, client_is_actor, imported, automated, fictional, created_at, updated_at)
			SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?
			WHERE (? IS NULL OR EXISTS (SELECT 1 FROM clients WHERE id = ? AND fictional = 1))
			AND (SELECT count(*) FROM opportunities WHERE fictional = 1 AND id IN (SELECT value FROM json_each(?))) = ?`,
				)
				.bind(
					id,
					clientId,
					row.kind === "note" ? (opportunityIds[0] ?? null) : null,
					row.kind,
					row.channel ?? null,
					row.channelLabel ?? null,
					row.direction ?? null,
					row.outcome ?? null,
					at,
					row.body,
					JSON.stringify(row.detail ?? {}),
					author,
					author,
					Number(row.direction === "incoming"),
					Number(Boolean(row.imported)),
					Number(Boolean(row.automated)),
					at,
					at,
					clientId,
					clientId,
					JSON.stringify(opportunityIds),
					opportunityIds.length,
				),
		);
		if (row.kind === "contact")
			for (const oppId of opportunityIds)
				statements.push(
					db
						.prepare("INSERT INTO activity_opportunities SELECT id, ? FROM activity WHERE id = ?")
						.bind(oppId, id),
				);
	}
	statements.push(
		db
			.prepare(
				`INSERT INTO history (id, record_kind, record_id, actor_user_id, effective_user_id, action, data, fictional, created_at)
			 SELECT 'fictional-mira-activity-history', 'client', id, 'business-assistant', 'business-assistant', 'edit',
			 '{"before":{"preferredContactMethod":"call"},"after":{"preferredContactMethod":"text"}}', 1, ?
			 FROM clients WHERE id = 'fictional-client-mira' AND fictional = 1`,
			)
			.bind(`${relativeDate(today, -8)}T12:00:00.000Z`),
		db
			.prepare(
				"INSERT INTO mutation_receipts (id, actor_user_id, effective_user_id, payload_hash, result, created_at) VALUES (?, 'local-seed', 'business-realtor', 'fictional-activity-v1', ?, ?)",
			)
			.bind(activityReceiptId, JSON.stringify({ today }), now),
	);
	await db.batch(statements);
}

export async function resetFictional(db: D1Database) {
	// A local reset must not silently delete user-created records or sever their links to a fixture.
	const protectedLinks = await db
		.prepare(`SELECT 1 AS found FROM opportunity_clients oc JOIN opportunities o ON o.id = oc.opportunity_id JOIN clients c ON c.id = oc.client_id WHERE o.fictional = 0 AND c.fictional = 1
		UNION ALL SELECT 1 FROM tasks t LEFT JOIN clients c ON c.id = t.client_id LEFT JOIN opportunities o ON o.id = t.opportunity_id WHERE t.fictional = 0 AND (c.fictional = 1 OR o.fictional = 1)
		UNION ALL SELECT 1 FROM record_references r JOIN opportunities owner ON owner.id = r.opportunity_id LEFT JOIN clients c ON c.id = r.target_client_id LEFT JOIN opportunities o ON o.id = r.target_opportunity_id WHERE owner.fictional = 0 AND (c.fictional = 1 OR o.fictional = 1)
		UNION ALL SELECT 1 FROM client_relationships r JOIN clients owner ON owner.id = r.client_id WHERE r.related_client_id IN (SELECT id FROM clients WHERE fictional = 1) AND owner.fictional = 0
		UNION ALL SELECT 1 FROM activity a WHERE a.fictional = 0 AND (
			a.client_id IN (SELECT id FROM clients WHERE fictional = 1)
			OR a.opportunity_id IN (SELECT id FROM opportunities WHERE fictional = 1)
			OR EXISTS (SELECT 1 FROM activity_opportunities links JOIN opportunities o ON o.id = links.opportunity_id WHERE links.activity_id = a.id AND o.fictional = 1)
		) LIMIT 1`)
		.first();
	if (protectedLinks)
		throw new Error(
			"Fictional reset refused: user-created records reference fixtures. Remove those links explicitly first.",
		);
	await db.batch([
		db.prepare("DELETE FROM activity WHERE fictional = 1"),
		db.prepare(
			"DELETE FROM client_key_dates WHERE client_id IN (SELECT id FROM clients WHERE fictional = 1)",
		),
		db.prepare(
			"DELETE FROM client_relationships WHERE client_id IN (SELECT id FROM clients WHERE fictional = 1) OR related_client_id IN (SELECT id FROM clients WHERE fictional = 1)",
		),
		db.prepare(
			"DELETE FROM client_addresses WHERE client_id IN (SELECT id FROM clients WHERE fictional = 1)",
		),
		db.prepare(
			"DELETE FROM person_phones WHERE person_id IN (SELECT id FROM client_people WHERE client_id IN (SELECT id FROM clients WHERE fictional = 1))",
		),
		db.prepare(
			"DELETE FROM person_emails WHERE person_id IN (SELECT id FROM client_people WHERE client_id IN (SELECT id FROM clients WHERE fictional = 1))",
		),
		db.prepare(
			"DELETE FROM client_people WHERE client_id IN (SELECT id FROM clients WHERE fictional = 1)",
		),
		db.prepare(
			"DELETE FROM history WHERE fictional = 1 OR (record_kind = 'client' AND record_id IN (SELECT id FROM clients WHERE fictional = 1)) OR (record_kind = 'opportunity' AND record_id IN (SELECT id FROM opportunities WHERE fictional = 1)) OR (record_kind = 'task' AND record_id IN (SELECT id FROM tasks WHERE fictional = 1))",
		),
		db.prepare(
			"DELETE FROM checklist_progress WHERE checklist_id IN (SELECT s.id FROM stage_checklists s JOIN opportunities o ON o.id = s.opportunity_id WHERE o.fictional = 1)",
		),
		db.prepare(
			"DELETE FROM checklist_items WHERE checklist_id IN (SELECT s.id FROM stage_checklists s JOIN opportunities o ON o.id = s.opportunity_id WHERE o.fictional = 1)",
		),
		db.prepare(
			"DELETE FROM stage_checklists WHERE opportunity_id IN (SELECT id FROM opportunities WHERE fictional = 1)",
		),
		db.prepare(
			"DELETE FROM record_references WHERE opportunity_id IN (SELECT id FROM opportunities WHERE fictional = 1)",
		),
		db.prepare("DELETE FROM tasks WHERE fictional = 1"),
		db.prepare(
			"DELETE FROM opportunity_clients WHERE opportunity_id IN (SELECT id FROM opportunities WHERE fictional = 1)",
		),
		db.prepare(
			"DELETE FROM client_tags WHERE client_id IN (SELECT id FROM clients WHERE fictional = 1)",
		),
		db.prepare("DELETE FROM opportunities WHERE fictional = 1"),
		db.prepare("DELETE FROM clients WHERE fictional = 1"),
		db.prepare("DELETE FROM mutation_receipts WHERE id IN (?, ?)").bind(receiptId, activityReceiptId),
	]);
}
