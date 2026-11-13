import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { eq, inArray, isNull, isNotNull } from "drizzle-orm";
import * as v from "valibot";
import type { BusinessIdentity } from "./identity.ts";
import { businessDate } from "../data/attention.ts";
import { leadSources, referralSource } from "../data/lead-sources.ts";
import {
	businessSettings,
	clients,
	clientAddresses,
	clientKeyDates,
	clientPeople,
	clientRelationships,
	clientTags,
	opportunities,
	opportunityClients,
	personEmails,
	personPhones,
	stageChecklists,
	checklistItems,
	checklistProgress,
	recordReferences,
	history,
	tags,
	tasks,
} from "./db/schema.ts";
import {
	addChecklistItemInput,
	archiveOpportunityInput,
	bulkArchiveInput,
	bulkUpdateClientsInput,
	clientsQueryInput,
	clientFiltersInput,
	createClientInput,
	createOpportunityInput,
	deleteOpportunityInput,
	pinOpportunityInput,
	removeChecklistItemInput,
	renameChecklistItemInput,
	reorderChecklistItemsInput,
	restoreOpportunityInput,
	saveChecklistStepInput,
	moveStageInput,
	saveClientInput,
	saveOpportunityInput,
	workspaceInput,
	createTaskInput,
	saveTaskInput,
	completeTaskInput,
	deleteTaskInput,
} from "./validation.ts";

export class DataConflict extends Error {
	constructor() {
		super(
			"This record changed or a linked record is unavailable. Refresh and reselect before saving.",
		);
	}
}

// The record cannot be saved as it was asked for, whatever the stored state is.
export class DataInvalid extends Error {
	constructor(message: string) {
		super(message);
	}
}

// Compares the linked-client count against an expected length. An empty id list can't be
// used in an IN clause, so with no ids the guard is a tautology: 0 linked clients matches
// an expectation of 0.
function clientCountGuard(ids: string[]): string {
	const placeholders = ids.map(() => "?").join(",");
	return placeholders
		? `(SELECT count(*) FROM clients WHERE id IN (${placeholders}) AND archived_at IS NULL) = ?`
		: "0 = 0";
}
function clientCountParams(ids: string[]): (string | number)[] {
	return ids.length ? [...ids, ids.length] : [];
}

// Start of the given calendar day (00:00 in the business time zone) as a UTC ISO instant. The offset is computed at that local midnight and the instant nudged until stable, so a DST jump at midnight lands sensibly instead of an hour off.
function zonedDayStartIso(date: string, timeZone: string): string {
	const [year, month, day] = date.split("-").map((part) => Number(part));
	const dayStart = Date.UTC(year, month - 1, day);
	let instant = dayStart;
	for (let i = 0; i < 4; i++) {
		const wall = zonedWallTime(instant, timeZone);
		const corrected = dayStart - (wall - instant);
		if (corrected === instant) break;
		instant = corrected;
	}
	return new Date(instant).toISOString();
}

// The local wall-clock instant corresponding to a UTC instant, expressed as a UTC timestamp so the difference is the zone offset.
function zonedWallTime(instant: number, timeZone: string): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hour12: false,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).formatToParts(new Date(instant));
	const get = (type: string) => Number(parts.find((part) => part.type === type)!.value);
	return Date.UTC(
		get("year"),
		get("month") - 1,
		get("day"),
		get("hour"),
		get("minute"),
		get("second"),
	);
}

// The ISO date of the calendar day after the given one.
function nextCalendarDay(date: string): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10);
}

interface Receipt {
	actor_user_id: string;
	effective_user_id: string;
	payload_hash: string;
	result: string;
}

interface ClientRow {
	id: string;
	name: string;
	leadSource: string | null;
	archivedAt: string | null;
	createdAt: string;
	opportunity_count: number;
	all_opportunity_count: number;
	consentCall: number;
	consentText: number;
	consentEmail: number;
	consentMail: number;
	referredByClientId: string | null;
	referredByName: string | null;
	referredByClientName: string | null;
	people_names_json: string | null;
	addresses_json: string | null;
	tag_names_json: string | null;
	phone: string | null;
	email: string | null;
}

