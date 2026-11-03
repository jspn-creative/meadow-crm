import { command, form, getRequestEvent, query, requested } from "$app/server";
import { error } from "@sveltejs/kit";
import { DataConflict, DataInvalid } from "#lib/server/data.js";
import {
	addChecklistItemInput,
	archiveOpportunityInput,
	createClientInput,
	createOpportunityInput,
	createOpportunityFormInput,
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
	clientsQueryInput,
	clientFiltersInput,
	bulkUpdateClientsInput,
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
export const getRecentActivity = query(() => services().recentActivity());
export const getClients = query(clientsQueryInput, (input) => services().clients(input));
export const getClientFacets = query(clientFiltersInput, (input) => services().clientFacets(input));
export const getClientIds = query(clientFiltersInput, (input) => services().clientIds(input));

export const createTask = command(createTaskInput, (input) => {
	const data = services();
	return save(() => data.createTask(input));
});
export const saveTask = command(saveTaskInput, (input) => {
	const data = services();
	return save(() => data.saveTask(input));
});
export const completeTask = command(completeTaskInput, (input) => {
	const data = services();
	return save(() => data.completeTask(input));
});
export const deleteTask = command(deleteTaskInput, (input) => {
	const data = services();
	return save(() => data.deleteTask(input));
});

async function save(action: () => Promise<Record<string, unknown>>) {
	try {
		const result = await action();
		await Promise.all([
			requested(getWorkspace, 2).refreshAll(),
			requested(getClients, 40).refreshAll(),
			requested(getClientFacets, 2).refreshAll(),
			getRecentActivity().refresh(),
		]);
		return result;
	} catch (cause) {
		if (cause instanceof DataConflict) error(409, cause.message);
		if (cause instanceof DataInvalid) error(400, cause.message);
		throw cause;
	}
}

export const createClient = form(createClientInput, (input) => {
	const data = services();
	return save(() => data.createClient(input));
});

export const bulkUpdateClients = command(bulkUpdateClientsInput, (input) => {
	const data = services();
	return save(() => data.bulkUpdateClients(input));
});

export const saveClient = command(saveClientInput, (input) => {
	const data = services();
	return save(() => data.saveClient(input));
});

export const createOpportunity = form(createOpportunityFormInput, (input) => {
	const data = services();
	return save(() => data.createOpportunity(input));
});

export const createOpportunityRecord = command(createOpportunityInput, (input) => {
	const data = services();
	return save(() => data.createOpportunity(input));
});

export const saveChecklistStep = command(saveChecklistStepInput, (input) => {
	const data = services();
	return save(() => data.saveChecklistStep(input));
});

export const moveStage = command(moveStageInput, (input) => {
	const data = services();
	return save(() => data.moveStage(input));
});

export const saveOpportunity = command(saveOpportunityInput, (input) => {
	const data = services();
	return save(() => data.saveOpportunity(input));
});

export const archiveOpportunity = command(archiveOpportunityInput, (input) => {
	const data = services();
	return save(() => data.archiveOpportunity(input));
});

export const restoreOpportunity = command(restoreOpportunityInput, (input) => {
	const data = services();
	return save(() => data.restoreOpportunity(input));
});

export const pinOpportunity = command(pinOpportunityInput, async (input) => {
	const data = services();
	try {
		// Pinning changes no Registry fields; return its confirmed patch instead of reloading the workspace.
		const result = await data.pinOpportunity(input);
		await getRecentActivity().refresh();
		return result;
	} catch (cause) {
		if (cause instanceof DataConflict) error(409, cause.message);
		if (cause instanceof DataInvalid) error(400, cause.message);
		throw cause;
	}
});

export const deleteOpportunity = command(deleteOpportunityInput, (input) => {
	const data = services();
	return save(() => data.deleteOpportunity(input));
});

export const addChecklistItem = command(addChecklistItemInput, (input) => {
	const data = services();
	return save(() => data.addChecklistItem(input));
});

export const removeChecklistItem = command(removeChecklistItemInput, (input) => {
	const data = services();
	return save(() => data.removeChecklistItem(input));
});

export const renameChecklistItem = command(renameChecklistItemInput, (input) => {
	const data = services();
	return save(() => data.renameChecklistItem(input));
});

export const reorderChecklistItems = command(reorderChecklistItemsInput, (input) => {
	const data = services();
	return save(() => data.reorderChecklistItems(input));
});
