import { command, form, getRequestEvent, query, requested } from "$app/server";
import { error } from "@sveltejs/kit";
import { DataConflict } from "#lib/server/data.js";
import {
	createClientInput,
	moveStageInput,
	saveOpportunityInput,
	workspaceInput,
} from "#lib/server/validation.js";

function services() {
	const event = getRequestEvent();
	if (!event.locals.data) error(401, "Workspace access is unavailable without a verified identity.");
	const origin = event.request.headers.get("origin");
	if (origin && origin !== event.locals.requestOrigin)
		error(403, "Cross-origin workspace access is not allowed.");
	return event.locals.data;
}

export const getWorkspace = query(workspaceInput, (input) => services().workspace(input));
export const getIdentity = query(() => services().identity);

async function save(action: () => Promise<Record<string, unknown>>) {
	try {
		const result = await action();
		await requested(getWorkspace, 2).refreshAll();
		return result;
	} catch (cause) {
		if (cause instanceof DataConflict) error(409, cause.message);
		throw cause;
	}
}

export const createClient = form(createClientInput, (input) => {
	const data = services();
	return save(() => data.createClient(input));
});

export const moveStage = command(moveStageInput, (input) => {
	const data = services();
	return save(() => data.moveStage(input));
});

export const saveOpportunity = command(saveOpportunityInput, (input) => {
	const data = services();
	return save(() => data.saveOpportunity(input));
});
