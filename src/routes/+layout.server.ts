import { getIdentity } from "#lib/crm.remote.js";

// Identity comes from the authenticated request, never a browser-supplied user ID.
export const load = async ({ locals }: { locals: App.Locals }) => {
	if (!locals.data) return { identity: null, support: locals.support };
	return { identity: await getIdentity(), support: locals.support };
};
