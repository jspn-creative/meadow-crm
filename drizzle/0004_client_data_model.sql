-- Client data model: people, addresses, relationships, key dates, preferences, consent and Referred by.
ALTER TABLE `clients` ADD `preferences` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `clients` ADD `preferred_contact_method` text CONSTRAINT "client_preferred_contact_method" CHECK ("clients"."preferred_contact_method" IS NULL OR "clients"."preferred_contact_method" IN ('call', 'text', 'email', 'mail'));
--> statement-breakpoint
ALTER TABLE `clients` ADD `referred_by_client_id` text REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action;
--> statement-breakpoint
ALTER TABLE `clients` ADD `referred_by_name` text;
--> statement-breakpoint
ALTER TABLE `clients` ADD `consent_call` integer DEFAULT true NOT NULL CONSTRAINT "client_consent_call_boolean" CHECK ("clients"."consent_call" IN (0, 1));
--> statement-breakpoint
ALTER TABLE `clients` ADD `consent_text` integer DEFAULT true NOT NULL CONSTRAINT "client_consent_text_boolean" CHECK ("clients"."consent_text" IN (0, 1));
--> statement-breakpoint
ALTER TABLE `clients` ADD `consent_email` integer DEFAULT true NOT NULL CONSTRAINT "client_consent_email_boolean" CHECK ("clients"."consent_email" IN (0, 1));
--> statement-breakpoint
ALTER TABLE `clients` ADD `consent_mail` integer DEFAULT true NOT NULL CONSTRAINT "client_consent_mail_boolean" CHECK ("clients"."consent_mail" IN (0, 1));
--> statement-breakpoint
CREATE TABLE `client_people` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`birthday` text,
	`position` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "client_person_name_required" CHECK(length(trim("client_people"."name")) > 0),
	CONSTRAINT "client_person_birthday_shape" CHECK("client_people"."birthday" IS NULL OR "client_people"."birthday" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "client_person_position" CHECK(typeof("client_people"."position") = 'integer' AND "client_people"."position" >= 0),
	CONSTRAINT "client_person_revision_positive" CHECK("client_people"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `client_people_client` ON `client_people` (`client_id`);
--> statement-breakpoint
CREATE TABLE `person_phones` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `client_people`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "person_phone_label_required" CHECK(length(trim("person_phones"."label")) > 0),
	CONSTRAINT "person_phone_value_required" CHECK(length(trim("person_phones"."value")) > 0),
	CONSTRAINT "person_phone_position" CHECK(typeof("person_phones"."position") = 'integer' AND "person_phones"."position" >= 0),
	CONSTRAINT "person_phone_revision_positive" CHECK("person_phones"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `person_phones_person` ON `person_phones` (`person_id`);
--> statement-breakpoint
CREATE TABLE `person_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `client_people`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "person_email_label_required" CHECK(length(trim("person_emails"."label")) > 0),
	CONSTRAINT "person_email_value_required" CHECK(length(trim("person_emails"."value")) > 0),
	CONSTRAINT "person_email_position" CHECK(typeof("person_emails"."position") = 'integer' AND "person_emails"."position" >= 0),
	CONSTRAINT "person_email_revision_positive" CHECK("person_emails"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `person_emails_person` ON `person_emails` (`person_id`);
--> statement-breakpoint
CREATE TABLE `client_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`label` text NOT NULL,
	`address` text NOT NULL,
	`owned` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "client_address_label_required" CHECK(length(trim("client_addresses"."label")) > 0),
	CONSTRAINT "client_address_value_required" CHECK(length(trim("client_addresses"."address")) > 0),
	CONSTRAINT "client_address_owned_boolean" CHECK("client_addresses"."owned" IN (0, 1)),
	CONSTRAINT "client_address_position" CHECK(typeof("client_addresses"."position") = 'integer' AND "client_addresses"."position" >= 0),
	CONSTRAINT "client_address_revision_positive" CHECK("client_addresses"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `client_addresses_client` ON `client_addresses` (`client_id`);
--> statement-breakpoint
CREATE TABLE `client_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`related_client_id` text NOT NULL,
	`label` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "client_relationship_label_required" CHECK(length(trim("client_relationships"."label")) > 0),
	CONSTRAINT "client_relationship_distinct" CHECK("client_relationships"."client_id" <> "client_relationships"."related_client_id"),
	CONSTRAINT "client_relationship_revision_positive" CHECK("client_relationships"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `client_relationships_client` ON `client_relationships` (`client_id`);
--> statement-breakpoint
CREATE INDEX `client_relationships_related` ON `client_relationships` (`related_client_id`);
--> statement-breakpoint
CREATE TABLE `client_key_dates` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "client_key_date_name_required" CHECK(length(trim("client_key_dates"."name")) > 0),
	CONSTRAINT "client_key_date_shape" CHECK("client_key_dates"."date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "client_key_date_revision_positive" CHECK("client_key_dates"."revision" > 0)
);
--> statement-breakpoint
CREATE INDEX `client_key_dates_client` ON `client_key_dates` (`client_id`);
