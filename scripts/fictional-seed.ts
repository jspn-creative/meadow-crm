import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";

const receiptId = "fictional-seed-v1";
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
	if (await db.prepare("SELECT id FROM mutation_receipts WHERE id = ?").bind(receiptId).first())
		return;
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
					"INSERT INTO clients (id, name, lead_source, notes, preferences, preferred_contact_method, referred_by_client_id, referred_by_name, archived_at, fictional, created_at, updated_at) VALUES (?, ?, 'Fictional referral', 'Fictional local scenario', ?, ?, ?, ?, ?, 1, ?, ?)",
				)
				.bind(
					`fictional-client-${client.id}`,
					client.name,
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
					"INSERT INTO opportunities (id, title, type, stage, timeline, budget_cents, notes, archived_at, fictional, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'Fictional local scenario', ?, 1, ?, ?)",
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

export async function resetFictional(db: D1Database) {
	// A local reset must not silently delete user-created records or sever their links to a fixture.
	const protectedLinks = await db
		.prepare(`SELECT 1 AS found FROM opportunity_clients oc JOIN opportunities o ON o.id = oc.opportunity_id JOIN clients c ON c.id = oc.client_id WHERE o.fictional = 0 AND c.fictional = 1
		UNION ALL SELECT 1 FROM tasks t LEFT JOIN clients c ON c.id = t.client_id LEFT JOIN opportunities o ON o.id = t.opportunity_id WHERE t.fictional = 0 AND (c.fictional = 1 OR o.fictional = 1)
		UNION ALL SELECT 1 FROM record_references r JOIN opportunities owner ON owner.id = r.opportunity_id LEFT JOIN clients c ON c.id = r.target_client_id LEFT JOIN opportunities o ON o.id = r.target_opportunity_id WHERE owner.fictional = 0 AND (c.fictional = 1 OR o.fictional = 1)
		UNION ALL SELECT 1 FROM client_relationships r JOIN clients owner ON owner.id = r.client_id WHERE r.related_client_id IN (SELECT id FROM clients WHERE fictional = 1) AND owner.fictional = 0 LIMIT 1`)
		.first();
	if (protectedLinks)
		throw new Error(
			"Fictional reset refused: user-created records reference fixtures. Remove those links explicitly first.",
		);
	await db.batch([
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
		db.prepare("DELETE FROM mutation_receipts WHERE id = ?").bind(receiptId),
	]);
}
