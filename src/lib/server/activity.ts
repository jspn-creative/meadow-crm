import type { D1Database } from "@cloudflare/workers-types";
import type { ActivityOpportunity } from "../activity/types.ts";
import type { activity } from "./db/schema.ts";

type Owner = { clientId: string } | { opportunityId: string };
type StoredActivity = typeof activity.$inferSelect;
type IdentityRow = {
	actorUserId: string;
	effectiveUserId: string;
	actorName: string | null;
	effectiveName: string | null;
};
type ActivityRow = IdentityRow &
	Pick<
		StoredActivity,
		| "id"
		| "kind"
		| "body"
		| "channel"
		| "channelLabel"
		| "direction"
		| "outcome"
		| "revision"
		| "updatedAt"
	> & {
		at: string;
		detail: string;
		imported: number;
		automated: number;
		clientIsActor: number;
		actorClientName: string | null;
		opportunities: string;
	};
type HistoryRow = IdentityRow & {
	id: string;
	at: string;
	recordKind: "client" | "opportunity" | "task";
	recordId: string;
	action: string;
	data: string;
	opportunityId: string | null;
	opportunityTitle: string | null;
	opportunityType: ActivityOpportunity["type"] | null;
};

const readObject = (value: string) => JSON.parse(value) as Record<string, unknown>;
function userName(id: string, name: string | null) {
	if (name) return name;
	if (id === "business-realtor") return "Realtor";
	if (id === "business-assistant") return "Assistant";
	if (id === "support-admin") return "Support admin";
	if (id === "local-seed") return "Local seed";
	return "User";
}
function attribution(row: IdentityRow, imported = false, client?: { name: string }) {
	const author = { userId: row.actorUserId, name: userName(row.actorUserId, row.actorName) };
	return {
		actor: client
			? { kind: "client" as const, name: client.name }
			: imported && row.actorUserId === "support-admin"
				? { kind: "boldtrail" as const, name: "BoldTrail" }
				: { kind: "user" as const, ...author },
		actingAs:
			row.actorUserId === row.effectiveUserId || (imported && row.actorUserId === "support-admin")
				? null
				: { userId: row.effectiveUserId, name: userName(row.effectiveUserId, row.effectiveName) },
		loggedBy: client && !imported ? author : null,
	};
}

// A note's or logged contact's columns and the joins that name its actors, shared by a record's Activity and Recent activity.
const contentColumns = `a.id, a.kind, a.body, a.channel, a.channel_label AS channelLabel, a.direction, a.outcome,
	a.revision, a.updated_at AS updatedAt, a.occurred_at AS at, a.detail, a.imported, a.automated,
	a.client_is_actor AS clientIsActor, a.actor_user_id AS actorUserId, a.effective_user_id AS effectiveUserId,
	actor.name AS actorName, effective.name AS effectiveName,
	speaker.name AS actorClientName`;
const contentJoins = `LEFT JOIN auth_user actor ON actor.id = a.actor_user_id
	LEFT JOIN auth_user effective ON effective.id = a.effective_user_id
	LEFT JOIN clients speaker ON speaker.id = coalesce(json_extract(a.detail, '$.actorClientId'), a.client_id)`;
const historyColumns = `h.action, h.data, h.actor_user_id AS actorUserId, h.effective_user_id AS effectiveUserId,
	actor.name AS actorName, effective.name AS effectiveName`;
const historyJoins = `LEFT JOIN auth_user actor ON actor.id = h.actor_user_id
	LEFT JOIN auth_user effective ON effective.id = h.effective_user_id`;

function contentEntry(row: ActivityRow) {
	const imported = Boolean(row.imported);
	return {
		id: row.id,
		kind: row.kind,
		at: row.at,
		body: row.body,
		channel: row.channel,
		channelLabel: row.channelLabel,
		direction: row.direction,
		outcome: row.outcome,
		revision: row.revision,
		updatedAt: row.updatedAt,
		imported,
		automated: Boolean(row.automated),
		detail: readObject(row.detail),
		opportunities: JSON.parse(row.opportunities) as ActivityOpportunity[],
		...attribution(
			row,
			imported,
			row.clientIsActor ? { name: row.actorClientName ?? "Client" } : undefined,
		),
	};
}

