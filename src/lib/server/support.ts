import type { Cookies } from "@sveltejs/kit";
import { getCookies, createCookieGetter } from "better-auth/cookies";
import { createAuth, supportAdminId, sessionIdentity, impersonationDuration } from "./auth.js";

type Auth = NonNullable<ReturnType<typeof createAuth>>;
type Session = Awaited<ReturnType<Auth["api"]["getSession"]>>;
export interface SupportState {
	effectiveUser: "realtor" | "assistant" | null;
	expiresAt: number | null;
	sessionId: string | null;
}
const supportCookie = "meadow_support_session";

export async function supportContext(
	auth: Auth,
	headers: Headers,
	cookies: Cookies,
	session: Session,
	db: Cloudflare.Env["DB"],
) {
	if (session && session.user.id !== supportAdminId && !session.session.impersonatedBy) return null;
	const tokenCookie = getCookies(auth.options).sessionToken;
	const saved = cookies.get(supportCookie);
	const rootHeaders = new Headers(headers);
	if (session?.user.id !== supportAdminId || session.session.impersonatedBy) {
		if (!saved) return null;
		rootHeaders.set("cookie", `${tokenCookie.name}=${encodeURIComponent(saved)}`);
	}
	const root =
		session?.user.id === supportAdminId && !session.session.impersonatedBy
			? session
			: await auth.api.getSession({ headers: rootHeaders });
	if (
		!root ||
		root.user.id !== supportAdminId ||
		root.user.role !== "admin" ||
		root.user.banned ||
		root.session.impersonatedBy
	)
		return null;
	let identity = null;
	let expiresAt = null;
	if (session?.session.impersonatedBy === supportAdminId && sessionIdentity(session.user.id)) {
		const bound = await db
			.prepare(
				"SELECT support_session_id FROM auth_support_impersonation WHERE support_session_id = ? AND impersonation_session_id = ?",
			)
			.bind(root.session.id, session.session.id)
			.first();
		const expiry = Math.min(
			session.session.expiresAt.getTime(),
			session.session.createdAt.getTime() + impersonationDuration * 1000,
			root.session.expiresAt.getTime(),
		);
		if (bound && expiry > Date.now()) {
			identity = { ...sessionIdentity(session.user.id)!, actorUserId: supportAdminId };
			expiresAt = expiry;
		}
	}
	return {
		root,
		rootHeaders,
		identity,
		expiresAt,
		tokenCookie,
		saved: saved ?? cookies.get(tokenCookie.name),
	};
}

export async function revokeImpersonation(db: Cloudflare.Env["DB"], rootId: string) {
	await db
		.prepare(
			"DELETE FROM auth_session WHERE id IN (SELECT impersonation_session_id FROM auth_support_impersonation WHERE support_session_id = ?)",
		)
		.bind(rootId)
		.run();
}

export async function supportAction(
	auth: Auth,
	context: NonNullable<Awaited<ReturnType<typeof supportContext>>>,
	request: Request,
	cookies: Cookies,
	db: Cloudflare.Env["DB"],
	action: string,
) {
	if (request.method !== "POST") return new Response(null, { status: 405 });
	const cookieOptions = {
		path: "/",
		httpOnly: true,
		secure: context.tokenCookie.attributes.secure,
		sameSite: "lax" as const,
		maxAge: Math.max(0, Math.floor((context.root.session.expiresAt.getTime() - Date.now()) / 1000)),
	};
	if (action === "choose") {
		let userId: string;
		try {
			userId = (await request.json()).userId;
		} catch {
			return new Response(null, { status: 400 });
		}
		if (!sessionIdentity(userId)) return new Response(null, { status: 400 });
		// Better Auth verifies the support admin's permissions and issues the impersonated session and signed cookies.
		const response = await auth.api.impersonateUser({
			headers: context.rootHeaders,
			body: { userId },
			asResponse: true,
		});
		if (!response.ok) return response;
		const result = (await response.clone().json()) as { session: { id: string } };
		await db.batch([
			db
				.prepare(
					"DELETE FROM auth_session WHERE id IN (SELECT impersonation_session_id FROM auth_support_impersonation WHERE support_session_id = ?)",
				)
				.bind(context.root.session.id),
			db
				.prepare(
					"INSERT INTO auth_support_impersonation (support_session_id, impersonation_session_id) VALUES (?, ?)",
				)
				.bind(context.root.session.id, result.session.id),
		]);
		// Do not return session tokens to UI code; only Better Auth's HTTP-only cookies are needed.
		const headers = new Headers(response.headers);
		headers.delete("content-length");
		headers.append("set-cookie", cookies.serialize(supportCookie, context.saved!, cookieOptions));
		return new Response("{}", { headers });
	}
	if (action === "exit") {
		await revokeImpersonation(db, context.root.session.id);
		const headers = new Headers();
		headers.append(
			"set-cookie",
			cookies.serialize(context.tokenCookie.name, context.saved!, cookieOptions),
		);
		headers.append(
			"set-cookie",
			cookies.serialize(supportCookie, "", { ...cookieOptions, maxAge: 0 }),
		);
		const adminCookie = createCookieGetter(auth.options)("admin_session");
		headers.append(
			"set-cookie",
			cookies.serialize(adminCookie.name, "", { ...cookieOptions, maxAge: 0 }),
		);
		return Response.json({}, { headers });
	}
	return new Response(null, { status: 404 });
}

export function clearSupportCookie(cookies: Cookies, response: Response) {
	response.headers.append(
		"set-cookie",
		cookies.serialize(supportCookie, "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 }),
	);
}
