<script lang="ts">
	import { ArrowUpRight, CheckSquare2 } from "@lucide/svelte";
	import { attention } from "#lib/shell/fixtures.js";
</script>

<section class="border-hairline min-w-0 rounded-2xl border bg-white" aria-labelledby="attention-heading">
	<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pt-4 pb-3">
		<h2 id="attention-heading" class="font-display text-xl tracking-tight">Checklist attention <span class="text-muted">· {attention.length} overdue</span></h2>
		<a href="/inbox" class="text-field hover:text-field-deep inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap underline-offset-4 transition-colors hover:underline">Open inbox<ArrowUpRight size={14} aria-hidden="true" /></a>
	</div>
	<ul class="space-y-3 px-5 pb-5">
		{#each attention as item (item.id)}
			<li>
				<a href={item.href} data-interactive="row" style:--item-hue="var(--color-pending-soft)" class="border-hairline bg-canvas flex items-start gap-3 rounded-xl border px-4 py-3.5">
					<span class="bg-pending-soft text-pending mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"><CheckSquare2 size={14} aria-hidden="true" /></span>
					<div class="min-w-0 flex-1">
						<p class="font-medium">{item.title}</p>
						<p class="text-muted mt-1 text-xs leading-5">{item.opportunity} · {item.stage}</p>
						<p class="text-urgent mt-2 text-xs">{item.due}</p>
					</div>
					<ArrowUpRight size={16} class="text-muted mt-1 shrink-0" aria-hidden="true" />
				</a>
			</li>
		{/each}
	</ul>
</section>
