import { SvelteSet } from "svelte/reactivity";
import {
	deleteActivity,
	editActivityNote,
	getActivity,
	getClients,
	getLastContact,
	logContact,
	postNote,
} from "#lib/crm.remote.js";
import { activityEntries, type ActivityLookup, type ActivityRow } from "./entries.js";
import type { ActivityOpportunity, ContactEntry } from "./types.js";

type Owner = { clientId: string } | { opportunityId: string };
type Query = ReturnType<typeof getActivity>;
type Refreshable = Parameters<ReturnType<typeof postNote>["updates"]>[number];
type ContentRow = Extract<ActivityRow, { kind: "note" | "contact" }>;
export type NewOpportunity = { id: string; type: ActivityOpportunity["type"]; title: string };

// Logging or deleting contact moves Last contacted wherever it shows: a client's dialog, including one behind the Pipeline's full view, and the Registry's rows. Naming the query functions refreshes every open instance.
const contactQueries = [getLastContact, getClients];

const conflict = (cause: unknown) =>
	typeof cause === "object" && cause !== null && "status" in cause && cause.status === 409;

/** One record's Activity and the writes to it: the query owns confirmed entries, and each write shows at once through a temporary override that the server's answer replaces or rolls back. */
export class RecordActivity {
	readonly query: Query;
	/** The latest failed write's message, cleared by the next attempt. */
	failure = $state("");
	/** Entries whose write the server has not confirmed yet. */
	readonly pending = new SvelteSet<string>();
	#owner: Owner;
	#identity: () => { actorUserId: string; effectiveUserId: string };
	#others: () => (Query | undefined)[];
	#extra: () => Refreshable[];
	/** Request IDs by payload, so retrying an unchanged write after a lost answer replays it instead of writing twice. */
	#requests = new Map<string, { id: string; requestId: string }>();

	constructor(
		owner: Owner,
		options: {
			identity: () => { actorUserId: string; effectiveUserId: string };
			/** Other open Activity showing the same entries, such as the client's behind one of their opportunities. */
			others?: () => (Query | undefined)[];
			/** Queries a new opportunity changes, such as the workspace. */
			extra?: () => Refreshable[];
		},
	) {
		this.#owner = owner;
		this.query = getActivity(owner);
		this.#identity = options.identity;
		this.#others = options.others ?? (() => []);
		this.#extra = options.extra ?? (() => []);
	}

	get rows(): ActivityRow[] {
		return this.query.current ?? [];
	}

	/** The entries to render, marking those still being saved. */
	entries(lookup: ActivityLookup) {
		return activityEntries(this.rows, lookup).map((entry) =>
			this.pending.has(entry.id) ? { ...entry, pending: true } : entry,
		);
	}

