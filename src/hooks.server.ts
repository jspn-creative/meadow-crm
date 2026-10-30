import { dev } from "$app/env";
import { env } from "cloudflare:workers";
import type { Handle } from "@sveltejs/kit/hooks";
import { createDataService } from "#lib/server/data.js";
import { resolveLocalIdentity } from "#lib/server/identity.js";
import { createAuth, loginFailure, sessionIdentity } from "#lib/server/auth.js";
import {
	supportContext,
	supportAction,
	revokeImpersonation,
	clearSupportCookie,
} from "#lib/server/support.js";

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.requestOrigin = event.url.origin;
	const auth = createAuth(env, dev);
	const path = event.url.pathname;
	const noStore = (response: Response) => {
		response.headers.set("cache-control", "private, no-store");
		return response;
	};
	const stub = resolveLocalIdentity(
		dev,
		event.url,
		dev && (env.LOCAL_IDENTITY_STUB === "true" || process.env.LOCAL_IDENTITY_STUB === "true")
			? env.LOCAL_DEMO_USER
			: undefined,
	);
	let session = null;
	let support = null;
	try {
		session =
			auth && event.request.headers.has("cookie")
				? await auth.api.getSession({ headers: event.request.headers })
				: null;
		support = auth
			? await supportContext(auth, event.request.headers, event.cookies, session, env.DB)
			: null;
	} catch {
		// Do not let adapter errors expose session tokens or bound parameters in server logs.
		return noStore(Response.json({ message: loginFailure }, { status: 503 }));
	}
	const identity = support
		? support.identity
		: session?.session.impersonatedBy
			? null
			: (sessionIdentity(session?.user.id) ?? (session ? null : stub));
	event.locals.support = support
		? {
				effectiveUser: support.identity?.role ?? null,
				expiresAt: support.expiresAt,
				sessionId: support.identity ? session!.session.id : null,
			}
		: null;
	event.locals.data = identity ? createDataService(env.DB, identity) : null;
	if (path.startsWith("/api/support/")) {
		if (!auth || !support) return noStore(new Response(null, { status: session ? 403 : 401 }));
		if (event.request.headers.get("origin") !== new URL(env.BETTER_AUTH_URL!).origin)
			return noStore(new Response(null, { status: 403 }));
		try {
			return noStore(
				await supportAction(
					auth,
					support,
					event.request,
					event.cookies,
					env.DB,
					path.slice("/api/support/".length),
				),
			);
		} catch {
			return noStore(
				Response.json({ message: "Unable to change impersonation. Try again." }, { status: 503 }),
			);
		}
	}
	if (path.startsWith("/api/auth/")) {
		const endpoint = path.slice("/api/auth/".length);
		const allowed = ["sign-in/email", "sign-out", "change-password", "get-session"];
		if (!allowed.includes(endpoint)) return noStore(new Response(null, { status: 404 }));
		if (!auth) return noStore(Response.json({ message: loginFailure }, { status: 503 }));
		if (endpoint !== "sign-in/email" && !sessionIdentity(session?.user.id) && !support)
			return noStore(new Response(null, { status: 401 }));
		if (
			session?.session.impersonatedBy &&
			!support &&
			!["sign-in/email", "sign-out"].includes(endpoint)
		)
			return noStore(new Response(null, { status: 401 }));
		if (endpoint === "change-password" && support?.identity)
			return noStore(new Response(null, { status: 403 }));
		if (
			event.request.method !== "GET" &&
			event.request.headers.get("origin") !== new URL(env.BETTER_AUTH_URL!).origin
		)
			return noStore(Response.json({ message: loginFailure }, { status: 403 }));
		let request = event.request;
		if (support && !support.identity && endpoint !== "sign-in/email")
			request = new Request(request, { headers: support.rootHeaders });
		if (endpoint === "sign-out" && support) {
			try {
				await revokeImpersonation(env.DB, support.root.session.id);
			} catch {
				return noStore(Response.json({ message: loginFailure }, { status: 503 }));
			}
			request = new Request(request, { headers: support.rootHeaders });
		}
		if (endpoint === "change-password" && request.method === "POST") {
			try {
				const body = await request.json();
				request = new Request(request, {
					body: JSON.stringify({ ...body, revokeOtherSessions: true }),
				});
			} catch {
				return noStore(new Response(null, { status: 400 }));
			}
		}
		// Only Cloudflare supplies this address in production; local development uses a single loopback bucket.
		if (dev) {
			const headers = new Headers(request.headers);
			headers.set("cf-connecting-ip", "127.0.0.1");
			request = new Request(request, { headers });
		}
		let response: Response;
		try {
			response = await auth.handler(request);
		} catch {
			return noStore(Response.json({ message: loginFailure }, { status: 503 }));
		}
		if (endpoint === "sign-in/email" && !response.ok)
			return noStore(
				Response.json(
					{ message: loginFailure },
					{
						status: response.status,
						headers: response.headers.has("retry-after")
							? { "retry-after": response.headers.get("retry-after")! }
							: undefined,
					},
				),
			);
		if (endpoint === "sign-in/email" && response.ok && support) {
			try {
				await revokeImpersonation(env.DB, support.root.session.id);
				await env.DB.prepare("DELETE FROM auth_session WHERE id = ?")
					.bind(support.root.session.id)
					.run();
			} catch {
				return noStore(Response.json({ message: loginFailure }, { status: 503 }));
			}
		}
		if (
			(endpoint === "sign-in/email" ||
				endpoint === "sign-out" ||
				(endpoint === "change-password" && support)) &&
			response.ok
		)
			clearSupportCookie(event.cookies, response);
		return noStore(response);
	}
	if (path === "/support" && support) return noStore(await resolve(event));
	if (!identity && path !== "/login") {
		if (
			event.request.method !== "GET" ||
			path.startsWith("/_app/remote/") ||
			event.url.searchParams.has("/remote")
		)
			return noStore(
				Response.json(
					{ message: "Workspace access is unavailable without a verified identity." },
					{ status: 401 },
				),
			);
		return noStore(
			new Response(null, {
				status: 303,
				headers: {
					location: support ? "/support" : `/login?next=${encodeURIComponent(path + event.url.search)}`,
				},
			}),
		);
	}
	return noStore(await resolve(event));
};
