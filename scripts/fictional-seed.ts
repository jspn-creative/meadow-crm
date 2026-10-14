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
	const clients = [
		["ada", "Ada Maple", "sphere"],
		["eli", "Eli Maple", "referral"],
		["mira", "Mira Willow", "nurture"],
		["leo", "Leo Birch", "referral"],
		["inez", "Inez Cedar", "sphere"],
		["remy", "Remy Alder", "nurture"],
	];
	for (const [id, name, tag] of clients) {
		statements.push(
			db
				.prepare(
					"INSERT INTO clients (id, name, email, phone, address, lead_source, notes, archived_at, fictional, created_at, updated_at) VALUES (?, ?, ?, '202-555-0100', 'Example address, Example City', 'Fictional referral', 'Fictional local scenario', ?, 1, ?, ?)",
				)
				.bind(
					`fictional-client-${id}`,
					name,
					`${id}@example.invalid`,
					id === "remy" ? now : null,
					now,
					now,
				),
		);
		statements.push(
			db
				.prepare("INSERT INTO client_tags (client_id, tag_id) VALUES (?, ?)")
				.bind(`fictional-client-${id}`, `tag-${tag}`),
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
					"INSERT INTO tasks (id, title, assigned_user_id, opportunity_id, due_date, completed_at, fictional, created_at, updated_at) VALUES (?, ?, 'business-realtor', ?, ?, ?, 1, ?, ?)",
				)
				.bind(
					`fictional-task-${id}`,
					title,
					opportunityId,
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
		UNION ALL SELECT 1 FROM record_references r JOIN opportunities owner ON owner.id = r.opportunity_id LEFT JOIN clients c ON c.id = r.target_client_id LEFT JOIN opportunities o ON o.id = r.target_opportunity_id WHERE owner.fictional = 0 AND (c.fictional = 1 OR o.fictional = 1) LIMIT 1`)
		.first();
	if (protectedLinks)
		throw new Error(
			"Fictional reset refused: user-created records reference fixtures. Remove those links explicitly first.",
		);
	await db.batch([
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