	#request(payload: unknown, id: string = crypto.randomUUID()) {
		const key = JSON.stringify(payload);
		const request = this.#requests.get(key) ?? { id, requestId: crypto.randomUUID() };
		this.#requests.set(key, request);
		return { key, ...request };
	}

	// The confirmed rows arrive before the override is released, so an added row must not repeat one the server already returned.
	#add(row: ActivityRow) {
		return this.#override((rows) =>
			rows.some((item) => item.id === row.id) ? rows : [...rows, row],
		);
	}

	// Every open Activity refreshes with the write, such as the client's behind an opportunity's full view; the ones named here also show it at once.
	#override(update: (rows: ActivityRow[]) => ActivityRow[]): Refreshable[] {
		return [
			...[this.query, ...this.#others()].flatMap((query) =>
				query ? [query.withOverride(update)] : [],
			),
			getActivity,
		];
	}

	#author(): Pick<ContentRow, "actor" | "actingAs"> {
		const { actorUserId, effectiveUserId } = this.#identity();
		return {
			actor: { kind: "user", userId: actorUserId, name: "" },
			actingAs: actorUserId === effectiveUserId ? null : { userId: effectiveUserId, name: "" },
		};
	}

	async #write(id: string, key: string, failed: string, write: () => Promise<unknown>) {
		this.failure = "";
		this.pending.add(id);
		try {
			await write();
			this.#requests.delete(key);
			return true;
		} catch (cause) {
			// A refused edit or deletion means the entry changed elsewhere; showing the current version lets the user redo it.
			if (conflict(cause)) {
				this.#requests.delete(key);
				this.failure =
					"This entry changed elsewhere, so it now shows the saved version. Redo your change there.";
				await Promise.allSettled([this.query, ...this.#others()].map((query) => query?.refresh()));
			} else this.failure = failed;
			return false;
		} finally {
			this.pending.delete(id);
		}
	}

	/** Post a note on the record. */
	post(body: string) {
		const { key, id, requestId } = this.#request({ post: this.#owner, body });
		const now = new Date().toISOString();
		const row = {
			id,
			kind: "note",
			at: now,
			body,
			channel: null,
			channelLabel: null,
			direction: null,
			outcome: null,
			revision: 1,
			updatedAt: now,
			imported: false,
			automated: false,
			detail: {},
			opportunities: [],
			loggedBy: null,
			...this.#author(),
		} as ContentRow;
		return {
			id,
			saved: this.#write(
				id,
				key,
				"The note could not be posted. Your text is back in the box; post it again.",
				() => postNote({ id, requestId, owner: this.#owner, body }).updates(...this.#add(row)),
			),
		};
	}

	/** Log contact from the form's entry; `about` names the opportunities it covers, for showing it before the server answers. */
	log(entry: ContactEntry, about: ActivityOpportunity[], created?: NewOpportunity) {
		const opportunityIds =
			"clientId" in this.#owner
				? about.filter((row) => row.id !== created?.id).map((row) => row.id)
				: [];
		const contact = {
			owner: this.#owner,
			direction: entry.direction,
			occurredAt: new Date(entry.at).toISOString(),
			body: entry.note ?? "",
			...(opportunityIds.length ? { opportunityIds } : {}),
			...(created && "clientId" in this.#owner ? { newOpportunity: created } : {}),
		};
		const input =
			entry.channel === "call" || entry.channel === "meeting"
				? { ...contact, channel: entry.channel, outcome: entry.outcome }
				: entry.channel === "text" || entry.channel === "email"
					? {
							...contact,
							channel: entry.channel,
							...(entry.outcome === "bounced" ? { outcome: "bounced" as const } : {}),
						}
					: { ...contact, channel: "other" as const, channelLabel: entry.channelLabel ?? "" };
		const { key, id, requestId } = this.#request(input, entry.id);
		const { actorUserId } = this.#identity();
		const row = {
			id,
			kind: "contact",
			at: input.occurredAt,
			body: input.body,
			channel: input.channel,
			channelLabel: entry.channel === "other" ? (entry.channelLabel ?? null) : null,
			direction: entry.direction,
			outcome: entry.outcome ?? null,
			revision: 1,
			updatedAt: new Date().toISOString(),
			imported: false,
			automated: false,
			detail: {},
			opportunities: about,
			...this.#author(),
			...(entry.direction === "incoming"
				? { actor: { kind: "client", name: "" }, loggedBy: { userId: actorUserId, name: "" } }
				: { loggedBy: null }),
		} as ContentRow;
		return {
			id,
			saved: this.#write(
				id,
				key,
				"The contact could not be logged. Your entries are kept; log it again.",
				() =>
					logContact({ ...input, id, requestId } as Parameters<typeof logContact>[0]).updates(
						...this.#add(row),
						...contactQueries,
						...(created ? this.#extra() : []),
					),
			),
		};
	}

	/** Change a note's text, or a logged contact's note. */
	edit(id: string, body: string) {
		const row = this.rows.find(
			(item): item is ContentRow => item.id === id && item.kind !== "history",
		);
		if (!row || row.imported) return Promise.resolve(false);
		const { key, requestId } = this.#request({ edit: id, revision: row.revision, body });
		const now = new Date().toISOString();
		return this.#write(
			id,
			key,
			"The change could not be saved. Your text is kept; save it again.",
			() =>
				editActivityNote({ id, requestId, revision: row.revision, body }).updates(
					...this.#override((rows) =>
						rows.map((item) =>
							item.id === id && item.kind !== "history"
								? { ...item, body, revision: item.revision + 1, updatedAt: now }
								: item,
						),
					),
				),
		);
	}

	/** Delete a note or logged contact. */
	remove(id: string) {
		const row = this.rows.find(
			(item): item is ContentRow => item.id === id && item.kind !== "history",
		);
		if (!row || row.imported) return Promise.resolve(false);
		const { key, requestId } = this.#request({ remove: id, revision: row.revision });
		return this.#write(
			id,
			key,
			"The entry could not be deleted. It is back in Activity; try again.",
			() =>
				deleteActivity({ id, requestId, revision: row.revision }).updates(
					...this.#override((rows) => rows.filter((item) => item.id !== id)),
					...(row.kind === "contact" ? contactQueries : []),
				),
		);
	}
}