function historyEntry(row: HistoryRow, data: Record<string, unknown>, entryId: string) {
	return {
		id: entryId,
		kind: "history" as const,
		at: row.at,
		recordKind: row.recordKind,
		recordId: row.recordId,
		action: row.action,
		data,
		opportunities: [] as ActivityOpportunity[],
		...attribution(row),
	};
}

/** ACT-9: a contact reached the client when it was a call that talked, a meeting that happened, any incoming contact, or a sent text or email that didn't bounce. Imported contacts follow the same rule. */
const reached = (a: string) =>
	`(${a}.direction = 'incoming' OR (${a}.channel = 'call' AND ${a}.outcome = 'talked') OR (${a}.channel = 'meeting' AND ${a}.outcome = 'met') OR (${a}.channel IN ('text', 'email') AND coalesce(${a}.outcome, '') <> 'bounced'))`;
/** The IDs of a client's logged contact: on the client itself and on any of their opportunities. `client` is a SQL expression for the client's ID. */
const clientContacts = (client: string) =>
	`SELECT id FROM activity WHERE client_id = ${client} AND kind = 'contact'
	UNION SELECT link.activity_id FROM opportunity_clients oc
		JOIN activity_opportunities link ON link.opportunity_id = oc.opportunity_id
		WHERE oc.client_id = ${client}`;
/** SQL for when the client was last reached, or NULL when never; `client` is a SQL expression for the client's ID. */
export const lastContactedSql = (client: string) =>
	`(SELECT max(a.occurred_at) FROM activity a WHERE a.id IN (${clientContacts(client)}) AND a.kind = 'contact' AND ${reached("a")})`;

type ContactRow = Pick<
	StoredActivity,
	"id" | "channel" | "channelLabel" | "direction" | "outcome" | "actorUserId"
> & { at: string; imported: number; automated: number; clientIsActor: number };

/** A client's Last contacted and latest attempt (ACT-9), as the contacts they are; the same contact can be both. */
export async function readLastContact(db: D1Database, clientId: string) {
	const newest = (condition: string) =>
		db
			.prepare(
				`SELECT a.id, a.channel, a.channel_label AS channelLabel, a.direction, a.outcome, a.occurred_at AS at,
				a.actor_user_id AS actorUserId, a.imported, a.automated, a.client_is_actor AS clientIsActor
				FROM activity a WHERE a.id IN (${clientContacts("?1")}) AND a.kind = 'contact' AND ${condition}
				ORDER BY a.occurred_at DESC, a.id DESC LIMIT 1`,
			)
			.bind(clientId);
	const [contacted, attempted] = await db.batch<ContactRow>([
		newest(reached("a")),
		newest("a.direction = 'outgoing'"),
	]);
	const contact = (row: ContactRow | undefined) =>
		row && {
			id: row.id,
			kind: "contact" as const,
			at: row.at,
			channel: row.channel ?? "other",
			channelLabel: row.channelLabel ?? undefined,
			direction: row.direction ?? "outgoing",
			outcome: row.outcome ?? undefined,
			imported: Boolean(row.imported) || undefined,
			automated: Boolean(row.automated) || undefined,
			actor: row.clientIsActor
				? { kind: "client" as const }
				: row.imported && row.actorUserId === "support-admin"
					? { kind: "boldtrail" as const }
					: { kind: "user" as const, userId: row.actorUserId },
		};
	return {
		lastContacted: contact(contacted.results[0]),
		latestAttempt: contact(attempted.results[0]),
	};
}

