ALTER TABLE `clients` ADD `flagged` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `flag_note` text DEFAULT '' NOT NULL;