import { dev } from "$app/env";
import { error } from "@sveltejs/kit";

export function load({ locals }: { locals: App.Locals }) {
	if (!dev || !locals.data) error(404, "Not found");
}
