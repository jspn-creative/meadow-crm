<script lang="ts">
	import type { Snippet } from "svelte";
	import { ArrowUpRight } from "@lucide/svelte";
	let { title, headingId, description, descriptionInline = false, action, order = 0, children }: { title: string; headingId: string; description?: string; descriptionInline?: boolean; action?: { href: string; label: string }; order?: number; children: Snippet } = $props();
</script>

<section data-widget class="surface @container/card" aria-labelledby={headingId} style:--widget-order={order}>
	<header class="flex min-h-14 flex-col justify-center px-(--card-pad) py-(--card-head-py)">
		<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
			<h2 id={headingId} class="font-display min-w-0 text-xl tracking-tight">{title}</h2>
			{#if (description && descriptionInline) || action}
				<div class="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1">
					{#if description && descriptionInline}<p class="text-muted text-xs">{description}</p>{/if}
					{#if action}
						<a href={action.href} class="text-field hover:text-field-deep inline-flex min-h-8 shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap underline-offset-4 transition-colors hover:underline">{action.label}<ArrowUpRight size={14} aria-hidden="true" /></a>
					{/if}
				</div>
			{/if}
		</div>
		{#if description && !descriptionInline}<p class="text-muted text-xs">{description}</p>{/if}
	</header>
	<div class="px-(--card-pad) pb-(--card-pad)">{@render children()}</div>
</section>
