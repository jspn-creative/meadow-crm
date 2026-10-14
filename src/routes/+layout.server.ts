import { dev } from "$app/env";
import { getIdentity } from "#lib/crm.remote.js";

// Bootstrap request identity through the same remote-query boundary used by the coming persisted slice; never ship CRM records from the demo shell load.
export const load = async ({ locals }: { locals: App.Locals }) => {
	if (!dev || !locals.data) return { identity: null };
	return { identity: await getIdentity() };
};
