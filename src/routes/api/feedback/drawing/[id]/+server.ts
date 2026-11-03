import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { readFeedbackDrawing } from "#lib/server/feedback.js";

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.data) error(401, "Workspace access is unavailable without a verified identity.");
	const kv = platform?.env.FEEDBACK;
	if (!kv) error(503, "Feedback storage is unavailable.");
	const drawing = await readFeedbackDrawing(kv, params.id);
	if (!drawing) error(404, "This drawing has been cleared.");
	return new Response(drawing.bytes, { headers: { "content-type": drawing.contentType } });
};
