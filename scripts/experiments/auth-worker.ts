import type { D1Database } from "@cloudflare/workers-types";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import { verifyPassword } from "better-auth/crypto";
import * as schema from "./auth-schema.ts";

function check(value: unknown, message: string): asserts value {
	if (!value) throw new Error(message);
}

export default {
	async fetch(_request: Request, env: { DB: D1Database }) {
		await env.DB.batch(schema.ddl.map((sql) => env.DB.prepare(sql)));
		const db = drizzle(env.DB, { schema });
		let transactionCalls = 0;
		// A tripwire proves the adapter never attempts unsupported interactive D1 transactions during these flows.
		db.transaction = (() => {
			transactionCalls++;
			throw new Error("Interactive D1 transaction attempted");
		}) as typeof db.transaction;
		const auth = betterAuth({
			baseURL: "http://localhost:5190",
			secret: crypto.randomUUID() + crypto.randomUUID(),
			database: drizzleAdapter(db, { provider: "sqlite", schema, transaction: false }),
			emailAndPassword: { enabled: true },
			rateLimit: { enabled: false },
			telemetry: { enabled: false },
			logger: { disabled: true },
		});
		// Random ephemeral credentials are never logged, tracked, or returned; signup exists only in this isolated Worker.
		const password = crypto.randomUUID();
		const email = "compatibility@example.invalid";
		const created = await auth.api.signUpEmail({
			body: { name: "Fictional compatibility user", email, password },
		});
		const stored = await env.DB.prepare("SELECT password FROM smoke_account WHERE user_id = ?")
			.bind(created.user.id)
			.first<{ password: string }>();
		check(stored?.password && stored.password !== password, "Password must be stored as a hash");
		check(
			await verifyPassword({ hash: stored.password, password }),
			"Workers password verification failed",
		);
		check(
			!(await verifyPassword({ hash: stored.password, password: "incorrect-password" })),
			"Wrong password accepted",
		);
		const signedIn = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
		check(signedIn.ok, "Workers sign-in failed");
		const cookie = signedIn.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
		check(cookie.includes("session_token="), "Session cookie missing");
		const headers = new Headers({ cookie });
		const freshAuth = betterAuth({ ...auth.options });
		const loaded = await freshAuth.api.getSession({ headers });
		check(
			loaded?.user.id === created.user.id,
			"Independent instance could not look up persisted session",
		);
		check(
			await env.DB.prepare("SELECT id FROM smoke_session WHERE token = ?")
				.bind(loaded.session.token)
				.first(),
			"Session was not persisted in D1",
		);
		let denied = false;
		try {
			await freshAuth.api.signInEmail({ body: { email, password: "incorrect-password" } });
		} catch {
			denied = true;
		}
		check(denied, "Invalid login must be denied");
		check(
			(await freshAuth.api.getSession({ headers: new Headers() })) === null,
			"Unauthenticated lookup must be empty",
		);
		await freshAuth.api.signOut({ headers });
		check(
			(await freshAuth.api.getSession({ headers })) === null,
			"Signed-out session remained usable",
		);
		check(transactionCalls === 0, "Interactive transactions were called");
		return Response.json({
			passwordHash: true,
			persistedSession: true,
			independentLookup: true,
			invalidLoginDenied: true,
			logoutRevoked: true,
			transactionCalls,
		});
	},
};
