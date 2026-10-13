import type { Component } from "svelte";
import type { LucideProps } from "@lucide/svelte";
import type { AccentTone, DueState } from "#lib/ui/presentation.js";

/** Presentation data for task rows, independent of their page or dashboard container. */
export interface TaskListItem {
	id: string;
	title: string;
	context?: string;
	due: string;
	dueState: DueState;
	icon?: Component<LucideProps>;
	tone?: AccentTone;
	note?: string;
}
