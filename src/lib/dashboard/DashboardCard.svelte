<script lang="ts">
	import type { Snippet } from "svelte";
	import { ArrowUpRight } from "@lucide/svelte";
	let { title, headingId, description, descriptionInline = false, action, order = 0, children }: { title: string; headingId: string; description?: string; descriptionInline?: boolean; action?: { href: string; label: string }; order?: number; children: Snippet } = $props();
</script>

<section data-widget class="border-hairline @container/card min-w-0 rounded-2xl border bg-white" aria-labelledby={headingId} style:--widget-order={order}>
	<header class={["flex min-h-18 flex-wrap justify-between gap-x-3 gap-y-1 px-4 @min-[24rem]/card:px-5", descriptionInline ? "items-start py-4" : "items-center py-3"]}>
		<div class="min-w-0">
			<h2 id={headingId} class="font-display text-xl leading-7 tracking-tight">{title}</h2>
			{#if description && !descriptionInline}<p class="text-muted mt-1 text-xs leading-4">{description}</p>{/if}
		</div>
		{#if description && descriptionInline}<p class="text-muted shrink-0 pt-1 text-xs leading-5">{description}</p>{/if}
		{#if action}
			<a href={action.href} class="text-field hover:text-field-deep inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap underline-offset-4 transition-colors hover:underline">{action.label}<ArrowUpRight size={14} aria-hidden="true" /></a>
		{/if}
	</header>
	<div class="px-4 pb-4 @min-[24rem]/card:px-5 @min-[24rem]/card:pb-5">{@render children()}</div>
</section>
