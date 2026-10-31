import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Baseline generated with auth@1.7.7 generate --adapter drizzle --dialect sqlite --config scripts/auth-schema-config.ts. Keep Meadow's auth_ table names, identity checks, credential uniqueness, and support-session binding; legacy relations() output is not used with Drizzle Relations v2.
const timestampDefault = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;
const dates = () => ({
	createdAt: integer("created_at", { mode: "timestamp_ms" }).default(timestampDefault).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.$onUpdate(() => new Date())
		.notNull(),
});
export const user = sqliteTable(
	"auth_user",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email").notNull().unique(),
		emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
		image: text("image"),
		role: text("role").notNull().default("user"),
		banned: integer("banned", { mode: "boolean" }).default(false),
		banReason: text("ban_reason"),
		banExpires: integer("ban_expires", { mode: "timestamp_ms" }),
		...dates(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(timestampDefault)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		check(
			"auth_user_id_allowed",
			sql`${t.id} IN ('business-realtor', 'business-assistant', 'support-admin')`,
		),
		check(
			"auth_user_role_by_id",
			sql`(${t.id} = 'support-admin' AND ${t.role} = 'admin') OR (${t.id} <> 'support-admin' AND ${t.role} = 'user')`,
		),
	],
);
export const session = sqliteTable(
	"auth_session",
	{
		id: text("id").primaryKey(),
		token: text("token").notNull().unique(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		impersonatedBy: text("impersonated_by"),
		...dates(),
	},
	(t) => [
		index("auth_session_user_id").on(t.userId),
		check(
			"auth_session_impersonated_by",
			sql`${t.impersonatedBy} IS NULL OR ${t.impersonatedBy} = 'support-admin'`,
		),
	],
);
export const account = sqliteTable(
	"auth_account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
		scope: text("scope"),
		password: text("password"),
		...dates(),
	},
	(t) => [
		index("auth_account_user_id").on(t.userId),
		uniqueIndex("auth_account_provider_account").on(t.providerId, t.accountId),
	],
);
export const verification = sqliteTable(
	"auth_verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		...dates(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(timestampDefault)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [index("auth_verification_identifier").on(t.identifier)],
);
export const rateLimit = sqliteTable("auth_rate_limit", {
	id: text("id").primaryKey(),
	key: text("key").notNull().unique(),
	count: integer("count").notNull(),
	lastRequest: integer("last_request").notNull(),
});
export const supportImpersonation = sqliteTable("auth_support_impersonation", {
	supportSessionId: text("support_session_id")
		.primaryKey()
		.references(() => session.id, { onDelete: "cascade" }),
	impersonationSessionId: text("impersonation_session_id")
		.notNull()
		.unique()
		.references(() => session.id, { onDelete: "cascade" }),
});
