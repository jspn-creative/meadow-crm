import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { defaultChecklists, defaultItemId, templateId } from "./defaults.ts";
import {
	businessSettings,
	checklistItems,
	checklistTemplates,
	opportunityTypes,
	stages,
	tags,
} from "./schema.ts";

// Production-safe defaults only. Fictional records and local identities are deliberately not imported here.
export async function seedDefaults(db: D1Database, now = new Date().toISOString()) {
	const orm = drizzle(db);
	await orm.batch([
		orm
			.insert(businessSettings)
			.values({
				name: "Meadow Lane Realty & Development",
				timezone: "America/New_York",
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing(),
		...[
			{ id: "tag-sphere", name: "sphere", color: "#6b7c5e" },
			{ id: "tag-nurture", name: "nurture", color: "#b89b5e" },
			{ id: "tag-referral", name: "referral", color: "#6b8fa8" },
		].map((tag) =>
			orm
				.insert(tags)
				.values({ ...tag, createdAt: now, updatedAt: now })
				.onConflictDoNothing(),
		),
	]);
	for (const type of opportunityTypes) {
		for (const stage of stages) {
			const id = templateId(type, stage);
			// An existing template is already initialized, even if its editor intentionally removed every step.
			if (await db.prepare("SELECT id FROM checklist_templates WHERE id = ?").bind(id).first())
				continue;
			await orm.batch([
				orm
					.insert(checklistTemplates)
					.values({ id, type, stage, createdAt: now, updatedAt: now })
					.onConflictDoNothing(),
				...defaultChecklists[type][stage].map(([seedId, title], position) =>
					orm
						.insert(checklistItems)
						.values({
							id: defaultItemId(type, stage, seedId),
							templateId: id,
							title,
							position,
							createdAt: now,
							updatedAt: now,
						})
						.onConflictDoNothing(),
				),
			]);
		}
	}
}
