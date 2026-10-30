-- Rebuild the three auth tables together so widening the user-ID constraint preserves credential accounts and sessions without disabling foreign keys or triggering cascades.
CREATE TABLE auth_user_next (id TEXT PRIMARY KEY NOT NULL CHECK (id IN ('business-realtor', 'business-assistant', 'support-admin')), name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, email_verified INTEGER NOT NULL, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, role TEXT NOT NULL DEFAULT 'user', banned INTEGER DEFAULT 0, ban_reason TEXT, ban_expires INTEGER, CHECK ((id = 'support-admin' AND role = 'admin') OR (id <> 'support-admin' AND role = 'user')));
--> statement-breakpoint
INSERT INTO auth_user_next (id, name, email, email_verified, image, created_at, updated_at) SELECT id, name, email, email_verified, image, created_at, updated_at FROM auth_user;
--> statement-breakpoint
CREATE TABLE auth_account_next (id TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL, provider_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES auth_user_next(id) ON DELETE CASCADE, access_token TEXT, refresh_token TEXT, id_token TEXT, access_token_expires_at INTEGER, refresh_token_expires_at INTEGER, scope TEXT, password TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(provider_id, account_id));
--> statement-breakpoint
INSERT INTO auth_account_next SELECT * FROM auth_account;
--> statement-breakpoint
CREATE TABLE auth_session_next (id TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, user_id TEXT NOT NULL REFERENCES auth_user_next(id) ON DELETE CASCADE, ip_address TEXT, user_agent TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, impersonated_by TEXT CHECK (impersonated_by IS NULL OR impersonated_by = 'support-admin'));
--> statement-breakpoint
INSERT INTO auth_session_next (id, token, expires_at, user_id, ip_address, user_agent, created_at, updated_at) SELECT id, token, expires_at, user_id, ip_address, user_agent, created_at, updated_at FROM auth_session;
--> statement-breakpoint
DROP TABLE auth_session;
--> statement-breakpoint
DROP TABLE auth_account;
--> statement-breakpoint
DROP TABLE auth_user;
--> statement-breakpoint
ALTER TABLE auth_user_next RENAME TO auth_user;
--> statement-breakpoint
ALTER TABLE auth_account_next RENAME TO auth_account;
--> statement-breakpoint
ALTER TABLE auth_session_next RENAME TO auth_session;
--> statement-breakpoint
CREATE INDEX auth_account_user ON auth_account(user_id);
--> statement-breakpoint
CREATE INDEX auth_session_user ON auth_session(user_id);
--> statement-breakpoint
CREATE TABLE auth_support_impersonation (support_session_id TEXT PRIMARY KEY NOT NULL REFERENCES auth_session(id) ON DELETE CASCADE, impersonation_session_id TEXT NOT NULL UNIQUE REFERENCES auth_session(id) ON DELETE CASCADE);
