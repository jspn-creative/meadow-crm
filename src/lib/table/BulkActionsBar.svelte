<!-- Adapted from SV Table's Bulk Actions Bar (https://sv-table.vercel.app/components/bulk-actions-bar): a floating Meadow surface rather than shadcn's bordered card; the view places it and supplies the actions. -->
<script lang="ts">
	import { X } from "@lucide/svelte";
	import type { Snippet } from "svelte";

	type Props = {
		/** What is selected, such as "12 clients selected". */
		summary: Snippet;
		children: Snippet;
		onClear: () => void;
		label?: string;
		class?: string;
	};

	let { summary, children, onClear, label = "Bulk actions", class: className }: Props = $props();
</script>

<div role="region" aria-label={label} class={["surface surface-floating pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl p-1.5 pl-4 text-sm", className]}>
	<div role="status" aria-live="polite" class="flex flex-wrap items-center gap-2 pr-2">{@render summary()}</div>
	<span class="bg-hairline h-5 w-px shrink-0" aria-hidden="true"></span>
	<div class="flex min-w-0 items-center gap-1">{@render children()}</div>
	<button type="button" class="control shrink-0" data-variant="ghost" data-size="sm" data-icon aria-label="Clear selection" title="Clear selection" onclick={onClear}><X size={16} aria-hidden="true" /></button>
</div>
