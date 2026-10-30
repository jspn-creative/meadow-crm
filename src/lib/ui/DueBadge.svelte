<script lang="ts">
	import { Calendar } from "@lucide/svelte";
	import type { DueState } from "./presentation.js";
	let { label, state, compact = false, done = false }: { label: string; state: DueState; compact?: boolean; done?: boolean } = $props();
	const tones = { overdue: "urgent", today: "pending", upcoming: "info", undated: "neutral" };
</script>

<!-- A done item's date no longer signals anything, so it drops the state's tone and icon for a muted neutral calendar. Compact leads with the icon and lets an ancestor collapse the date through --due-reveal; it shows in full by default. -->
<span data-due-state={done ? undefined : state} data-tone={done ? "neutral" : tones[state]} title={compact ? label : undefined} class={["chip shrink-0", compact && "gap-0 px-1.5", done && "text-muted"]}>
	{#if done}<Calendar size={12} aria-hidden="true" />{/if}
	{#if compact}
		<span class="max-w-(--due-reveal,8rem) overflow-hidden whitespace-nowrap transition-[max-width] duration-200 motion-reduce:transition-none"><span class="block pl-1">{label}</span></span>
	{:else}{label}{/if}
</span>
