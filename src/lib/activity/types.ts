// The shapes Activity renders, mapped from `getActivity` rows in `entries.ts`.

/** Zillow is import-only: Log contact never offers it. */
export type Channel = "call" | "text" | "email" | "meeting" | "other" | "zillow";
export type Direction = "outgoing" | "incoming";
export type Outcome =
	| "talked"
	| "voicemail"
	| "no-answer"
	| "wrong-number"
	| "met"
	| "no-show"
	| "bounced";

/** An entry's actor is a user, the client, or BoldTrail when an imported entry has no known author. */
export type Actor = { kind: "user"; userId: string } | { kind: "client" } | { kind: "boldtrail" };

export type Detail = { label: string; value: string };
export type FieldChange = { field: string; before: string; after: string };

type EntryBase = {
	id: string;
	/** ISO timestamp of when it happened. */
	at: string;
	actor: Actor;
	/** Imported entries belong to the BoldTrail era and can't be edited or deleted. */
	imported?: boolean;
	/** Set when the entry is about the client's opportunities rather than the client alone. A note has at most one; one logged contact can cover several. */
	opportunityIds?: string[];
	/** The business user the actor was impersonating. */
	actingAs?: string;
	/** A stored note's or logged contact's revision, which an edit or deletion must match. */
	revision?: number;
	/** Shown before the server has confirmed it. */
	pending?: boolean;
};

export type NoteEntry = EntryBase & {
	kind: "note";
	body: string;
	editedAt?: string;
	/** Replaces "Janae added a note" when nobody knows who wrote it, such as an old notes field. */
	title?: string;
};

export type ContactEntry = EntryBase & {
	kind: "contact";
	channel: Channel;
	/** The short label of an Other contact. */
	channelLabel?: string;
	direction: Direction;
	outcome?: Outcome;
	/** The message itself, or what was said. */
	note?: string;
	noteEditedAt?: string;
	/** The user who logged an incoming contact on the client's behalf. */
	loggedBy?: string;
	/** A templated send or a call-team attempt nobody typed; runs of these collapse. */
	automated?: boolean;
	/** The client's STOP reply, which turned texting off. */
	stop?: boolean;
	detail?: Detail[];
};

export type HistoryEntry = EntryBase & {
	kind: "history";
	/** One save's before and after per field. */
	changes?: FieldChange[];
	/** A change that isn't a field edit, worded after the actor: "edited a note". */
	summary?: string;
};

/** An imported system event: lead creation, routing status, a market report. */
export type EventEntry = EntryBase & {
	kind: "event";
	/** Worded after the actor ("set the follow-up status to claimed by agent"), unless `standalone`. */
	summary: string;
	/** The summary is a whole sentence with no actor in front: "Added from a Zillow inquiry about 418 Juniper Ct". */
	standalone?: boolean;
	/** The part of the summary that matters when scanning: "claimed by agent". */
	emphasis?: string[];
	/** Events sharing a key collapse into one run, such as market reports. */
	automation?: string;
	detail?: Detail[];
};

export type ActivityEntry = NoteEntry | ContactEntry | HistoryEntry | EventEntry;

export type ActivityOpportunity = {
	id: string;
	title: string;
	type: "buyer" | "seller" | "estate-sale" | "construction";
};