export async function readActivity(db: D1Database, owner: Owner) {
	const client = "clientId" in owner;
	const id = client ? owner.clientId : owner.opportunityId;
	const kind = client ? "client" : "opportunity";
	const scope = client
		? "SELECT opportunity_id AS id FROM opportunity_clients WHERE client_id = ?1"
		: "SELECT id FROM opportunities WHERE id = ?1";
	const [content, changes] = await db.batch<ActivityRow | HistoryRow>([
		db
			.prepare(
				`WITH scope AS (${scope}),
			matches AS (
				${client ? "SELECT id, NULL AS opportunity_id FROM activity WHERE client_id = ?1 UNION ALL" : ""}
				SELECT a.id, a.opportunity_id FROM scope s JOIN activity a ON a.opportunity_id = s.id
				UNION ALL SELECT link.activity_id, link.opportunity_id
					FROM scope s JOIN activity_opportunities link ON link.opportunity_id = s.id
			)
			SELECT ${contentColumns},
				json_group_array(json_object('id', o.id, 'title', o.title, 'type', o.type) ORDER BY o.id)
					FILTER (WHERE o.id IS NOT NULL) AS opportunities
			FROM matches m JOIN activity a ON a.id = m.id
			LEFT JOIN opportunities o ON o.id = m.opportunity_id
			${contentJoins}
			GROUP BY a.id`,
			)
			.bind(id),
		db
			.prepare(
				`WITH scope AS (${scope}),
			matches AS (
				SELECT history.*, history.record_id AS owner_id FROM history
				WHERE record_kind = ?2 AND record_id = ?1
				AND EXISTS (SELECT 1 FROM ${client ? "clients" : "opportunities"} WHERE id = ?1)
				${
					client
						? `UNION ALL SELECT h.*, s.id FROM scope s JOIN history h
						ON h.record_kind = 'opportunity' AND h.record_id = s.id
						WHERE h.action IN ('edit-activity-note', 'delete-activity')`
						: `UNION ALL SELECT h.*, sc.opportunity_id FROM history h
						JOIN stage_checklists sc ON sc.id = json_extract(h.data, '$.checklistId')
						WHERE h.record_kind = 'opportunity' AND h.record_id = '' AND sc.opportunity_id = ?1`
				}
			)
			SELECT h.id, h.created_at AS at, h.record_kind AS recordKind, h.owner_id AS recordId, ${historyColumns},
				o.id AS opportunityId, o.title AS opportunityTitle, o.type AS opportunityType
			FROM matches h
			LEFT JOIN opportunities o ON h.record_kind = 'opportunity' AND o.id = h.owner_id
			${historyJoins}
			ORDER BY h.created_at, h.id`,
			)
			.bind(id, kind),
	]);
	const entries = (content.results as ActivityRow[]).map(contentEntry);
	const history = new Map<string, ReturnType<typeof historyEntry>>();
	for (const row of changes.results as HistoryRow[]) {
		const data = readObject(row.data);
		const id = typeof data.eventId === "string" ? data.eventId : row.id;
		const entry = history.get(id) ?? historyEntry(row, data, id);
		if (row.opportunityId && row.opportunityTitle && row.opportunityType)
			entry.opportunities.push({
				id: row.opportunityId,
				title: row.opportunityTitle,
				type: row.opportunityType,
			});
		history.set(id, entry);
	}
	return [...entries, ...history.values()].sort(
		(a, b) =>
			a.at.localeCompare(b.at) ||
			Number(a.kind === "history") - Number(b.kind === "history") ||
			a.id.localeCompare(b.id),
	);
}

type RecordRow = {
	recordKind: "client" | "opportunity" | "task";
	recordId: string;
	title: string;
	archivedAt: string | null;
	recordedAt: string;
};
const recordOf = (row: RecordRow) => ({
	kind: row.recordKind,
	id: row.recordId,
	title: row.title,
	archivedAt: row.archivedAt,
});

