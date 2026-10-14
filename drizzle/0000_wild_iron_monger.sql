CREATE TABLE `business_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`timezone` text NOT NULL,
	`date_format` text DEFAULT 'MMM d, yyyy' NOT NULL,
	`tasks_enabled` integer DEFAULT true NOT NULL,
	`attention_scope` text DEFAULT 'all-visited' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "settings_singleton" CHECK("business_settings"."id" = 1),
	CONSTRAINT "settings_date_format" CHECK("business_settings"."date_format" IN ('M/d/yyyy', 'MMM d, yyyy')),
	CONSTRAINT "settings_attention_scope" CHECK("business_settings"."attention_scope" IN ('all-visited', 'current-stage')),
	CONSTRAINT "settings_tasks_boolean" CHECK("business_settings"."tasks_enabled" IN (0, 1)),
	CONSTRAINT "settings_revision_positive" CHECK("business_settings"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text,
	`checklist_id` text,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `checklist_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`checklist_id`) REFERENCES `stage_checklists`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_owner" CHECK(("checklist_items"."template_id" IS NOT NULL AND "checklist_items"."checklist_id" IS NULL) OR ("checklist_items"."template_id" IS NULL AND "checklist_items"."checklist_id" IS NOT NULL)),
	CONSTRAINT "item_title_required" CHECK(length(trim("checklist_items"."title")) > 0),
	CONSTRAINT "item_position" CHECK(typeof("checklist_items"."position") = 'integer' AND "checklist_items"."position" >= 0),
	CONSTRAINT "item_revision_positive" CHECK("checklist_items"."revision" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_item_position` ON `checklist_items` (`template_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `custom_item_position` ON `checklist_items` (`checklist_id`,`position`);--> statement-breakpoint
CREATE TABLE `checklist_progress` (
	`checklist_id` text NOT NULL,
	`item_id` text NOT NULL,
	`completed_at` text,
	`due_date` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`checklist_id`, `item_id`),
	FOREIGN KEY (`checklist_id`) REFERENCES `stage_checklists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `checklist_items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "progress_date_shape" CHECK("checklist_progress"."due_date" IS NULL OR "checklist_progress"."due_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "progress_revision_positive" CHECK("checklist_progress"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `progress_attention` ON `checklist_progress` (`completed_at`,`due_date`);--> statement-breakpoint
CREATE TABLE `checklist_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`stage` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "template_type" CHECK("checklist_templates"."type" IN ('buyer', 'seller', 'estate-sale', 'construction')),
	CONSTRAINT "template_stage" CHECK("checklist_templates"."stage" IN ('new-lead', 'active-lead', 'under-contract', 'closed')),
	CONSTRAINT "template_revision_positive" CHECK("checklist_templates"."revision" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_type_stage` ON `checklist_templates` (`type`,`stage`);--> statement-breakpoint
CREATE UNIQUE INDEX `template_id_stage` ON `checklist_templates` (`id`,`stage`);--> statement-breakpoint
CREATE TABLE `client_tags` (
	`client_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`client_id`, `tag_id`),
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `client_tags_tag` ON `client_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`address` text,
	`lead_source` text,
	`notes` text DEFAULT '' NOT NULL,
	`archived_at` text,
	`fictional` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "client_name_required" CHECK(length(trim("clients"."name")) > 0),
	CONSTRAINT "client_revision_positive" CHECK("clients"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `clients_archive_name` ON `clients` (`archived_at`,`name`);--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`record_kind` text NOT NULL,
	`record_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`effective_user_id` text NOT NULL,
	`action` text NOT NULL,
	`data` text NOT NULL,
	`fictional` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "history_record_kind" CHECK("history"."record_kind" IN ('client', 'opportunity', 'task', 'template', 'settings', 'tag')),
	CONSTRAINT "history_json" CHECK(json_valid("history"."data")),
	CONSTRAINT "history_identity" CHECK(length("history"."actor_user_id") > 0 AND length("history"."effective_user_id") > 0)
);
--> statement-breakpoint
CREATE INDEX `history_record` ON `history` (`record_kind`,`record_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `mutation_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`effective_user_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "receipt_result_json" CHECK(json_valid("mutation_receipts"."result"))
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`stage` text NOT NULL,
	`timeline` text,
	`address` text,
	`budget_cents` integer,
	`notes` text DEFAULT '' NOT NULL,
	`archived_at` text,
	`fictional` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "opportunity_title_required" CHECK(length(trim("opportunities"."title")) > 0),
	CONSTRAINT "opportunity_type" CHECK("opportunities"."type" IN ('buyer', 'seller', 'estate-sale', 'construction')),
	CONSTRAINT "opportunity_stage" CHECK("opportunities"."stage" IN ('new-lead', 'active-lead', 'under-contract', 'closed')),
	CONSTRAINT "opportunity_timeline" CHECK("opportunities"."timeline" IS NULL OR "opportunities"."timeline" IN ('1-3-mo', '3-6-mo', '6-plus-mo')),
	CONSTRAINT "opportunity_budget" CHECK("opportunities"."budget_cents" IS NULL OR (typeof("opportunities"."budget_cents") = 'integer' AND "opportunities"."budget_cents" >= 0)),
	CONSTRAINT "opportunity_revision_positive" CHECK("opportunities"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `opportunities_board` ON `opportunities` (`archived_at`,`stage`,`timeline`);--> statement-breakpoint
CREATE TABLE `opportunity_clients` (
	`opportunity_id` text NOT NULL,
	`client_id` text NOT NULL,
	PRIMARY KEY(`opportunity_id`, `client_id`),
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `opportunity_clients_client` ON `opportunity_clients` (`client_id`);--> statement-breakpoint
CREATE TABLE `record_references` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`url` text,
	`target_client_id` text,
	`target_opportunity_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reference_label_required" CHECK(length(trim("record_references"."label")) > 0),
	CONSTRAINT "reference_target" CHECK(("record_references"."kind" = 'url' AND "record_references"."url" IS NOT NULL AND ("record_references"."url" LIKE 'https://%' OR "record_references"."url" LIKE 'http://%') AND "record_references"."target_client_id" IS NULL AND "record_references"."target_opportunity_id" IS NULL) OR ("record_references"."kind" = 'client' AND "record_references"."target_client_id" IS NOT NULL AND "record_references"."url" IS NULL AND "record_references"."target_opportunity_id" IS NULL) OR ("record_references"."kind" = 'opportunity' AND "record_references"."target_opportunity_id" IS NOT NULL AND "record_references"."url" IS NULL AND "record_references"."target_client_id" IS NULL)),
	CONSTRAINT "reference_revision_positive" CHECK("record_references"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `references_opportunity` ON `record_references` (`opportunity_id`);--> statement-breakpoint
CREATE TABLE `stage_checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_id` text NOT NULL,
	`stage` text NOT NULL,
	`template_id` text NOT NULL,
	`customized` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`,`stage`) REFERENCES `checklist_templates`(`id`,`stage`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "checklist_customized_boolean" CHECK("stage_checklists"."customized" IN (0, 1)),
	CONSTRAINT "checklist_revision_positive" CHECK("stage_checklists"."revision" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checklist_opportunity_stage` ON `stage_checklists` (`opportunity_id`,`stage`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`retired_at` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "tag_name_required" CHECK(length(trim("tags"."name")) > 0),
	CONSTRAINT "tag_revision_positive" CHECK("tags"."revision" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (lower("name"));--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`assigned_user_id` text NOT NULL,
	`assigned_role` text DEFAULT 'realtor' NOT NULL,
	`client_id` text,
	`opportunity_id` text,
	`source_stage` text,
	`due_date` text,
	`completed_at` text,
	`fictional` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "task_title_required" CHECK(length(trim("tasks"."title")) > 0),
	CONSTRAINT "task_realtor_only" CHECK("tasks"."assigned_role" = 'realtor'),
	CONSTRAINT "task_single_link" CHECK("tasks"."client_id" IS NULL OR "tasks"."opportunity_id" IS NULL),
	CONSTRAINT "task_source_stage" CHECK("tasks"."source_stage" IS NULL OR ("tasks"."opportunity_id" IS NOT NULL AND "tasks"."source_stage" IN ('new-lead', 'active-lead', 'under-contract', 'closed'))),
	CONSTRAINT "task_date_shape" CHECK("tasks"."due_date" IS NULL OR "tasks"."due_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "task_revision_positive" CHECK("tasks"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `tasks_attention` ON `tasks` (`completed_at`,`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_client` ON `tasks` (`client_id`);--> statement-breakpoint
CREATE INDEX `tasks_opportunity` ON `tasks` (`opportunity_id`);