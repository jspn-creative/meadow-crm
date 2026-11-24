CREATE TABLE `activity` (
	`id` text PRIMARY KEY,
	`client_id` text,
	`opportunity_id` text,
	`kind` text NOT NULL,
	`channel` text,
	`channel_label` text,
	`direction` text,
	`outcome` text,
	`occurred_at` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL,
	`actor_user_id` text NOT NULL,
	`effective_user_id` text NOT NULL,
	`client_is_actor` integer DEFAULT false NOT NULL,
	`imported` integer DEFAULT false NOT NULL,
	`automated` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`fictional` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_activity_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_activity_opportunity_id_opportunities_id_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE CASCADE,
	CONSTRAINT "activity_kind" CHECK("kind" IN ('note', 'contact')),
	CONSTRAINT "activity_owner" CHECK(CASE WHEN "kind" = 'note' THEN ("client_id" IS NULL) <> ("opportunity_id" IS NULL) ELSE "opportunity_id" IS NULL END),
	CONSTRAINT "activity_contact_fields" CHECK(CASE WHEN "kind" = 'note' THEN "channel" IS NULL AND "channel_label" IS NULL AND "direction" IS NULL AND "outcome" IS NULL AND length(trim("body")) > 0 AND "client_is_actor" = 0
				ELSE "channel" IS NOT NULL AND ("channel" IN ('call', 'text', 'email', 'meeting', 'other') OR ("channel" = 'zillow' AND "imported" = 1))
				AND "direction" IS NOT NULL AND "direction" IN ('outgoing', 'incoming')
				AND ("client_is_actor" = 0 OR "direction" = 'incoming')
				AND CASE WHEN "channel" = 'other' THEN "channel_label" IS NOT NULL AND length(trim("channel_label")) BETWEEN 1 AND 40 ELSE "channel_label" IS NULL END END),
	CONSTRAINT "activity_outcome" CHECK(CASE "channel"
				WHEN 'call' THEN "outcome" IS NOT NULL AND "outcome" IN ('talked', 'voicemail', 'no-answer', 'wrong-number')
				WHEN 'meeting' THEN "outcome" IS NOT NULL AND "outcome" IN ('met', 'no-show')
				WHEN 'text' THEN "outcome" IS NULL OR "outcome" = 'bounced'
				WHEN 'email' THEN "outcome" IS NULL OR "outcome" = 'bounced'
				ELSE "outcome" IS NULL END),
	CONSTRAINT "activity_detail_json" CHECK(json_valid("detail") AND json_type("detail") = 'object'),
	CONSTRAINT "activity_identity" CHECK(length("actor_user_id") > 0 AND length("effective_user_id") > 0),
	CONSTRAINT "activity_flags" CHECK("client_is_actor" IN (0, 1) AND "imported" IN (0, 1) AND "automated" IN (0, 1) AND "fictional" IN (0, 1)),
	CONSTRAINT "activity_revision_positive" CHECK("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE `activity_opportunities` (
	`activity_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	CONSTRAINT `activity_opportunities_pk` PRIMARY KEY(`activity_id`, `opportunity_id`),
	CONSTRAINT `fk_activity_opportunities_activity_id_activity_id_fk` FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_activity_opportunities_opportunity_id_opportunities_id_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `activity_client_time` ON `activity` (`client_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `activity_opportunity_time` ON `activity` (`opportunity_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `activity_opportunities_opportunity` ON `activity_opportunities` (`opportunity_id`,`activity_id`);