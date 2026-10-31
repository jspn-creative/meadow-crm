PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_auth_account` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_auth_account_user_id_auth_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_auth_account`(`id`, `account_id`, `provider_id`, `user_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at`) SELECT `id`, `account_id`, `provider_id`, `user_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at` FROM `auth_account`;--> statement-breakpoint
DROP TABLE `auth_account`;--> statement-breakpoint
ALTER TABLE `__new_auth_account` RENAME TO `auth_account`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_auth_session` (
	`id` text PRIMARY KEY,
	`token` text NOT NULL UNIQUE,
	`expires_at` integer NOT NULL,
	`user_id` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`impersonated_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_auth_session_user_id_auth_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "auth_session_impersonated_by" CHECK("impersonated_by" IS NULL OR "impersonated_by" = 'support-admin')
);
--> statement-breakpoint
INSERT INTO `__new_auth_session`(`id`, `token`, `expires_at`, `user_id`, `ip_address`, `user_agent`, `impersonated_by`, `created_at`, `updated_at`) SELECT `id`, `token`, `expires_at`, `user_id`, `ip_address`, `user_agent`, `impersonated_by`, `created_at`, `updated_at` FROM `auth_session`;--> statement-breakpoint
DROP TABLE `auth_session`;--> statement-breakpoint
ALTER TABLE `__new_auth_session` RENAME TO `auth_session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_auth_user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'user' NOT NULL,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "auth_user_id_allowed" CHECK("id" IN ('business-realtor', 'business-assistant', 'support-admin')),
	CONSTRAINT "auth_user_role_by_id" CHECK(("id" = 'support-admin' AND "role" = 'admin') OR ("id" <> 'support-admin' AND "role" = 'user'))
);
--> statement-breakpoint
INSERT INTO `__new_auth_user`(`id`, `name`, `email`, `email_verified`, `image`, `role`, `banned`, `ban_reason`, `ban_expires`, `created_at`, `updated_at`) SELECT `id`, `name`, `email`, `email_verified`, `image`, `role`, `banned`, `ban_reason`, `ban_expires`, `created_at`, `updated_at` FROM `auth_user`;--> statement-breakpoint
DROP TABLE `auth_user`;--> statement-breakpoint
ALTER TABLE `__new_auth_user` RENAME TO `auth_user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_auth_verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_auth_verification`(`id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at`) SELECT `id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at` FROM `auth_verification`;--> statement-breakpoint
DROP TABLE `auth_verification`;--> statement-breakpoint
ALTER TABLE `__new_auth_verification` RENAME TO `auth_verification`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `auth_account_user_id` ON `auth_account` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `auth_account_provider_account` ON `auth_account` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `auth_session_user_id` ON `auth_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_verification_identifier` ON `auth_verification` (`identifier`);