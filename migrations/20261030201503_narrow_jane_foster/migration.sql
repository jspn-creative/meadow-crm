CREATE TABLE `business_settings` (
	`id` integer PRIMARY KEY DEFAULT 1,
	`name` text NOT NULL,
	`timezone` text NOT NULL,
	`date_format` text DEFAULT 'MMM d, yyyy' NOT NULL,
	`tasks_enabled` integer DEFAULT true NOT NULL,
	`attention_scope` text DEFAULT 'all-visited' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "settings_singleton" CHECK("id" = 1),
	CONSTRAINT "settings_date_format" CHECK("date_format" IN ('M/d/yyyy', 'MMM d, yyyy')),
	CONSTRAINT "settings_attention_scope" CHECK("attention_scope" IN ('all-visited', 'current-stage')),
	CONSTRAINT "settings_tasks_boolean" CHECK("tasks_enabled" IN (0, 1)),
	CONSTRAINT "settings_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `checklist_items` (
	`id` text PRIMARY KEY,
	`template_id` text,
	`checklist_id` text,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_checklist_items_template_id_checklist_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `checklist_templates`(`id`),
	CONSTRAINT `fk_checklist_items_checklist_id_stage_checklists_id_fk` FOREIGN KEY (`checklist_id`) REFERENCES `stage_checklists`(`id`),
	CONSTRAINT "item_owner" CHECK(("template_id" IS NOT NULL AND "checklist_id" IS NULL) OR ("template_id" IS NULL AND "checklist_id" IS NOT NULL)),
	CONSTRAINT "item_title_required" CHECK(length(trim("title")) > 0),
	CONSTRAINT "item_position" CHECK(typeof("position") = 'integer' AND "position" >= 0),
	CONSTRAINT "item_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `checklist_progress` (
	`checklist_id` text NOT NULL,
	`item_id` text NOT NULL,
	`completed_at` text,
	`due_date` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `checklist_progress_pk` PRIMARY KEY(`checklist_id`, `item_id`),
	CONSTRAINT `fk_checklist_progress_checklist_id_stage_checklists_id_fk` FOREIGN KEY (`checklist_id`) REFERENCES `stage_checklists`(`id`),
	CONSTRAINT `fk_checklist_progress_item_id_checklist_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `checklist_items`(`id`),
	CONSTRAINT "progress_date_shape" CHECK("due_date" IS NULL OR "due_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "progress_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `checklist_templates` (
	`id` text PRIMARY KEY,
	`type` text NOT NULL,
	`stage` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "template_type" CHECK("type" IN ('buyer', 'seller', 'estate-sale', 'construction')),
	CONSTRAINT "template_stage" CHECK("stage" IN ('new-lead', 'active-lead', 'under-contract', 'closed')),
	CONSTRAINT "template_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `client_addresses` (
	`id` text PRIMARY KEY,
	`client_id` text NOT NULL,
	`label` text NOT NULL,
	`address` text NOT NULL,
	`owned` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_client_addresses_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT "client_address_label_required" CHECK(length(trim("label")) > 0),
	CONSTRAINT "client_address_value_required" CHECK(length(trim("address")) > 0),
	CONSTRAINT "client_address_owned_boolean" CHECK("owned" IN (0, 1)),
	CONSTRAINT "client_address_position" CHECK(typeof("position") = 'integer' AND "position" >= 0),
	CONSTRAINT "client_address_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `client_key_dates` (
	`id` text PRIMARY KEY,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_client_key_dates_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT "client_key_date_name_required" CHECK(length(trim("name")) > 0),
	CONSTRAINT "client_key_date_shape" CHECK("date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "client_key_date_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `client_people` (
	`id` text PRIMARY KEY,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`birthday` text,
	`position` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_client_people_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT "client_person_name_required" CHECK(length(trim("name")) > 0),
	CONSTRAINT "client_person_birthday_shape" CHECK("birthday" IS NULL OR "birthday" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "client_person_position" CHECK(typeof("position") = 'integer' AND "position" >= 0),
	CONSTRAINT "client_person_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `client_relationships` (
	`id` text PRIMARY KEY,
	`client_id` text NOT NULL,
	`related_client_id` text NOT NULL,
	`label` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_client_relationships_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT `fk_client_relationships_related_client_id_clients_id_fk` FOREIGN KEY (`related_client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT "client_relationship_label_required" CHECK(length(trim("label")) > 0),
	CONSTRAINT "client_relationship_distinct" CHECK("client_id" <> "related_client_id"),
	CONSTRAINT "client_relationship_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `client_tags` (
	`client_id` text NOT NULL,
	`tag_id` text NOT NULL,
	CONSTRAINT `client_tags_pk` PRIMARY KEY(`client_id`, `tag_id`),
	CONSTRAINT `fk_client_tags_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT `fk_client_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`address` text,
	`lead_source` text,
	`notes` text DEFAULT '' NOT NULL,
	`imported_data` text DEFAULT '[]' NOT NULL,
	`preferences` text DEFAULT '' NOT NULL,
	`preferred_contact_method` text,
	`referred_by_client_id` text,
	`referred_by_name` text,
	`consent_call` integer DEFAULT true NOT NULL,
	`consent_text` integer DEFAULT true NOT NULL,
	`consent_email` integer DEFAULT true NOT NULL,
	`consent_mail` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`fictional` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_clients_referred_by_client_id_clients_id_fk` FOREIGN KEY (`referred_by_client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT "client_name_required" CHECK(length(trim("name")) > 0),
	CONSTRAINT "client_revision_positive" CHECK("revision" > 0),
	CONSTRAINT "client_preferred_contact_method" CHECK("preferred_contact_method" IS NULL OR "preferred_contact_method" IN ('call', 'text', 'email', 'mail')),
	CONSTRAINT "client_consent_call_boolean" CHECK("consent_call" IN (0, 1)),
	CONSTRAINT "client_consent_text_boolean" CHECK("consent_text" IN (0, 1)),
	CONSTRAINT "client_consent_email_boolean" CHECK("consent_email" IN (0, 1)),
	CONSTRAINT "client_consent_mail_boolean" CHECK("consent_mail" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY,
	`record_kind` text NOT NULL,
	`record_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`effective_user_id` text NOT NULL,
	`action` text NOT NULL,
	`data` text NOT NULL,
	`fictional` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "history_record_kind" CHECK("record_kind" IN ('client', 'opportunity', 'task', 'template', 'settings', 'tag')),
	CONSTRAINT "history_json" CHECK(json_valid("data")),
	CONSTRAINT "history_identity" CHECK(length("actor_user_id") > 0 AND length("effective_user_id") > 0)
);
--> statement-breakpoint
CREATE TABLE `mutation_guards` (
	`id` text PRIMARY KEY,
	`passed` integer NOT NULL,
	CONSTRAINT "mutation_guard_passed" CHECK("passed" = 1)
);
--> statement-breakpoint
CREATE TABLE `mutation_receipts` (
	`id` text PRIMARY KEY,
	`actor_user_id` text NOT NULL,
	`effective_user_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "receipt_result_json" CHECK(json_valid("result"))
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`stage` text NOT NULL,
	`timeline` text,
	`address` text,
	`budget_cents` integer,
	`notes` text DEFAULT '' NOT NULL,
	`archived_at` text,
	`pinned_at` text,
	`fictional` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "opportunity_title_required" CHECK(length(trim("title")) > 0),
	CONSTRAINT "opportunity_type" CHECK("type" IN ('buyer', 'seller', 'estate-sale', 'construction')),
	CONSTRAINT "opportunity_stage" CHECK("stage" IN ('new-lead', 'active-lead', 'under-contract', 'closed')),
	CONSTRAINT "opportunity_timeline" CHECK("timeline" IS NULL OR "timeline" IN ('1-3-mo', '3-6-mo', '6-plus-mo')),
	CONSTRAINT "opportunity_budget" CHECK("budget_cents" IS NULL OR (typeof("budget_cents") = 'integer' AND "budget_cents" >= 0)),
	CONSTRAINT "opportunity_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `opportunity_clients` (
	`opportunity_id` text NOT NULL,
	`client_id` text NOT NULL,
	CONSTRAINT `opportunity_clients_pk` PRIMARY KEY(`opportunity_id`, `client_id`),
	CONSTRAINT `fk_opportunity_clients_opportunity_id_opportunities_id_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`),
	CONSTRAINT `fk_opportunity_clients_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`)
);
--> statement-breakpoint
CREATE TABLE `person_emails` (
	`id` text PRIMARY KEY,
	`person_id` text NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_person_emails_person_id_client_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `client_people`(`id`),
	CONSTRAINT "person_email_label_required" CHECK(length(trim("label")) > 0),
	CONSTRAINT "person_email_value_required" CHECK(length(trim("value")) > 0),
	CONSTRAINT "person_email_position" CHECK(typeof("position") = 'integer' AND "position" >= 0),
	CONSTRAINT "person_email_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `person_phones` (
	`id` text PRIMARY KEY,
	`person_id` text NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_person_phones_person_id_client_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `client_people`(`id`),
	CONSTRAINT "person_phone_label_required" CHECK(length(trim("label")) > 0),
	CONSTRAINT "person_phone_value_required" CHECK(length(trim("value")) > 0),
	CONSTRAINT "person_phone_position" CHECK(typeof("position") = 'integer' AND "position" >= 0),
	CONSTRAINT "person_phone_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `record_references` (
	`id` text PRIMARY KEY,
	`opportunity_id` text,
	`client_id` text,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`url` text,
	`target_client_id` text,
	`target_opportunity_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_record_references_opportunity_id_opportunities_id_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`),
	CONSTRAINT `fk_record_references_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT `fk_record_references_target_client_id_clients_id_fk` FOREIGN KEY (`target_client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT `fk_record_references_target_opportunity_id_opportunities_id_fk` FOREIGN KEY (`target_opportunity_id`) REFERENCES `opportunities`(`id`),
	CONSTRAINT "reference_label_required" CHECK(length(trim("label")) > 0),
	CONSTRAINT "reference_owner" CHECK(("opportunity_id" IS NOT NULL AND "client_id" IS NULL) OR ("opportunity_id" IS NULL AND "client_id" IS NOT NULL)),
	CONSTRAINT "reference_kind" CHECK("kind" IN ('url', 'client', 'opportunity')),
	CONSTRAINT "reference_target" CHECK(("kind" = 'url' AND "url" IS NOT NULL AND ("url" LIKE 'https://%' OR "url" LIKE 'http://%') AND "target_client_id" IS NULL AND "target_opportunity_id" IS NULL) OR ("kind" = 'client' AND "target_client_id" IS NOT NULL AND "url" IS NULL AND "target_opportunity_id" IS NULL) OR ("kind" = 'opportunity' AND "target_opportunity_id" IS NOT NULL AND "url" IS NULL AND "target_client_id" IS NULL)),
	CONSTRAINT "reference_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `stage_checklists` (
	`id` text PRIMARY KEY,
	`opportunity_id` text NOT NULL,
	`stage` text NOT NULL,
	`template_id` text NOT NULL,
	`removed_template_items` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_stage_checklists_opportunity_id_opportunities_id_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`),
	CONSTRAINT `fk_stage_checklists_template_id_stage_checklist_templates_id_stage_fk` FOREIGN KEY (`template_id`,`stage`) REFERENCES `checklist_templates`(`id`,`stage`),
	CONSTRAINT "checklist_removed_items_json" CHECK(json_valid("removed_template_items")),
	CONSTRAINT "checklist_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`retired_at` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "tag_name_required" CHECK(length(trim("name")) > 0),
	CONSTRAINT "tag_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`assigned_user_id` text NOT NULL,
	`assigned_role` text DEFAULT 'realtor' NOT NULL,
	`client_id` text,
	`opportunity_id` text,
	`source_stage` text,
	`date` text NOT NULL,
	`due_date` text,
	`completed_at` text,
	`fictional` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_tasks_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT `fk_tasks_opportunity_id_opportunities_id_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`),
	CONSTRAINT "task_title_required" CHECK(length(trim("title")) > 0),
	CONSTRAINT "task_realtor_only" CHECK("assigned_role" = 'realtor'),
	CONSTRAINT "task_single_link" CHECK("client_id" IS NULL OR "opportunity_id" IS NULL),
	CONSTRAINT "task_source_stage" CHECK("source_stage" IS NULL OR ("opportunity_id" IS NOT NULL AND "source_stage" IN ('new-lead', 'active-lead', 'under-contract', 'closed'))),
	CONSTRAINT "task_date_shape" CHECK("due_date" IS NULL OR "due_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "task_revision_positive" CHECK("revision" > 0),
	CONSTRAINT "task_start_date_shape" CHECK("date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE TABLE `auth_account` (
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_auth_account_user_id_auth_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `auth_rate_limit` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL UNIQUE,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_session` (
	`id` text PRIMARY KEY,
	`token` text NOT NULL UNIQUE,
	`expires_at` integer NOT NULL,
	`user_id` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`impersonated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_auth_session_user_id_auth_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "auth_session_impersonated_by" CHECK("impersonated_by" IS NULL OR "impersonated_by" = 'support-admin')
);
--> statement-breakpoint
CREATE TABLE `auth_support_impersonation` (
	`support_session_id` text PRIMARY KEY,
	`impersonation_session_id` text NOT NULL UNIQUE,
	CONSTRAINT `fk_auth_support_impersonation_support_session_id_auth_session_id_fk` FOREIGN KEY (`support_session_id`) REFERENCES `auth_session`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_auth_support_impersonation_impersonation_session_id_auth_session_id_fk` FOREIGN KEY (`impersonation_session_id`) REFERENCES `auth_session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `auth_user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer NOT NULL,
	`image` text,
	`role` text DEFAULT 'user' NOT NULL,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "auth_user_id_allowed" CHECK("id" IN ('business-realtor', 'business-assistant', 'support-admin')),
	CONSTRAINT "auth_user_role_by_id" CHECK(("id" = 'support-admin' AND "role" = 'admin') OR ("id" <> 'support-admin' AND "role" = 'user'))
);
--> statement-breakpoint
CREATE TABLE `auth_verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_item_position` ON `checklist_items` (`template_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `custom_item_position` ON `checklist_items` (`checklist_id`,`position`);--> statement-breakpoint
CREATE INDEX `progress_attention` ON `checklist_progress` (`completed_at`,`due_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `template_type_stage` ON `checklist_templates` (`type`,`stage`);--> statement-breakpoint
CREATE UNIQUE INDEX `template_id_stage` ON `checklist_templates` (`id`,`stage`);--> statement-breakpoint
CREATE INDEX `client_addresses_client` ON `client_addresses` (`client_id`);--> statement-breakpoint
CREATE INDEX `client_key_dates_client` ON `client_key_dates` (`client_id`);--> statement-breakpoint
CREATE INDEX `client_people_client` ON `client_people` (`client_id`);--> statement-breakpoint
CREATE INDEX `client_relationships_client` ON `client_relationships` (`client_id`);--> statement-breakpoint
CREATE INDEX `client_relationships_related` ON `client_relationships` (`related_client_id`);--> statement-breakpoint
CREATE INDEX `client_tags_tag` ON `client_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `clients_archive_name` ON `clients` (`archived_at`,`name`);--> statement-breakpoint
CREATE INDEX `history_record` ON `history` (`record_kind`,`record_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `opportunities_board` ON `opportunities` (`archived_at`,`stage`,`timeline`);--> statement-breakpoint
CREATE INDEX `opportunity_clients_client` ON `opportunity_clients` (`client_id`);--> statement-breakpoint
CREATE INDEX `person_emails_person` ON `person_emails` (`person_id`);--> statement-breakpoint
CREATE INDEX `person_phones_person` ON `person_phones` (`person_id`);--> statement-breakpoint
CREATE INDEX `references_opportunity` ON `record_references` (`opportunity_id`);--> statement-breakpoint
CREATE INDEX `references_client` ON `record_references` (`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `checklist_opportunity_stage` ON `stage_checklists` (`opportunity_id`,`stage`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (lower("name"));--> statement-breakpoint
CREATE INDEX `tasks_attention` ON `tasks` (`completed_at`,`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_date` ON `tasks` (`completed_at`,`date`);--> statement-breakpoint
CREATE INDEX `tasks_client` ON `tasks` (`client_id`);--> statement-breakpoint
CREATE INDEX `tasks_opportunity` ON `tasks` (`opportunity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `auth_account_provider_account` ON `auth_account` (`provider_id`,`account_id`);