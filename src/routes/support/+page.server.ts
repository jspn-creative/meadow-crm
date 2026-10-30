import { redirect } from "@sveltejs/kit";

export const load = ({ locals }: { locals: App.Locals }) => {
	if (!locals.support) redirect(303, "/");
	return {};
};
