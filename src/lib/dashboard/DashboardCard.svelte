<script lang="ts">
	import type { Snippet } from "svelte";
	import { ArrowUpRight } from "@lucide/svelte";
	let { title, headingId, description, descriptionInline = false, action, order = 0, children }: { title: string; headingId: string; description?: string; descriptionInline?: boolean; action?: { href: string; label: string }; order?: number; children: Snippet } = $props();
</script>

<section data-widget class="border-hairline @container/card min-w-0 rounded-2xl border bg-white" aria-labelledby={headingId} style:--widget-order={order}>
	<header class="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-(--card-pad) py-(--card-head-py)">
		<div class="min-w-0">
			<h2 id={headingId} class="font-display text-xl leading-7 tracking-tight">{title}</h2>
			{#if description && !descriptionInline}<p class="text-muted mt-1 text-xs leading-5">{description}</p>{/if}
		</div>
		{#if description && descriptionInline}<p class="text-muted shrink-0 text-xs leading-5">{description}</p>{/if}
		{#if action}
			<a href={action.href} class="text-field hover:text-field-deep inline-flex min-h-8 shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap underline-offset-4 transition-colors hover:underline">{action.label}<ArrowUpRight size={14} aria-hidden="true" /></a>
		{/if}
	</header>
	<div class="px-(--card-pad) pb-(--card-pad)">{@render children()}</div>
</section>
