import { dev } from "$app/env";
import { env } from "cloudflare:workers";
import type { Handle } from "@sveltejs/kit/hooks";
import { createDataService } from "#lib/server/data.js";
import { resolveLocalIdentity } from "#lib/server/identity.js";

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.requestOrigin = event.url.origin;
	const identity = resolveLocalIdentity(dev, event.url, dev ? env.LOCAL_DEMO_USER : undefined);
	event.locals.data = identity ? createDataService(env.DB, identity) : null;
	const response = await resolve(event);
	response.headers.set("cache-control", "private, no-store");
	return response;
};
