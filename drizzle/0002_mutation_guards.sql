CREATE TABLE `mutation_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`passed` integer NOT NULL,
	CONSTRAINT "mutation_guard_passed" CHECK("mutation_guards"."passed" = 1)
);
