import * as v from "valibot";

// The project avoids Workers' ambient types because they replace DOM globals, so this names the KV calls used here.
export interface FeedbackStore {
	get<T>(key: string, type: "json"): Promise<T | null>;
	getWithMetadata<M>(
		key: string,
		type: "arrayBuffer",
	): Promise<{ value: ArrayBuffer | null; metadata: M | null }>;
	put(key: string, value: string | Uint8Array, options?: { metadata: unknown }): Promise<void>;
	delete(key: string): Promise<void>;
	list(options: {
		prefix: string;
		cursor?: string;
	}): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

// Temporary beta tooling: feedback lives in its own KV namespace, outside the CRM's records and history. Each note and drawing has its own key so two people saving at once never overwrite each other's notes.
const noteKey = (id: string) => `note:${id}`;
const drawingKey = (id: string) => `drawing:${id}`;

export interface FeedbackNote {
	id: string;
	body: string;
	page: string;
	author: string;
	createdAt: number;
	updatedAt: number;
	hasDrawing: boolean;
}

export class FeedbackInvalid extends Error {}

const noteId = v.pipe(v.string(), v.uuid());
const drawing = v.pipe(
	v.string(),
	v.maxLength(10_000_000),
	v.regex(/^data:image\/(?:webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/),
);

export const feedbackNoteIdInput = noteId;
export const saveFeedbackNoteInput = v.strictObject({
	id: v.optional(noteId),
	body: v.pipe(v.string(), v.trim(), v.maxLength(5000)),
	page: v.pipe(v.string(), v.maxLength(2000), v.regex(/^\/(?!\/)/)),
	// Omitted keeps the note's drawing, and null removes it.
	drawing: v.optional(v.nullable(drawing)),
});

export async function listFeedbackNotes(kv: FeedbackStore) {
	const names: string[] = [];
	let cursor: string | undefined;
	do {
		const page = await kv.list({ prefix: "note:", cursor });
		names.push(...page.keys.map((key) => key.name));
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);
	const notes = await Promise.all(names.map((name) => kv.get<FeedbackNote>(name, "json")));
	return notes.filter((note) => note !== null).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveFeedbackNote(
	kv: FeedbackStore,
	input: v.InferOutput<typeof saveFeedbackNoteInput>,
	author: string,
) {
	const existing = input.id ? await kv.get<FeedbackNote>(noteKey(input.id), "json") : null;
	if (input.id && !existing) throw new FeedbackInvalid("This note has already been cleared.");
	const hasDrawing =
		input.drawing === undefined ? (existing?.hasDrawing ?? false) : input.drawing !== null;
	if (!input.body && !hasDrawing) throw new FeedbackInvalid("Add some text or a drawing first.");
	const now = Date.now();
	const note: FeedbackNote = existing
		? { ...existing, body: input.body, hasDrawing, updatedAt: now }
		: {
				id: crypto.randomUUID(),
				body: input.body,
				page: input.page,
				author,
				createdAt: now,
				updatedAt: now,
				hasDrawing,
			};
	// The drawing goes first so a note never promises a drawing that failed to save.
	if (input.drawing) {
		const [header, base64] = input.drawing.split(",");
		const contentType = header.slice("data:".length, -";base64".length);
		const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
		await kv.put(drawingKey(note.id), bytes, { metadata: { contentType } });
	}
	await kv.put(noteKey(note.id), JSON.stringify(note));
	if (input.drawing === null) await kv.delete(drawingKey(note.id));
	return note;
}

export async function clearFeedbackNote(kv: FeedbackStore, id: string) {
	await Promise.all([kv.delete(noteKey(id)), kv.delete(drawingKey(id))]);
}

export async function readFeedbackDrawing(kv: FeedbackStore, id: string) {
	const { value, metadata } = await kv.getWithMetadata<{ contentType: string }>(
		drawingKey(id),
		"arrayBuffer",
	);
	return value && metadata ? { bytes: value, contentType: metadata.contentType } : null;
}