// Each request owns its service and identity. There is no server-shared cache or mutable current-user singleton.
export function createDataService(db: D1Database, identity: BusinessIdentity) {
	const user = Object.freeze({ ...identity });
	const orm = drizzle(db);
	const stmt = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).bind(...args);
	const guardExists = "EXISTS (SELECT 1 FROM mutation_guards WHERE id = ?)";
	async function replayMutation(requestId: string, payload: unknown) {
		const saved = await stmt(
			"SELECT actor_user_id, effective_user_id, payload_hash, result FROM mutation_receipts WHERE id = ?",
			requestId,
		).first<Receipt>();
		if (!saved) return undefined;
		const hash = Array.from(
			new Uint8Array(
				await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload))),
			),
		)
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
		if (
			saved.actor_user_id !== user.actorUserId ||
			saved.effective_user_id !== user.effectiveUserId ||
			saved.payload_hash !== hash
		)
			throw new DataInvalid("This request ID is already used by a different operation or identity.");
		return JSON.parse(saved.result) as Record<string, unknown>;
	}

	async function mutation<T extends Record<string, unknown>>(
		requestId: string,
		payload: unknown,
		result: T | ((now: string) => T),
		statements: (guard: string, now: string) => D1PreparedStatement[],
	) {
		const hash = Array.from(
			new Uint8Array(
				await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload))),
			),
		)
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
		const receipt = () =>
			stmt(
				"SELECT actor_user_id, effective_user_id, payload_hash, result FROM mutation_receipts WHERE id = ?",
				requestId,
			).first<Receipt>();
		const replay = (saved: Receipt) => {
			if (
				saved.actor_user_id !== user.actorUserId ||
				saved.effective_user_id !== user.effectiveUserId ||
				saved.payload_hash !== hash
			)
				throw new DataInvalid("This request ID is already used by a different operation or identity.");
			return JSON.parse(saved.result) as T;
		};
		const existing = await receipt();
		if (existing) return replay(existing);
		const guard = crypto.randomUUID();
		const now = new Date().toISOString();
		const confirmed = typeof result === "function" ? result(now) : result;
		try {
			await db.batch([
				...statements(guard, now),
				stmt(
					"INSERT INTO mutation_receipts (id, actor_user_id, effective_user_id, payload_hash, result, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE " +
						guardExists,
					requestId,
					user.actorUserId,
					user.effectiveUserId,
					hash,
					JSON.stringify(confirmed),
					now,
					guard,
				),
				stmt("DELETE FROM mutation_guards WHERE id = ?", guard),
			]);
		} catch (error) {
			// Concurrent retries can race the first receipt read; only an identical committed operation can be replayed.
			const saved = await receipt();
			if (saved) return replay(saved);
			if (String(error).includes("mutation_guard_passed") || String(error).includes("FOREIGN KEY"))
				throw new DataConflict();
			throw error;
		}
		return confirmed;
	}

	const appendHistory = (
		guard: string,
		now: string,
		kind: string,
		id: string,
		action: string,
		data: unknown,
		historyId = crypto.randomUUID(),
	) =>
		stmt(
			"INSERT INTO history (id, record_kind, record_id, actor_user_id, effective_user_id, action, data, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE " +
				guardExists,
			historyId,
			kind,
			id,
			user.actorUserId,
			user.effectiveUserId,
			action,
			JSON.stringify(data),
			now,
			guard,
		);

	function writeReferences(
		guard: string,
		now: string,
		column: "opportunity_id" | "client_id",
		ownerId: string,
		references: v.InferOutput<typeof saveOpportunityInput>["references"],
	) {
		if (!references) return [];
		return [
			stmt(`DELETE FROM record_references WHERE ${column} = ? AND ` + guardExists, ownerId, guard),
			...references.map((reference) =>
				stmt(
					`INSERT INTO record_references (id, ${column}, label, kind, url, target_client_id, target_opportunity_id, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ` +
						guardExists,
					crypto.randomUUID(),
					ownerId,
					reference.label,
					reference.kind,
					reference.kind === "url" ? reference.url : null,
					reference.kind === "client" ? reference.targetId : null,
					reference.kind === "opportunity" ? reference.targetId : null,
					now,
					now,
					guard,
				),
			),
		];
	}

	// WHERE clause on alias `c` for the Registry client filters. Arrays bind as one JSON parameter read through json_each, so a statement never binds one parameter per array element. `omit` skips one filter so facet counts can ignore the dimension being faceted.
	async function clientWhere(
		filters: v.InferOutput<typeof clientFiltersInput>,
		omit?: "tags" | "leadSources",
	): Promise<{ sql: string; args: (string | number)[] }> {
		const conditions: string[] = [];
		const args: (string | number)[] = [];

		conditions.push(filters.archived ? "c.archived_at IS NOT NULL" : "c.archived_at IS NULL");

		if (filters.q) {
			const like = `%${filters.q.trim()}%`;
			conditions.push(`(
				c.name LIKE ? OR c.notes LIKE ?
				OR EXISTS (SELECT 1 FROM client_people p WHERE p.client_id = c.id AND p.name LIKE ?)
				OR EXISTS (SELECT 1 FROM client_people p JOIN person_phones ph ON ph.person_id = p.id WHERE p.client_id = c.id AND ph.value LIKE ?)
				OR EXISTS (SELECT 1 FROM client_people p JOIN person_emails pe ON pe.person_id = p.id WHERE p.client_id = c.id AND pe.value LIKE ?)
				OR EXISTS (SELECT 1 FROM client_addresses a WHERE a.client_id = c.id AND a.address LIKE ?)
				OR EXISTS (SELECT 1 FROM client_tags ct JOIN tags tg ON tg.id = ct.tag_id WHERE ct.client_id = c.id AND tg.name LIKE ?)
			)`);
			args.push(like, like, like, like, like, like, like);
		}

		if (omit !== "tags" && filters.tags.length) {
			const tagJson = JSON.stringify(filters.tags);
			if (filters.tagMode === "any") {
				conditions.push(
					`EXISTS (SELECT 1 FROM client_tags ct WHERE ct.client_id = c.id AND ct.tag_id IN (SELECT value FROM json_each(?)))`,
				);
				args.push(tagJson);
			} else if (filters.tagMode === "all") {
				conditions.push(
					`(SELECT count(DISTINCT ct.tag_id) FROM client_tags ct WHERE ct.client_id = c.id AND ct.tag_id IN (SELECT value FROM json_each(?))) = ?`,
				);
				args.push(tagJson, new Set(filters.tags).size);
			} else {
				conditions.push(
					`NOT EXISTS (SELECT 1 FROM client_tags ct WHERE ct.client_id = c.id AND ct.tag_id IN (SELECT value FROM json_each(?)))`,
				);
				args.push(tagJson);
			}
		}

		if (omit !== "leadSources" && filters.leadSources.length) {
			const hasNone = filters.leadSources.includes("");
			const sources = filters.leadSources.filter((source) => source !== "");
			const sourceJson = JSON.stringify(sources);
			const inList = `c.lead_source IN (SELECT value FROM json_each(?))`;
			if (filters.leadSourceMode === "is") {
				if (hasNone) {
					conditions.push(
						sources.length
							? `c.lead_source IS NULL OR c.lead_source = '' OR ${inList}`
							: `c.lead_source IS NULL OR c.lead_source = ''`,
					);
				} else {
					conditions.push(inList);
				}
				if (sources.length) args.push(sourceJson);
			} else if (hasNone) {
				conditions.push(
					sources.length
						? `c.lead_source IS NOT NULL AND c.lead_source <> '' AND c.lead_source NOT IN (SELECT value FROM json_each(?))`
						: `c.lead_source IS NOT NULL AND c.lead_source <> ''`,
				);
				if (sources.length) args.push(sourceJson);
			} else {
				conditions.push(
					`c.lead_source IS NULL OR c.lead_source = '' OR c.lead_source NOT IN (SELECT value FROM json_each(?))`,
				);
				args.push(sourceJson);
			}
		}

		const allOpportunityCount = `(SELECT count(*) FROM opportunity_clients oc JOIN opportunities o ON o.id = oc.opportunity_id WHERE oc.client_id = c.id)`;
		const currentOpportunityCount = `(SELECT count(*) FROM opportunity_clients oc JOIN opportunities o ON o.id = oc.opportunity_id WHERE oc.client_id = c.id AND o.archived_at IS NULL)`;
		type CountFilter =
			| { op: "eq" | "gte" | "lte"; value: number }
			| { op: "between"; min: number; max: number };
		const applyCountFilter = (subquery: string, filter: CountFilter | undefined): void => {
			if (!filter) return;
			if (filter.op === "between") {
				conditions.push(`${subquery} >= ? AND ${subquery} <= ?`);
				args.push(filter.min, filter.max);
			} else {
				const op = filter.op === "eq" ? "=" : filter.op === "gte" ? ">=" : "<=";
				conditions.push(`${subquery} ${op} ?`);
				args.push(filter.value);
			}
		};
		applyCountFilter(currentOpportunityCount, filters.opportunities);
		applyCountFilter(allOpportunityCount, filters.allOpportunities);

		if (filters.consent) {
			const consentColumns: Record<string, string> = {
				call: "consent_call",
				text: "consent_text",
				email: "consent_email",
				mail: "consent_mail",
			};
			const want = filters.consent.op === "allows" ? 1 : 0;
			conditions.push(
				`(${filters.consent.channels.map((channel) => `c.${consentColumns[channel]} = ${want}`).join(" AND ")})`,
			);
		}

		if (filters.referredBy) {
			if (filters.referredBy.op === "set") {
				conditions.push(`(c.referred_by_client_id IS NOT NULL OR c.referred_by_name <> '')`);
			} else if (filters.referredBy.op === "empty") {
				conditions.push(
					`(c.referred_by_client_id IS NULL AND (c.referred_by_name IS NULL OR c.referred_by_name = ''))`,
				);
			} else if (filters.referredBy.op === "contains") {
				const like = `%${filters.referredBy.text}%`;
				conditions.push(
					`(EXISTS (SELECT 1 FROM clients r WHERE r.id = c.referred_by_client_id AND r.name LIKE ?) OR c.referred_by_name LIKE ?)`,
				);
				args.push(like, like);
			}
		}

		if (filters.created) {
			const settings = await orm.select().from(businessSettings).where(eq(businessSettings.id, 1));
			const timeZone = settings[0]?.timezone ?? "America/Los_Angeles";
			const range = filters.created;
			if (range.op === "onOrAfter") {
				conditions.push(`c.created_at >= ?`);
				args.push(zonedDayStartIso(range.date, timeZone));
			} else if (range.op === "onOrBefore") {
				conditions.push(`c.created_at < ?`);
				args.push(zonedDayStartIso(nextCalendarDay(range.date), timeZone));
			} else if (range.op === "between") {
				const start = range.from <= range.to ? range.from : range.to;
				const end = range.from <= range.to ? range.to : range.from;
				conditions.push(`c.created_at >= ? AND c.created_at < ?`);
				args.push(zonedDayStartIso(start, timeZone), zonedDayStartIso(nextCalendarDay(end), timeZone));
			}
		}

		// Each condition is parenthesized so an OR inside one cannot leak into its neighbours.
		return { sql: `WHERE ${conditions.map((condition) => `(${condition})`).join(" AND ")}`, args };
	}

	return {
		identity: user,
		async recentActivity() {
			const [result, settings] = await Promise.all([
				stmt(`SELECT h.id, h.record_kind AS recordKind, COALESCE(NULLIF(h.record_id, ''), sc.opportunity_id) AS recordId, h.action, h.data, h.created_at AS createdAt, h.actor_user_id AS actorUserId, h.effective_user_id AS effectiveUserId, COALESCE(c.name, o.title, t.title) AS title, COALESCE(c.archived_at, o.archived_at) AS archivedAt
					FROM history h
					LEFT JOIN stage_checklists sc ON h.record_kind = 'opportunity' AND h.record_id = '' AND sc.id = json_extract(h.data, '$.checklistId')
					LEFT JOIN clients c ON h.record_kind = 'client' AND c.id = h.record_id
					LEFT JOIN opportunities o ON h.record_kind = 'opportunity' AND o.id = COALESCE(NULLIF(h.record_id, ''), sc.opportunity_id)
					LEFT JOIN tasks t ON h.record_kind = 'task' AND t.id = h.record_id
					WHERE c.id IS NOT NULL OR o.id IS NOT NULL OR t.id IS NOT NULL
					ORDER BY h.created_at DESC, h.id DESC LIMIT 20`).all<{
					id: string;
					recordKind: "client" | "opportunity" | "task";
					recordId: string;
					action: string;
					data: string;
					createdAt: string;
					actorUserId: string;
					effectiveUserId: string;
					title: string;
					archivedAt: string | null;
				}>(),
				orm.select().from(businessSettings).where(eq(businessSettings.id, 1)),
			]);
			return {
				changes: result.results.map((row) => ({
					...row,
					data: JSON.parse(row.data) as Record<string, unknown>,
				})),
				timezone: settings[0]?.timezone ?? "America/Los_Angeles",
			};
		},
		// Server-side Registry list: filter, search, sort, count, and paginate clients in SQL so the table loads one page of the 800+ clients at a time. Returns the page plus the total count.
		async clients(input: unknown) {
			const value = v.parse(clientsQueryInput, input);
			const where = await clientWhere(value);
			const sortDir = value.sortDir === "desc" ? "DESC" : "ASC";
			const page = Math.max(1, Math.min(value.page, 10000));
			const pageSize = Math.max(1, Math.min(value.pageSize, 100));
			const offset = (page - 1) * pageSize;

			const currentCount = `(SELECT count(*) FROM opportunity_clients oc JOIN opportunities o ON o.id = oc.opportunity_id WHERE oc.client_id = c.id AND o.archived_at IS NULL)`;
			const allCount = `(SELECT count(*) FROM opportunity_clients oc JOIN opportunities o ON o.id = oc.opportunity_id WHERE oc.client_id = c.id)`;
			const referredName = `COALESCE((SELECT r.name FROM clients r WHERE r.id = c.referred_by_client_id), c.referred_by_name)`;

			let orderBy: string;
			switch (value.sort) {
				case "name":
					orderBy = `c.name COLLATE NOCASE ${sortDir}`;
					break;
				case "address":
					orderBy = `(SELECT a.address FROM client_addresses a WHERE a.client_id = c.id AND a.address IS NOT NULL AND a.address <> '' ORDER BY a.address LIMIT 1) COLLATE NOCASE ${sortDir}`;
					break;
				case "leadSource":
					orderBy = `c.lead_source COLLATE NOCASE ${sortDir}`;
					break;
				case "tags":
					orderBy = `(SELECT tg.name FROM client_tags ct JOIN tags tg ON tg.id = ct.tag_id WHERE ct.client_id = c.id AND tg.name IS NOT NULL AND tg.name <> '' ORDER BY tg.name LIMIT 1) COLLATE NOCASE ${sortDir}`;
					break;
				case "opportunities":
					orderBy = `${currentCount} ${sortDir}`;
					break;
				case "referredBy":
					orderBy = `(CASE WHEN c.referred_by_client_id IS NULL AND (c.referred_by_name IS NULL OR c.referred_by_name = '') THEN 1 ELSE 0 END) ${sortDir}, ${referredName} COLLATE NOCASE ${sortDir}`;
					break;
				default:
					orderBy = `c.created_at ${sortDir}`;
					break;
			}
			orderBy += `, c.name COLLATE NOCASE ASC, c.id ASC`;

			const [pageResult, countResult] = await Promise.all([
				stmt(
					`SELECT c.id, c.name, c.lead_source AS leadSource, c.archived_at AS archivedAt, c.created_at AS createdAt,
					${currentCount} AS opportunity_count,
					${allCount} AS all_opportunity_count,
					c.consent_call AS consentCall, c.consent_text AS consentText, c.consent_email AS consentEmail, c.consent_mail AS consentMail,
					c.referred_by_client_id AS referredByClientId, c.referred_by_name AS referredByName,
					(SELECT r.name FROM clients r WHERE r.id = c.referred_by_client_id) AS referredByClientName,
					(SELECT json_group_array(name) FROM (SELECT DISTINCT p.name FROM client_people p WHERE p.client_id = c.id AND p.name IS NOT NULL AND p.name <> '' ORDER BY p.name)) AS people_names_json,
					(SELECT json_group_array(address) FROM (SELECT DISTINCT a.address FROM client_addresses a WHERE a.client_id = c.id AND a.address IS NOT NULL AND a.address <> '' ORDER BY a.address)) AS addresses_json,
					(SELECT json_group_array(name) FROM (SELECT DISTINCT tg.name FROM client_tags ct JOIN tags tg ON tg.id = ct.tag_id WHERE ct.client_id = c.id AND tg.name IS NOT NULL AND tg.name <> '' ORDER BY tg.name)) AS tag_names_json,
					(SELECT ph.value FROM client_people p JOIN person_phones ph ON ph.person_id = p.id WHERE p.client_id = c.id AND ph.value <> '' ORDER BY p.position, ph.position LIMIT 1) AS phone,
					(SELECT pe.value FROM client_people p JOIN person_emails pe ON pe.person_id = p.id WHERE p.client_id = c.id AND pe.value <> '' ORDER BY p.position, pe.position LIMIT 1) AS email
					FROM clients c ${where.sql}
					ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
					...where.args,
					pageSize,
					offset,
				).all<ClientRow>(),
				stmt(
					`SELECT count(*) AS total FROM (SELECT c.id FROM clients c ${where.sql})`,
					...where.args,
				).first<{ total: number }>(),
			]);

			const list = (json: string | null): string[] => {
				try {
					const parsed: unknown = JSON.parse(json ?? "[]");
					return Array.isArray(parsed)
						? parsed.filter((item): item is string => typeof item === "string")
						: [];
				} catch {
					return [];
				}
			};
			const clients = pageResult.results.map((row) => ({
				id: row.id,
				name: row.name,
				archivedAt: row.archivedAt,
				leadSource: row.leadSource,
				peopleNames: list(row.people_names_json),
				addresses: list(row.addresses_json),
				tagNames: list(row.tag_names_json),
				phone: row.phone,
				email: row.email,
				opportunityCount: row.opportunity_count,
				allOpportunityCount: row.all_opportunity_count,
				consent: {
					call: row.consentCall === 1,
					text: row.consentText === 1,
					email: row.consentEmail === 1,
					mail: row.consentMail === 1,
				},
				referredBy: row.referredByClientId
					? {
							name: row.referredByClientName ?? row.referredByName ?? "",
							clientId: row.referredByClientId,
						}
					: row.referredByName
						? { name: row.referredByName, clientId: null }
						: null,
				createdAt: row.createdAt,
			}));

			return { clients, total: countResult?.total ?? 0 };
		},

		async clientFacets(input: unknown) {
			const value = v.parse(clientFiltersInput, input);
			const tagsWhere = await clientWhere(value, "tags");
			const sourcesWhere = await clientWhere(value, "leadSources");
			const [tagRows, sourceRows] = await Promise.all([
				stmt(
					`SELECT tg.id AS tagId, count(*) AS count FROM tags tg JOIN client_tags ct ON ct.tag_id = tg.id JOIN clients c ON c.id = ct.client_id ${tagsWhere.sql} GROUP BY tg.id`,
					...tagsWhere.args,
				).all<{ tagId: string; count: number }>(),
				stmt(
					`SELECT COALESCE(NULLIF(c.lead_source, ''), '') AS leadSource, count(*) AS count FROM clients c ${sourcesWhere.sql} GROUP BY COALESCE(NULLIF(c.lead_source, ''), '')`,
					...sourcesWhere.args,
				).all<{ leadSource: string; count: number }>(),
			]);
			const tags: Record<string, number> = {};
			for (const row of tagRows.results) tags[row.tagId] = row.count;
			const leadSources: Record<string, number> = {};
			for (const row of sourceRows.results) leadSources[row.leadSource] = row.count;
			return { tags, leadSources };
		},

		async clientIds(input: unknown) {
			const value = v.parse(clientFiltersInput, input);
			const where = await clientWhere(value);
			const result = await stmt(
				`SELECT c.id FROM clients c ${where.sql} ORDER BY c.name COLLATE NOCASE, c.id LIMIT 2000`,
				...where.args,
			).all<{ id: string }>();
			return { ids: result.results.map((row) => row.id) };
		},
		async workspace(input: unknown) {
			const { archived } = v.parse(workspaceInput, input);
			const [
				clientRows,
				opportunityRows,
				settings,
				links,
				checklists,
				items,
				progress,
				references,
				changes,
				referenceClientRows,
				referenceOpportunities,
				clientTagRows,
				clientPeopleRows,
				personPhoneRows,
				personEmailRows,
				clientAddressRows,
				clientRelationshipRows,
				clientKeyDateRows,
				tagRows,
				clientTagAllRows,
				taskRows,
			] = await Promise.all([
				orm
					.select()
					.from(clients)
					.where(archived ? isNotNull(clients.archivedAt) : isNull(clients.archivedAt)),
				orm
					.select()
					.from(opportunities)
					.where(archived ? isNotNull(opportunities.archivedAt) : isNull(opportunities.archivedAt)),
				orm.select().from(businessSettings).where(eq(businessSettings.id, 1)),
				orm.select().from(opportunityClients),
				orm.select().from(stageChecklists),
				orm.select().from(checklistItems),
				orm.select().from(checklistProgress),
				orm.select().from(recordReferences),
				orm
					.select()
					.from(history)
					.where(inArray(history.recordKind, ["opportunity", "client", "task"])),
				orm
					.select({ id: clients.id, name: clients.name, archivedAt: clients.archivedAt })
					.from(clients),
				orm
					.select({
						id: opportunities.id,
						title: opportunities.title,
						archivedAt: opportunities.archivedAt,
					})
					.from(opportunities),
				orm
					.select({
						clientId: clientTags.clientId,
						id: tags.id,
						name: tags.name,
						color: tags.color,
					})
					.from(clientTags)
					.innerJoin(tags, eq(tags.id, clientTags.tagId))
					.where(isNull(tags.retiredAt)),
				orm.select().from(clientPeople),
				orm.select().from(personPhones),
				orm.select().from(personEmails),
				orm.select().from(clientAddresses),
				orm.select().from(clientRelationships),
				orm.select().from(clientKeyDates),
				orm.select().from(tags),
				orm.select().from(clientTags),
				orm.select().from(tasks),
			]);
			const tagsByClient = new Map<string, { id: string; name: string; color: string }[]>();
			for (const row of clientTagRows) {
				const list = tagsByClient.get(row.clientId) ?? [];
				list.push({ id: row.id, name: row.name, color: row.color });
				tagsByClient.set(row.clientId, list);
			}
			// A client's people, addresses, relationships, key dates and tags hang off that client, so one record can never show another's rows.
			const tagById = new Map(tagRows.map((tag) => [tag.id, tag]));
			const clientRecords = clientRows.map((row) => ({
				...row,
				people: clientPeopleRows
					.filter((person) => person.clientId === row.id)
					.sort((a, b) => a.position - b.position)
					.map((person) => ({
						...person,
						phones: personPhoneRows
							.filter((phone) => phone.personId === person.id)
							.sort((a, b) => a.position - b.position),
						emails: personEmailRows
							.filter((email) => email.personId === person.id)
							.sort((a, b) => a.position - b.position),
					})),
				addresses: clientAddressRows
					.filter((address) => address.clientId === row.id)
					.sort((a, b) => a.position - b.position),
				relationships: clientRelationshipRows.filter(
					(relationship) => relationship.clientId === row.id,
				),
				keyDates: clientKeyDateRows.filter((keyDate) => keyDate.clientId === row.id),
				tags: clientTagAllRows
					.filter((link) => link.clientId === row.id)
					.map((link) => tagById.get(link.tagId))
					.filter((tag): tag is (typeof tagRows)[number] => tag !== undefined),
			}));
			return {
				identity: user,
				businessToday: businessDate(settings[0]?.timezone ?? "America/Los_Angeles"),
				clients: clientRecords,
				tasks: taskRows,
				opportunities: opportunityRows,
				links: links.filter((link) => opportunityRows.some((row) => row.id === link.opportunityId)),
				references: references.filter(
					(reference) =>
						(reference.opportunityId !== null &&
							opportunityRows.some((row) => row.id === reference.opportunityId)) ||
						(reference.clientId !== null && clientRows.some((row) => row.id === reference.clientId)),
				),
				history: changes
					.filter(
						(change) =>
							(change.recordKind === "opportunity" &&
								opportunityRows.some((row) => row.id === change.recordId)) ||
							(change.recordKind === "client" && clientRows.some((row) => row.id === change.recordId)) ||
							change.recordKind === "task",
					)
					.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
				referenceClients: referenceClientRows.map((client) => ({
					id: client.id,
					name: client.name,
					archivedAt: client.archivedAt,
					tags: tagsByClient.get(client.id) ?? [],
				})),
				referenceOpportunities,
				tags: tagRows,
				checklists: checklists
					.filter((list) => opportunityRows.some((row) => row.id === list.opportunityId))
					.map((list) => {
						const removed = new Set(JSON.parse(list.removedTemplateItems || "[]") as string[]);
						return {
							...list,
							items: items
								.filter((item) => {
									if (item.checklistId === list.id) return true;
									if (item.templateId === list.templateId && !removed.has(item.id)) return true;
									return false;
								})
								.sort((a, b) => a.position - b.position)
								.map((item) => {
									const saved = progress.find(
										(row) => row.checklistId === list.id && row.itemId === item.id,
									);
									return {
										...item,
										completedAt: saved?.completedAt ?? null,
										dueDate: saved?.dueDate ?? null,
									};
								}),
						};
					}),
				settings: settings[0] ?? null,
			};
		},
		async createTask(input: unknown) {
			const value = v.parse(createTaskInput, input);
			return mutation(
				value.requestId,
				{ operation: "create-task", ...value },
				{ id: value.id, revision: 1 },
				(guard, now) => [
					stmt(
						"INSERT INTO mutation_guards VALUES (?, CASE WHEN NOT EXISTS (SELECT 1 FROM tasks WHERE id = ?) AND (? IS NULL OR EXISTS (SELECT 1 FROM clients WHERE id = ? AND archived_at IS NULL)) AND (? IS NULL OR EXISTS (SELECT 1 FROM opportunities WHERE id = ? AND archived_at IS NULL)) THEN 1 ELSE 0 END)",
						guard,
						value.id,
						value.clientId,
						value.clientId,
						value.opportunityId,
						value.opportunityId,
					),
					stmt(
						"INSERT INTO tasks (id, title, date, due_date, client_id, opportunity_id, assigned_user_id, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, 'business-realtor', ?, ? WHERE " +
							guardExists,
						value.id,
						value.title,
						value.date,
						value.dueDate,
						value.clientId,
						value.opportunityId,
						now,
						now,
						guard,
					),
					appendHistory(guard, now, "task", value.id, "create", { after: value }),
				],
			);
		},
		async saveTask(input: unknown) {
			const value = v.parse(saveTaskInput, input);
			return mutation(
				value.requestId,
				{ operation: "save-task", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						"INSERT INTO mutation_guards VALUES (?, CASE WHEN EXISTS (SELECT 1 FROM tasks WHERE id = ? AND revision = ? AND source_stage IS NULL AND (? IS NULL OR EXISTS (SELECT 1 FROM clients WHERE id = ? AND (archived_at IS NULL OR id = tasks.client_id))) AND (? IS NULL OR EXISTS (SELECT 1 FROM opportunities WHERE id = ? AND (archived_at IS NULL OR id = tasks.opportunity_id)))) THEN 1 ELSE 0 END)",
						guard,
						value.id,
						value.revision,
						value.clientId,
						value.clientId,
						value.opportunityId,
						value.opportunityId,
					),
					stmt(
						"INSERT INTO history (id, record_kind, record_id, actor_user_id, effective_user_id, action, data, created_at) SELECT ?, 'task', id, ?, ?, 'edit', json_object('before', json_object('title', title, 'date', date, 'dueDate', due_date, 'clientId', client_id, 'opportunityId', opportunity_id), 'after', json(?)), ? FROM tasks WHERE id = ? AND " +
							guardExists,
						crypto.randomUUID(),
						user.actorUserId,
						user.effectiveUserId,
						JSON.stringify(value),
						now,
						value.id,
						guard,
					),
					stmt(
						"UPDATE tasks SET title = ?, date = ?, due_date = ?, client_id = ?, opportunity_id = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND " +
							guardExists,
						value.title,
						value.date,
						value.dueDate,
						value.clientId,
						value.opportunityId,
						now,
						value.id,
						guard,
					),
				],
			);
		},
		async completeTask(input: unknown) {
			const value = v.parse(completeTaskInput, input);
			return mutation(
				value.requestId,
				{ operation: "complete-task", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						`UPDATE tasks SET completed_at = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND source_stage IS NULL AND completed_at IS ${value.completed ? "NULL" : "NOT NULL"}`,
						value.completed ? now : null,
						now,
						value.id,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					appendHistory(guard, now, "task", value.id, value.completed ? "complete" : "reopen", {
						revision: value.revision,
						completedAt: value.completed ? now : null,
					}),
				],
			);
		},
		async deleteTask(input: unknown) {
			const value = v.parse(deleteTaskInput, input);
			return mutation(
				value.requestId,
				{ operation: "delete-task", ...value },
				{ id: value.id },
				(guard, now) => [
					stmt(
						"INSERT INTO mutation_guards VALUES (?, CASE WHEN EXISTS (SELECT 1 FROM tasks WHERE id = ? AND revision = ? AND source_stage IS NULL) THEN 1 ELSE 0 END)",
						guard,
						value.id,
						value.revision,
					),
					appendHistory(guard, now, "task", value.id, "delete", { revision: value.revision }),
					stmt("DELETE FROM tasks WHERE id = ? AND " + guardExists, value.id, guard),
				],
			);
		},
		async createClient(input: unknown) {
			const value = v.parse(createClientInput, input);
			return mutation(
				value.requestId,
				{ operation: "create-client", ...value },
				{ id: value.id, revision: 1 },
				(guard, now) => [
					stmt(
						"INSERT INTO mutation_guards VALUES (?, CASE WHEN NOT EXISTS (SELECT 1 FROM clients WHERE id = ?) THEN 1 ELSE 0 END)",
						guard,
						value.id,
					),
					stmt(
						"INSERT INTO clients (id, name, consent_call, consent_text, consent_email, consent_mail, created_at, updated_at) SELECT ?, ?, 1, 1, 1, 1, ?, ? WHERE " +
							guardExists,
						value.id,
						value.name,
						now,
						now,
						guard,
					),
					...writeReferences(
						guard,
						now,
						"client_id",
						value.id,
						value.references as v.InferOutput<typeof saveOpportunityInput>["references"],
					),
					appendHistory(guard, now, "client", value.id, "create", { after: { name: value.name } }),
				],
			);
		},
		async createOpportunity(input: unknown) {
			const value = v.parse(createOpportunityInput, input);
			if (value.clientId && value.clientIds) throw new Error("Choose one client-link input.");
			const linkedIds = value.clientIds ?? (value.clientId ? [value.clientId] : []);
			return mutation(
				value.requestId,
				{ operation: "create-opportunity", ...value },
				{ id: value.id, revision: 1 },
				(guard, now) => [
					stmt(
						`INSERT INTO mutation_guards VALUES (?, CASE WHEN NOT EXISTS (SELECT 1 FROM opportunities WHERE id = ?) AND ${clientCountGuard(linkedIds)} AND EXISTS (SELECT 1 FROM checklist_templates WHERE type = ? AND stage = ?) THEN 1 ELSE 0 END)`,
						guard,
						value.id,
						...clientCountParams(linkedIds),
						value.type,
						value.stage,
					),
					stmt(
						"INSERT INTO opportunities (id, title, type, stage, timeline, address, budget_cents, notes, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE " +
							guardExists,
						value.id,
						value.title,
						value.type,
						value.stage,
						value.timeline ?? null,
						value.address || null,
						value.budgetCents ?? null,
						value.notes ?? "",
						now,
						now,
						guard,
					),
					...linkedIds.map((clientId) =>
						stmt(
							"INSERT INTO opportunity_clients (opportunity_id, client_id) SELECT ?, ? WHERE " +
								guardExists,
							value.id,
							clientId,
							guard,
						),
					),
					stmt(
						"INSERT INTO stage_checklists (id, opportunity_id, stage, template_id, created_at, updated_at) SELECT ?, ?, stage, id, ?, ? FROM checklist_templates WHERE type = ? AND stage = ? AND " +
							guardExists,
						crypto.randomUUID(),
						value.id,
						now,
						now,
						value.type,
						value.stage,
						guard,
					),
					...writeReferences(guard, now, "opportunity_id", value.id, value.references),
					appendHistory(guard, now, "opportunity", value.id, "create", { after: value }),
				],
			);
		},
		async saveChecklistStep(input: unknown) {
			const value = v.parse(saveChecklistStepInput, input);
			return mutation(
				value.requestId,
				{ operation: "save-checklist-step", ...value },
				{ id: value.checklistId, revision: value.revision + 1 },
				(guard, now) => [
					// Guard the list revision and item source together so a stale save cannot write to another opportunity's checklist.
					stmt(
						"UPDATE stage_checklists SET revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.archived_at IS NULL) AND EXISTS (SELECT 1 FROM checklist_items i WHERE i.id = ? AND i.revision = ? AND (i.checklist_id = stage_checklists.id OR (i.template_id = stage_checklists.template_id AND i.template_id IS NOT NULL)))",
						now,
						value.checklistId,
						value.revision,
						value.itemId,
						value.itemRevision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					stmt(
						"INSERT INTO checklist_progress (checklist_id, item_id, completed_at, due_date, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ? WHERE " +
							guardExists +
							" ON CONFLICT(checklist_id, item_id) DO UPDATE SET completed_at = excluded.completed_at, due_date = excluded.due_date, revision = checklist_progress.revision + 1, updated_at = excluded.updated_at",
						value.checklistId,
						value.itemId,
						value.completed ? now : null,
						value.dueDate,
						now,
						now,
						guard,
					),
					stmt(
						"INSERT INTO history (id, record_kind, record_id, actor_user_id, effective_user_id, action, data, created_at) SELECT ?, 'opportunity', opportunity_id, ?, ?, 'save-checklist-step', ?, ? FROM stage_checklists WHERE id = ? AND " +
							guardExists,
						crypto.randomUUID(),
						user.actorUserId,
						user.effectiveUserId,
						JSON.stringify({
							checklistId: value.checklistId,
							revision: value.revision,
							itemId: value.itemId,
							completed: value.completed,
							dueDate: value.dueDate,
						}),
						now,
						value.checklistId,
						guard,
					),
				],
			);
		},
		async addChecklistItem(input: unknown) {
			const value = v.parse(addChecklistItemInput, input);
			return mutation(
				value.requestId,
				{ operation: "add-checklist-item", ...value },
				{ checklistId: value.checklistId, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						"UPDATE stage_checklists SET revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.archived_at IS NULL)",
						now,
						value.checklistId,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					stmt(
						// The checklist shows template and local items together, so a new item goes after both.
						"INSERT INTO checklist_items (id, checklist_id, title, position, created_at, updated_at) SELECT ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM checklist_items WHERE checklist_id = ? OR template_id = (SELECT template_id FROM stage_checklists WHERE id = ?)), ?, ? WHERE " +
							guardExists,
						crypto.randomUUID(),
						value.checklistId,
						value.title,
						value.checklistId,
						value.checklistId,
						now,
						now,
						guard,
					),
					appendHistory(guard, now, "opportunity", "", "add-checklist-item", {
						checklistId: value.checklistId,
						revision: value.revision,
						title: value.title,
					}),
				],
			);
		},

		async removeChecklistItem(input: unknown) {
			const value = v.parse(removeChecklistItemInput, input);
			const list = await orm
				.select()
				.from(stageChecklists)
				.where(eq(stageChecklists.id, value.checklistId))
				.then((rows) => rows[0]);
			if (!list) throw new DataConflict();
			const item = await orm
				.select()
				.from(checklistItems)
				.where(eq(checklistItems.id, value.itemId))
				.then((rows) => rows[0]);
			if (!item) throw new DataConflict();
			const removed = JSON.parse(list.removedTemplateItems || "[]") as string[];
			const isLocal = item.checklistId === value.checklistId;
			const newRemoved = isLocal ? removed : [...new Set([...removed, value.itemId])];
			return mutation(
				value.requestId,
				{ operation: "remove-checklist-item", ...value },
				{ checklistId: value.checklistId, revision: value.revision + 1 },
				(guard, now) => {
					const stmts: D1PreparedStatement[] = [
						stmt(
							"UPDATE stage_checklists SET removed_template_items = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.archived_at IS NULL)",
							JSON.stringify(newRemoved),
							now,
							value.checklistId,
							value.revision,
						),
						stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					];
					if (isLocal) {
						stmts.push(
							stmt(
								"DELETE FROM checklist_items WHERE id = ? AND checklist_id = ? AND " + guardExists,
								value.itemId,
								value.checklistId,
								guard,
							),
							stmt(
								"DELETE FROM checklist_progress WHERE checklist_id = ? AND item_id = ? AND " + guardExists,
								value.checklistId,
								value.itemId,
								guard,
							),
						);
					}
					return stmts;
				},
			);
		},

		async renameChecklistItem(input: unknown) {
			const value = v.parse(renameChecklistItemInput, input);
			const list = await orm
				.select()
				.from(stageChecklists)
				.where(eq(stageChecklists.id, value.checklistId))
				.then((rows) => rows[0]);
			if (!list) throw new DataConflict();
			const item = await orm
				.select()
				.from(checklistItems)
				.where(eq(checklistItems.id, value.itemId))
				.then((rows) => rows[0]);
			if (!item) throw new DataConflict();
			const isLocal = item.checklistId === value.checklistId;
			const removed = JSON.parse(list.removedTemplateItems || "[]") as string[];
			const newRemoved = isLocal ? removed : [...new Set([...removed, value.itemId])];
			return mutation(
				value.requestId,
				{ operation: "rename-checklist-item", ...value },
				{ checklistId: value.checklistId, revision: value.revision + 1 },
				(guard, now) => {
					const stmts: D1PreparedStatement[] = [
						stmt(
							"UPDATE stage_checklists SET removed_template_items = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.archived_at IS NULL)",
							JSON.stringify(newRemoved),
							now,
							value.checklistId,
							value.revision,
						),
						stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					];
					if (isLocal) {
						stmts.push(
							stmt(
								"UPDATE checklist_items SET title = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND checklist_id = ? AND revision = ? AND " +
									guardExists,
								value.title,
								now,
								value.itemId,
								value.checklistId,
								value.itemRevision,
								guard,
							),
						);
					} else {
						// Create a local copy with the new title in the same place, carrying over its checked-off state and due date.
						const copyId = crypto.randomUUID();
						stmts.push(
							stmt(
								"INSERT INTO checklist_items (id, checklist_id, title, position, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ? WHERE " +
									guardExists,
								copyId,
								value.checklistId,
								value.title,
								item.position,
								now,
								now,
								guard,
							),
							stmt(
								"INSERT INTO checklist_progress (checklist_id, item_id, completed_at, due_date, created_at, updated_at) SELECT checklist_id, ?, completed_at, due_date, ?, ? FROM checklist_progress WHERE checklist_id = ? AND item_id = ? AND " +
									guardExists,
								copyId,
								now,
								now,
								value.checklistId,
								value.itemId,
								guard,
							),
						);
					}
					return stmts;
				},
			);
		},

		async reorderChecklistItems(input: unknown) {
			const value = v.parse(reorderChecklistItemsInput, input);
			const list = await orm
				.select()
				.from(stageChecklists)
				.where(eq(stageChecklists.id, value.checklistId))
				.then((rows) => rows[0]);
			if (!list) throw new DataConflict();
			return mutation(
				value.requestId,
				{ operation: "reorder-checklist-items", ...value },
				{ checklistId: value.checklistId, revision: value.revision + 1 },
				(guard, now) => {
					const stmts: D1PreparedStatement[] = [
						stmt(
							"UPDATE stage_checklists SET revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = opportunity_id AND o.archived_at IS NULL)",
							now,
							value.checklistId,
							value.revision,
						),
						stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					];
					// Final positions overlap the current ones, so every affected item first vacates far above the list; the unique (template_id | checklist_id, position) indexes then never see a duplicate mid-update.
					stmts.push(
						stmt(
							"UPDATE checklist_items SET position = position + 10000, updated_at = ? WHERE (checklist_id = ? OR template_id = ?) AND id IN (" +
								value.itemIds.map(() => "?").join(",") +
								") AND " +
								guardExists,
							now,
							value.checklistId,
							list.templateId,
							...value.itemIds,
							guard,
						),
					);
					value.itemIds.forEach((itemId, index) => {
						stmts.push(
							stmt(
								"UPDATE checklist_items SET position = ?, updated_at = ? WHERE id = ? AND (checklist_id = ? OR template_id = ?) AND " +
									guardExists,
								index,
								now,
								itemId,
								value.checklistId,
								list.templateId,
								guard,
							),
						);
					});
					return stmts;
				},
			);
		},

		async moveStage(input: unknown) {
			const value = v.parse(moveStageInput, input);
			return mutation(
				value.requestId,
				{ operation: "move-stage", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						"UPDATE opportunities SET stage = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND archived_at IS NULL",
						value.stage,
						now,
						value.id,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					stmt(
						"INSERT INTO stage_checklists (id, opportunity_id, stage, template_id, created_at, updated_at) SELECT ?, o.id, o.stage, t.id, ?, ? FROM opportunities o JOIN checklist_templates t ON t.type = o.type AND t.stage = o.stage WHERE o.id = ? AND " +
							guardExists +
							" ON CONFLICT(opportunity_id, stage) DO NOTHING",
						crypto.randomUUID(),
						now,
						now,
						value.id,
						guard,
					),
					// Missing defaults must also roll back the stage move rather than create an unvisited current stage.
					stmt(
						"UPDATE mutation_guards SET passed = (SELECT count(*) FROM stage_checklists WHERE opportunity_id = ? AND stage = ?) WHERE id = ?",
						value.id,
						value.stage,
						guard,
					),
					appendHistory(guard, now, "opportunity", value.id, "move-stage", {
						revision: value.revision,
						stage: value.stage,
					}),
				],
			);
		},
		async saveOpportunity(input: unknown) {
			const value = v.parse(saveOpportunityInput, input);
			const before = await orm
				.select()
				.from(opportunities)
				.where(eq(opportunities.id, value.id))
				.then((rows) => rows[0]);
			if (!before) throw new DataConflict();
			const retainedLinks = await orm
				.select()
				.from(opportunityClients)
				.where(eq(opportunityClients.opportunityId, value.id));
			const beforeReferences = await orm
				.select()
				.from(recordReferences)
				.where(eq(recordReferences.opportunityId, value.id));
			const after = { ...before, ...value };
			const clientIds = value.clientIds ?? [];
			const clientIdList = clientIds.map(() => "?").join(",");
			const clientCountSql = clientIdList
				? `(SELECT count(*) FROM clients WHERE id IN (${clientIdList}) AND (archived_at IS NULL OR id IN (SELECT client_id FROM opportunity_clients WHERE opportunity_id = ?))) = ?`
				: "0 = 0";
			const clientParams = clientIdList ? [...clientIds, value.id, clientIds.length] : [];
			return mutation(
				value.requestId,
				{ operation: "save-opportunity", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						`UPDATE opportunities SET title = ?, type = ?, stage = ?, timeline = ?, address = ?, budget_cents = ?, notes = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND archived_at IS NULL AND ${clientCountSql}`,
						value.title,
						after.type,
						after.stage,
						after.timeline,
						after.address || null,
						after.budgetCents,
						after.notes,
						now,
						value.id,
						value.revision,
						...clientParams,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					stmt(
						"DELETE FROM opportunity_clients WHERE opportunity_id = ? AND " + guardExists,
						value.id,
						guard,
					),
					...clientIds.map((clientId) =>
						stmt(
							"INSERT INTO opportunity_clients (opportunity_id, client_id) SELECT ?, ? WHERE " +
								guardExists,
							value.id,
							clientId,
							guard,
						),
					),
					stmt(
						"INSERT INTO stage_checklists (id, opportunity_id, stage, template_id, created_at, updated_at) SELECT ?, o.id, o.stage, t.id, ?, ? FROM opportunities o JOIN checklist_templates t ON t.type = o.type AND t.stage = o.stage WHERE o.id = ? AND " +
							guardExists +
							" ON CONFLICT(opportunity_id, stage) DO NOTHING",
						crypto.randomUUID(),
						now,
						now,
						value.id,
						guard,
					),
					stmt(
						"UPDATE mutation_guards SET passed = (SELECT count(*) FROM stage_checklists WHERE opportunity_id = ? AND stage = ?) WHERE id = ?",
						value.id,
						after.stage,
						guard,
					),
					...writeReferences(guard, now, "opportunity_id", value.id, value.references),
					appendHistory(guard, now, "opportunity", value.id, "edit", {
						revision: value.revision,
						before: {
							...before,
							clientIds: retainedLinks.map((link) => link.clientId),
							references: beforeReferences,
						},
						after: value,
					}),
				],
			);
		},
		async archiveOpportunity(input: unknown) {
			const value = v.parse(archiveOpportunityInput, input);
			return mutation(
				value.requestId,
				{ operation: "archive-opportunity", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						"UPDATE opportunities SET archived_at = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND archived_at IS NULL",
						now,
						now,
						value.id,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					appendHistory(guard, now, "opportunity", value.id, "archive", {
						revision: value.revision,
						archivedAt: now,
					}),
				],
			);
		},
		async restoreOpportunity(input: unknown) {
			const value = v.parse(restoreOpportunityInput, input);
			return mutation(
				value.requestId,
				{ operation: "restore-opportunity", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => [
					stmt(
						"UPDATE opportunities SET archived_at = null, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND archived_at IS NOT NULL",
						now,
						value.id,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					appendHistory(guard, now, "opportunity", value.id, "restore", {
						revision: value.revision,
						archivedAt: null,
					}),
				],
			);
		},
		async pinOpportunity(input: unknown) {
			const value = v.parse(pinOpportunityInput, input);
			const historyId = crypto.randomUUID();
			return mutation(
				value.requestId,
				{ operation: "pin-opportunity", ...value },
				(now) => ({
					id: value.id,
					revision: value.revision + 1,
					pinnedAt: value.pinned ? now : null,
					updatedAt: now,
					history: {
						id: historyId,
						recordKind: "opportunity" as const,
						recordId: value.id,
						actorUserId: user.actorUserId,
						effectiveUserId: user.effectiveUserId,
						action: value.pinned ? "pin" : "unpin",
						data: { revision: value.revision, pinnedAt: value.pinned ? now : null },
						fictional: false,
						createdAt: now,
					},
				}),
				(guard, now) => [
					// Pinning an already-pinned opportunity (or unpinning an unpinned one) matches no row, so it conflicts like a stale revision.
					stmt(
						`UPDATE opportunities SET pinned_at = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND archived_at IS NULL AND pinned_at IS ${value.pinned ? "NULL" : "NOT NULL"}`,
						value.pinned ? now : null,
						now,
						value.id,
						value.revision,
					),
					stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
					appendHistory(
						guard,
						now,
						"opportunity",
						value.id,
						value.pinned ? "pin" : "unpin",
						{ revision: value.revision, pinnedAt: value.pinned ? now : null },
						historyId,
					),
				],
			);
		},
		async deleteOpportunity(input: unknown) {
			const value = v.parse(deleteOpportunityInput, input);
			return mutation(
				value.requestId,
				{ operation: "delete-opportunity", ...value },
				{ id: value.id, revision: value.revision },
				(guard, _now) => {
					// Resolve checklist ids via subqueries in SQL since the statements builder is sync.
					return [
						// 1. checklist_progress for this opportunity's checklists
						stmt(
							"DELETE FROM checklist_progress WHERE checklist_id IN (SELECT id FROM stage_checklists WHERE opportunity_id = ?)",
							value.id,
						),
						// 2. checklist_items for this opportunity's checklists
						stmt(
							"DELETE FROM checklist_items WHERE checklist_id IN (SELECT id FROM stage_checklists WHERE opportunity_id = ?)",
							value.id,
						),
						// 3. stage_checklists for this opportunity
						stmt("DELETE FROM stage_checklists WHERE opportunity_id = ?", value.id),
						// 4. record_references for this opportunity
						stmt("DELETE FROM record_references WHERE opportunity_id = ?", value.id),
						// 5. opportunity_clients for this opportunity
						stmt("DELETE FROM opportunity_clients WHERE opportunity_id = ?", value.id),
						// 6. tasks promoted from this opportunity's checklists
						stmt("DELETE FROM tasks WHERE opportunity_id = ?", value.id),
						// 7. history for this opportunity
						stmt("DELETE FROM history WHERE record_kind = 'opportunity' AND record_id = ?", value.id),
						// 8. the opportunity itself (guarded by revision match)
						stmt("DELETE FROM opportunities WHERE id = ? AND revision = ?", value.id, value.revision),
						stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard),
						// append a final history row is impossible for a deleted record; skip.
					];
				},
			);
		},
		async bulkArchive(input: unknown) {
			const value = v.parse(bulkArchiveInput, input);
			const placeholders = value.clients
				.map(() => "(id = ? AND revision = ? AND archived_at IS NULL)")
				.join(" OR ");
			return mutation(
				value.requestId,
				{ operation: "bulk-archive", ...value },
				{ ids: value.clients.map((client) => client.id) },
				(guard, now) => [
					stmt(
						`INSERT INTO mutation_guards VALUES (?, CASE WHEN (SELECT count(*) FROM clients WHERE ${placeholders}) = ? THEN 1 ELSE 0 END)`,
						guard,
						...value.clients.flatMap((client) => [client.id, client.revision]),
						value.clients.length,
					),
					...value.clients.flatMap((client) => [
						stmt(
							"UPDATE clients SET archived_at = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND " +
								guardExists,
							now,
							now,
							client.id,
							client.revision,
							guard,
						),
						appendHistory(guard, now, "client", client.id, "archive", {
							revision: client.revision,
							archivedAt: now,
						}),
					]),
				],
			);
		},
		// Tags, archives, or restores many clients in one transaction. Clients the change would not affect are skipped with a reason rather than failing the batch, and the changed ids come back so the view can undo exactly those.
		async bulkUpdateClients(input: unknown) {
			const value = v.parse(bulkUpdateClientsInput, input);
			const { action } = value;
			const payload = { operation: "bulk-update-clients", ...value };
			const replay = await replayMutation(value.requestId, payload);
			if (replay) return replay;
			type UndoReceipt = {
				changed: string[];
				action: typeof action;
				revisions: Record<string, number>;
				archivedBefore: Record<string, string | null>;
				undoOf?: string;
			};
			let original: UndoReceipt | undefined;
			if (value.undoOf) {
				const saved = await stmt(
					"SELECT actor_user_id, effective_user_id, payload_hash, result FROM mutation_receipts WHERE id = ?",
					value.undoOf,
				).first<Receipt>();
				if (
					!saved ||
					saved.actor_user_id !== user.actorUserId ||
					saved.effective_user_id !== user.effectiveUserId
				)
					throw new DataConflict();
				original = JSON.parse(saved.result) as UndoReceipt;
				const inverseKind = {
					addTag: "removeTag",
					removeTag: "addTag",
					archive: "restore",
					restore: "archive",
				}[original.action?.kind];
				if (
					original.undoOf ||
					action.kind !== inverseKind ||
					("tagId" in action &&
						(!("tagId" in original.action) || action.tagId !== original.action.tagId)) ||
					!original.revisions ||
					JSON.stringify(value.clientIds) !== JSON.stringify(original.changed)
				)
					throw new DataInvalid("Undo must refer to the original bulk change.");
			}
			const tag =
				"tagId" in action
					? await orm
							.select()
							.from(tags)
							.where(eq(tags.id, action.tagId))
							.then((rows) => rows[0])
					: undefined;
			if ("tagId" in action && !tag) throw new DataConflict();
			if (action.kind === "addTag" && tag?.retiredAt)
				throw new DataInvalid("A retired tag cannot be added to clients.");
			const found = await stmt(
				"SELECT c.id, c.name, c.revision, c.archived_at AS archivedAt, EXISTS (SELECT 1 FROM client_tags ct WHERE ct.client_id = c.id AND ct.tag_id = ?) AS tagged FROM clients c WHERE c.id IN (SELECT value FROM json_each(?))",
				tag?.id ?? "",
				JSON.stringify(value.clientIds),
			).all<{
				id: string;
				name: string;
				revision: number;
				archivedAt: string | null;
				tagged: number;
			}>();
			const rows = new Map(found.results.map((row) => [row.id, row]));
			const changed: { id: string; revision: number }[] = [];
			const skipped: { id: string; name: string; reason: string }[] = [];
			for (const id of value.clientIds) {
				const row = rows.get(id);
				if (!row) {
					skipped.push({ id, name: "A deleted client", reason: "No longer exists" });
					continue;
				}
				const reason =
					original && row.revision !== original.revisions[id]
						? "Changed since this action"
						: {
								addTag: row.tagged ? "Already tagged" : null,
								removeTag: row.tagged ? null : "Not tagged",
								archive: row.archivedAt ? "Already archived" : null,
								restore: row.archivedAt ? null : "Not archived",
							}[action.kind];
				if (reason) skipped.push({ id, name: row.name, reason });
				else changed.push(row);
			}
			const result = {
				changed: changed.map((row) => row.id),
				skipped,
				action,
				undoOf: value.undoOf,
				revisions: Object.fromEntries(changed.map((row) => [row.id, row.revision + 1])),
				archivedBefore: Object.fromEntries(
					changed.map((row) => [row.id, rows.get(row.id)!.archivedAt]),
				),
			};
			const ids = JSON.stringify(result.changed);
			const historyAction = {
				addTag: "tag",
				removeTag: "untag",
				archive: "archive",
				restore: "restore",
			}[action.kind];
			return mutation(value.requestId, payload, result, (guard, now) => [
				// Every changed client must still be at the revision read above, so a concurrent edit fails the whole batch instead of being overwritten.
				stmt(
					"INSERT INTO mutation_guards VALUES (?, CASE WHEN (SELECT count(*) FROM clients c JOIN json_each(?) j ON c.id = json_extract(j.value, '$[0]') AND c.revision = json_extract(j.value, '$[1]')) = ? AND (? = '' OR EXISTS (SELECT 1 FROM tags WHERE id = ? AND (? != 'addTag' OR retired_at IS NULL))) THEN 1 ELSE 0 END)",
					guard,
					JSON.stringify(changed.map((row) => [row.id, row.revision])),
					changed.length,
					tag?.id ?? "",
					tag?.id ?? "",
					action.kind,
				),
				stmt(
					"INSERT INTO history (id, record_kind, record_id, actor_user_id, effective_user_id, action, data, created_at) SELECT lower(hex(randomblob(16))), 'client', c.id, ?, ?, ?, json_object('revision', c.revision, 'tagId', ?, 'tagName', ?, 'archivedAt', ?, 'undoOf', ?), ? FROM clients c WHERE c.id IN (SELECT value FROM json_each(?)) AND " +
						guardExists,
					user.actorUserId,
					user.effectiveUserId,
					historyAction,
					tag?.id ?? null,
					tag?.name ?? null,
					action.kind === "archive" ? now : null,
					value.undoOf ?? null,
					now,
					ids,
					guard,
				),
				...(action.kind === "addTag"
					? [
							stmt(
								"INSERT INTO client_tags (client_id, tag_id) SELECT value, ? FROM json_each(?) WHERE " +
									guardExists,
								action.tagId,
								ids,
								guard,
							),
						]
					: action.kind === "removeTag"
						? [
								stmt(
									"DELETE FROM client_tags WHERE tag_id = ? AND client_id IN (SELECT value FROM json_each(?)) AND " +
										guardExists,
									action.tagId,
									ids,
									guard,
								),
							]
						: []),
				stmt(
					`UPDATE clients SET ${action.kind === "archive" ? (original ? "archived_at = (SELECT value FROM json_each(?) WHERE key = clients.id), " : "archived_at = ?, ") : action.kind === "restore" ? "archived_at = NULL, " : ""}revision = revision + 1, updated_at = ? WHERE id IN (SELECT value FROM json_each(?)) AND ` +
						guardExists,
					...(action.kind === "archive"
						? [original ? JSON.stringify(original.archivedBefore) : now]
						: []),
					now,
					ids,
					guard,
				),
			]);
		},
		async saveClient(input: unknown) {
			const value = v.parse(saveClientInput, input);
			const before = await orm
				.select()
				.from(clients)
				.where(eq(clients.id, value.id))
				.then((rows) => rows[0]);
			if (!before) throw new DataConflict();
			// A field left out keeps what the record already holds; an explicit null clears it.
			const leadSource = value.leadSource !== undefined ? value.leadSource : before.leadSource;
			const preferences = value.preferences !== undefined ? value.preferences : before.preferences;
			const preferredContactMethod =
				value.preferredContactMethod !== undefined
					? value.preferredContactMethod
					: before.preferredContactMethod;
			// Referred by is one value in two forms: naming a form replaces the other, and the record never holds both.
			const linkProvided = value.referredByClientId !== undefined;
			const nameProvided = value.referredByName !== undefined;
			const linkGiven = linkProvided && value.referredByClientId !== null;
			const nameGiven = nameProvided && !!value.referredByName?.trim();
			if (linkGiven && nameGiven)
				throw new DataInvalid("Referred by is either a linked client or a typed name, not both.");
			let referredByClientId = before.referredByClientId;
			let referredByName = before.referredByName;
			if (linkGiven) {
				referredByClientId = value.referredByClientId ?? null;
				referredByName = null;
			} else if (nameGiven) {
				referredByClientId = null;
				referredByName = value.referredByName!.trim();
			} else if (linkProvided && nameProvided) {
				referredByClientId = null;
				referredByName = null;
			} else if (linkProvided) {
				referredByClientId = null;
			} else if (nameProvided) {
				referredByName = null;
			}
			if (leadSource && leadSource !== before.leadSource && !leadSources.includes(leadSource))
				throw new DataInvalid("Choose a lead source from the list.");
			// Only a referral says who referred the client. Imported referrals arrived without a referrer, so only a new referral must name one.
			if (leadSource !== referralSource) {
				referredByClientId = null;
				referredByName = null;
			} else if (
				!referredByClientId &&
				!referredByName &&
				!(before.leadSource === referralSource && !before.referredByClientId && !before.referredByName)
			)
				throw new DataInvalid("A referral needs who referred the client.");
			const consentCall = value.consentCall !== undefined ? value.consentCall : before.consentCall;
			const consentText = value.consentText !== undefined ? value.consentText : before.consentText;
			const consentEmail = value.consentEmail !== undefined ? value.consentEmail : before.consentEmail;
			const consentMail = value.consentMail !== undefined ? value.consentMail : before.consentMail;
			const notes = value.notes !== undefined ? value.notes : before.notes;
			const people = value.people;
			const addresses = value.addresses;
			const relationships = value.relationships;
			const keyDates = value.keyDates;
			const tagIds = value.tagIds;
			const references = value.references;
			if (referredByClientId === value.id)
				throw new DataInvalid("A client cannot be the client that referred it.");
			for (const relationship of relationships ?? [])
				if (relationship.relatedClientId === value.id)
					throw new DataInvalid("A client cannot be related to itself.");
			if (referredByClientId) {
				const referredBy = await orm
					.select({ id: clients.id })
					.from(clients)
					.where(eq(clients.id, referredByClientId))
					.then((rows) => rows[0]);
				if (!referredBy) throw new DataConflict();
			}
			const relatedIds = [...new Set((relationships ?? []).map((row) => row.relatedClientId))];
			if (relatedIds.length) {
				const found = await orm
					.select({ id: clients.id })
					.from(clients)
					.where(inArray(clients.id, relatedIds))
					.then((rows) => rows.map((row) => row.id));
				if (found.length !== relatedIds.length) throw new DataConflict();
			}
			const beforePeople = await orm
				.select()
				.from(clientPeople)
				.where(eq(clientPeople.clientId, value.id));
			const beforeAddresses = await orm
				.select()
				.from(clientAddresses)
				.where(eq(clientAddresses.clientId, value.id));
			const beforeRelationships = await orm
				.select()
				.from(clientRelationships)
				.where(eq(clientRelationships.clientId, value.id));
			const beforeKeyDates = await orm
				.select()
				.from(clientKeyDates)
				.where(eq(clientKeyDates.clientId, value.id));
			const beforeTags = await orm
				.select({ tagId: clientTags.tagId })
				.from(clientTags)
				.where(eq(clientTags.clientId, value.id));
			return mutation(
				value.requestId,
				{ operation: "save-client", ...value },
				{ id: value.id, revision: value.revision + 1 },
				(guard, now) => {
					const stmts: D1PreparedStatement[] = [];
					stmts.push(
						stmt(
							"UPDATE clients SET name = ?, lead_source = ?, preferences = ?, preferred_contact_method = ?, referred_by_client_id = ?, referred_by_name = ?, consent_call = ?, consent_text = ?, consent_email = ?, consent_mail = ?, notes = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?",
							value.name,
							leadSource,
							preferences,
							preferredContactMethod,
							referredByClientId,
							referredByName,
							consentCall ? 1 : 0,
							consentText ? 1 : 0,
							consentEmail ? 1 : 0,
							consentMail ? 1 : 0,
							notes,
							now,
							value.id,
							value.revision,
						),
					);
					stmts.push(stmt("INSERT INTO mutation_guards VALUES (?, changes())", guard));
					// A collection that is left out keeps its rows; one that is sent replaces them.
					if (people !== undefined) {
						stmts.push(
							stmt(
								"DELETE FROM person_phones WHERE person_id IN (SELECT id FROM client_people WHERE client_id = ?)",
								value.id,
							),
							stmt(
								"DELETE FROM person_emails WHERE person_id IN (SELECT id FROM client_people WHERE client_id = ?)",
								value.id,
							),
							stmt("DELETE FROM client_people WHERE client_id = ?", value.id),
						);
						people.forEach((person, personIndex) => {
							stmts.push(
								stmt(
									"INSERT INTO client_people (id, client_id, name, birthday, position, revision, created_at, updated_at) SELECT ?, ?, ?, ?, ?, 1, ?, ? WHERE " +
										guardExists,
									person.id,
									value.id,
									person.name,
									person.birthday ?? null,
									personIndex,
									now,
									now,
									guard,
								),
							);
							(person.phones ?? []).forEach((phone, phoneIndex) => {
								stmts.push(
									stmt(
										"INSERT INTO person_phones (id, person_id, label, value, position, revision, created_at, updated_at) SELECT ?, ?, ?, ?, ?, 1, ?, ? WHERE " +
											guardExists,
										phone.id,
										person.id,
										phone.label,
										phone.value,
										phoneIndex,
										now,
										now,
										guard,
									),
								);
							});
							(person.emails ?? []).forEach((email, emailIndex) => {
								stmts.push(
									stmt(
										"INSERT INTO person_emails (id, person_id, label, value, position, revision, created_at, updated_at) SELECT ?, ?, ?, ?, ?, 1, ?, ? WHERE " +
											guardExists,
										email.id,
										person.id,
										email.label,
										email.value,
										emailIndex,
										now,
										now,
										guard,
									),
								);
							});
						});
					}
					if (addresses !== undefined) {
						stmts.push(stmt("DELETE FROM client_addresses WHERE client_id = ?", value.id));
						addresses.forEach((address, addressIndex) => {
							stmts.push(
								stmt(
									"INSERT INTO client_addresses (id, client_id, label, address, owned, position, revision, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, 1, ?, ? WHERE " +
										guardExists,
									address.id,
									value.id,
									address.label,
									address.address,
									address.owned ? 1 : 0,
									addressIndex,
									now,
									now,
									guard,
								),
							);
						});
					}
					if (relationships !== undefined) {
						stmts.push(stmt("DELETE FROM client_relationships WHERE client_id = ?", value.id));
						relationships.forEach((relationship) => {
							stmts.push(
								stmt(
									"INSERT INTO client_relationships (id, client_id, related_client_id, label, revision, created_at, updated_at) SELECT ?, ?, ?, ?, 1, ?, ? WHERE " +
										guardExists,
									relationship.id,
									value.id,
									relationship.relatedClientId,
									relationship.label,
									now,
									now,
									guard,
								),
							);
						});
					}
					if (keyDates !== undefined) {
						stmts.push(stmt("DELETE FROM client_key_dates WHERE client_id = ?", value.id));
						keyDates.forEach((keyDate) => {
							stmts.push(
								stmt(
									"INSERT INTO client_key_dates (id, client_id, name, date, revision, created_at, updated_at) SELECT ?, ?, ?, ?, 1, ?, ? WHERE " +
										guardExists,
									keyDate.id,
									value.id,
									keyDate.name,
									keyDate.date,
									now,
									now,
									guard,
								),
							);
						});
					}
					if (tagIds !== undefined) {
						stmts.push(stmt("DELETE FROM client_tags WHERE client_id = ?", value.id));
						for (const tagId of tagIds) {
							stmts.push(
								stmt(
									"INSERT INTO client_tags (client_id, tag_id) SELECT ?, ? WHERE " + guardExists,
									value.id,
									tagId,
									guard,
								),
							);
						}
					}
					stmts.push(...writeReferences(guard, now, "client_id", value.id, references));
					stmts.push(
						appendHistory(guard, now, "client", value.id, "edit", {
							revision: value.revision,
							before: {
								...before,
								people: beforePeople,
								addresses: beforeAddresses,
								relationships: beforeRelationships,
								keyDates: beforeKeyDates,
								tagIds: beforeTags.map((row) => row.tagId),
							},
							after: {
								name: value.name,
								leadSource,
								preferences,
								preferredContactMethod,
								referredByClientId,
								referredByName,
								consentCall,
								consentText,
								consentEmail,
								consentMail,
								notes,
								people: people ?? beforePeople,
								addresses: addresses ?? beforeAddresses,
								relationships: relationships ?? beforeRelationships,
								keyDates: keyDates ?? beforeKeyDates,
								tagIds: tagIds ?? beforeTags.map((row) => row.tagId),
							},
						}),
					);
					return stmts;
				},
			);
		},
	};
}

export type DataService = ReturnType<typeof createDataService>;