/** The latest History, notes, and logged contact across records, newest recorded first, each with the record it belongs to. Imported entries stay out, so years of BoldTrail history never fill the list. */
export async function readRecentActivity(db: D1Database, limit: number) {
	const [content, changes] = await db.batch<(ActivityRow | HistoryRow) & RecordRow>([
		db
			.prepare(
				`SELECT r.*, coalesce(c.name, o.title) AS title, coalesce(c.archived_at, o.archived_at) AS archivedAt
			FROM (
				SELECT ${contentColumns},
					json_group_array(json_object('id', o.id, 'title', o.title, 'type', o.type) ORDER BY o.id)
						FILTER (WHERE o.id IS NOT NULL) AS opportunities,
					CASE WHEN a.client_id IS NOT NULL THEN 'client' ELSE 'opportunity' END AS recordKind,
					coalesce(a.client_id, a.opportunity_id, min(link.opportunity_id)) AS recordId,
					a.created_at AS recordedAt
				FROM (SELECT * FROM activity WHERE imported = 0 ORDER BY created_at DESC, id DESC LIMIT ?1) a
				LEFT JOIN activity_opportunities link ON link.activity_id = a.id
				LEFT JOIN opportunities o ON o.id = coalesce(a.opportunity_id, link.opportunity_id)
				${contentJoins}
				GROUP BY a.id
			) r
			LEFT JOIN clients c ON r.recordKind = 'client' AND c.id = r.recordId
			LEFT JOIN opportunities o ON r.recordKind = 'opportunity' AND o.id = r.recordId
			WHERE c.id IS NOT NULL OR o.id IS NOT NULL`,
			)
			.bind(limit),
		// Posting a note or logging contact shows as the entry itself, so its History row stays out, as in Activity.
		db
			.prepare(
				`SELECT h.id, h.created_at AS at, h.created_at AS recordedAt, h.record_kind AS recordKind,
				COALESCE(NULLIF(h.record_id, ''), sc.opportunity_id) AS recordId, ${historyColumns},
				o.id AS opportunityId, o.title AS opportunityTitle, o.type AS opportunityType,
				COALESCE(c.name, o.title, t.title) AS title, COALESCE(c.archived_at, o.archived_at) AS archivedAt
			FROM history h
			LEFT JOIN stage_checklists sc ON h.record_kind = 'opportunity' AND h.record_id = '' AND sc.id = json_extract(h.data, '$.checklistId')
			LEFT JOIN clients c ON h.record_kind = 'client' AND c.id = h.record_id
			LEFT JOIN opportunities o ON h.record_kind = 'opportunity' AND o.id = COALESCE(NULLIF(h.record_id, ''), sc.opportunity_id)
			LEFT JOIN tasks t ON h.record_kind = 'task' AND t.id = h.record_id
			${historyJoins}
			WHERE (c.id IS NOT NULL OR o.id IS NOT NULL OR t.id IS NOT NULL)
				AND h.action NOT IN ('post-note', 'log-contact')
			ORDER BY h.created_at DESC, h.id DESC LIMIT ?1`,
			)
			.bind(limit),
	]);
	const entries = (content.results as (ActivityRow & RecordRow)[]).map((row) => ({
		...contentEntry(row),
		record: recordOf(row),
		recordedAt: row.recordedAt,
	}));
	const history = new Map<
		string,
		ReturnType<typeof historyEntry> & { record: ReturnType<typeof recordOf>; recordedAt: string }
	>();
	for (const row of changes.results as (HistoryRow & RecordRow)[]) {
		const data = readObject(row.data);
		const id = typeof data.eventId === "string" ? data.eventId : row.id;
		const entry = history.get(id) ?? {
			...historyEntry(row, data, id),
			record: recordOf(row),
			recordedAt: row.recordedAt,
		};
		if (row.opportunityId && row.opportunityTitle && row.opportunityType)
			entry.opportunities.push({
				id: row.opportunityId,
				title: row.opportunityTitle,
				type: row.opportunityType,
			});
		history.set(id, entry);
	}
	return [...entries, ...history.values()]
		.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id))
		.slice(0, limit);
}
