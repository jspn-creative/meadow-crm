<script lang="ts">
	import type { Snippet } from "svelte";
	import { ArrowUpRight } from "@lucide/svelte";
	let { title, headingId, description, action, order = 0, children }: { title: string; headingId: string; description?: string; action?: { href: string; label: string }; order?: number; children: Snippet } = $props();
</script>

<section data-widget class="border-hairline @container/card min-w-0 rounded-2xl border bg-white" aria-labelledby={headingId} style:--widget-order={order}>
	<header class="flex min-h-18 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 @min-[24rem]/card:px-5">
		<div class="min-w-0">
			<h2 id={headingId} class="font-display text-xl leading-7 tracking-tight">{title}</h2>
			{#if description}<p class="text-muted mt-1 text-xs leading-4">{description}</p>{/if}
		</div>
		{#if action}
			<a href={action.href} class="text-field hover:text-field-deep inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap underline-offset-4 transition-colors hover:underline">{action.label}<ArrowUpRight size={14} aria-hidden="true" /></a>
		{/if}
	</header>
	<div class="px-4 pb-4 @min-[24rem]/card:px-5 @min-[24rem]/card:pb-5">{@render children()}</div>
</section>
