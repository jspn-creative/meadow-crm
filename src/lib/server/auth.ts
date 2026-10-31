import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./auth-schema.js";
import type { BusinessIdentity } from "./identity.js";

export const loginFailure = "Unable to sign in. Check your email and password and try again.";
export const supportAdminId = "support-admin";
export const impersonationDuration = 60 * 60;

export function sessionIdentity(id: string | undefined): BusinessIdentity | null {
	if (id !== "business-realtor" && id !== "business-assistant") return null;
	return {
		actorUserId: id,
		effectiveUserId: id,
		role: id === "business-realtor" ? "realtor" : "assistant",
	};
}

export function createAuth(env: Cloudflare.Env, development: boolean) {
	if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32 || !env.BETTER_AUTH_URL)
		return null;
	let origin: string;
	try {
		origin = new URL(env.BETTER_AUTH_URL).origin;
	} catch {
		return null;
	}
	if (!development && !origin.startsWith("https://")) return null;
	return betterAuth({
		plugins: [
			admin({ adminUserIds: [supportAdminId], impersonationSessionDuration: impersonationDuration }),
		],
		baseURL: origin,
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [origin],
		database: drizzleAdapter(drizzle(env.DB), {
			provider: "sqlite",
			schema,
			transaction: false,
		}),
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
			minPasswordLength: 12,
			maxPasswordLength: 128,
		},
		session: { cookieCache: { enabled: false } },
		rateLimit: {
			enabled: true,
			storage: "database",
			customRules: {
				"/sign-in/email": { window: 60, max: 5 },
				"/change-password": { window: 60, max: 5 },
			},
		},
		advanced: {
			useSecureCookies: !development || origin.startsWith("https://"),
			defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
			ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
		},
		telemetry: { enabled: false },
		logger: { disabled: true },
	});
}
