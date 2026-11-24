<script lang="ts">
	import type { Snippet } from "svelte";
	import { ListTree, MessagesSquare } from "@lucide/svelte";
	import ActivityFeed from "./ActivityFeed.svelte";
	import type { ActivityEntry, ActivityOpportunity } from "./types.js";

	let {
		id,
		entries,
		client,
		opportunities = [],
		timeZone,
		meadowSince,
		readonly = false,
		conversation = true,
		opportunityHref,
		onedit,
		ondelete,
		empty,
		children,
	}: {
		/** Prefix for the section's element IDs, unique within the page. */
		id: string;
		entries: ActivityEntry[];
		/** The name the client goes by in sentences. */
		client: string;
		/** The client's opportunities, so a client's Conversation can name what each thread is about. An opportunity's own Activity passes none. */
		opportunities?: ActivityOpportunity[];
		timeZone: string;
		meadowSince?: string;
		readonly?: boolean;
		/** Offer Conversation beside Everything. Saved Activity is History alone until notes and logged contact are stored, so it has no conversation to narrow to. */
		conversation?: boolean;
		opportunityHref?: (id: string) => string | undefined;
		onedit?: (id: string, text: string) => void;
		ondelete?: (id: string) => void;
		/** Shown in place of the feed while there are no entries. */
		empty: Snippet;
		/** Anything that follows the feed, such as a note about what is not stored yet. */
		children?: Snippet;
	} = $props();

	// Conversation keeps notes and logged contact; Everything adds History and imported events. The choice is a view option, kept in this browser for every record.
	const viewKey = "meadow:activity-view";
	let view = $state<"chat" | "timeline">(storedView());
	function storedView() {
		try {
			return localStorage.getItem(viewKey) === "timeline" ? "timeline" : "chat";
		} catch {
			return "chat";
		}
	}
	function setView(next: typeof view) {
		view = next;
		try {
			localStorage.setItem(viewKey, next);
		} catch {
			// Unavailable storage only loses the preference.
		}
	}

	let feed = $state<ReturnType<typeof ActivityFeed>>();
	/** Scroll an entry into view and mark it briefly. */
	export function reveal(entryId: string) {
		return feed?.reveal(entryId);
	}
</script>

<section id={`${id}-activity`} class="border-hairline min-w-0 border-t px-(--gutter) pt-5 pb-6" aria-labelledby={`${id}-activity-heading`} data-section="Activity">
	<div class="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
		<h3 id={`${id}-activity-heading`} class="font-display text-lg leading-none">Activity</h3>
		{#if conversation && entries.length}
			<div class="segmented *:min-h-7 *:px-2.5 *:text-xs pointer-coarse:*:min-h-11" role="group" aria-label="Activity shows">
				<button type="button" aria-pressed={view === "chat"} onclick={() => setView("chat")}><MessagesSquare size={13} aria-hidden="true" />Conversation</button>
				<button type="button" aria-pressed={view === "timeline"} onclick={() => setView("timeline")}><ListTree size={13} aria-hidden="true" />Everything</button>
			</div>
		{/if}
	</div>
	{#if entries.length}
		<ActivityFeed bind:this={feed} {entries} {client} {opportunities} {timeZone} {meadowSince} {readonly} appearance={conversation ? view : "timeline"} recent={12} {opportunityHref} {onedit} {ondelete} />
	{:else}
		{@render empty()}
	{/if}
	{@render children?.()}
</section>
