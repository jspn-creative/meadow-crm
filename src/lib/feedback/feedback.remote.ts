import { command, getRequestEvent, query } from "$app/server";
import { dev } from "$app/env";
import { error } from "@sveltejs/kit";
import { supportAdminId } from "#lib/server/auth.js";
import {
	clearFeedbackNote as clearNote,
	FeedbackInvalid,
	feedbackNoteIdInput,
	listFeedbackNotes,
	saveFeedbackNote as saveNote,
	saveFeedbackNoteInput,
} from "#lib/server/feedback.js";

function feedback() {
	const event = getRequestEvent();
	const identity = event.locals.data?.identity;
	if (!identity) error(401, "Workspace access is unavailable without a verified identity.");
	const origin = event.request.headers.get("origin");
	if (origin && origin !== event.locals.requestOrigin)
		error(403, "Cross-origin workspace access is not allowed.");
	const kv = event.platform?.env.FEEDBACK;
	if (!kv) error(503, "Feedback storage is unavailable.");
	// Only the developer clears notes: the support admin in production, or anyone on the developer's own local server.
	return { kv, identity, canClear: dev || identity.actorUserId === supportAdminId };
}

export const getFeedbackNotes = query(async () => {
	const { kv, canClear } = feedback();
	return { notes: await listFeedbackNotes(kv), canClear };
});

export const saveFeedbackNote = command(saveFeedbackNoteInput, async (input) => {
	const { kv, identity } = feedback();
	const role = identity.role === "realtor" ? "Realtor" : "Assistant";
	const author =
		identity.actorUserId === identity.effectiveUserId ? role : `Support admin as ${role}`;
	try {
		return await saveNote(kv, input, author);
	} catch (cause) {
		if (cause instanceof FeedbackInvalid) error(400, cause.message);
		throw cause;
	}
});

export const clearFeedbackNote = command(feedbackNoteIdInput, async (id) => {
	const { kv, canClear } = feedback();
	if (!canClear) error(403, "Only the developer can clear notes.");
	await clearNote(kv, id);
});
