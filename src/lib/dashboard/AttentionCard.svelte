<script lang="ts">
	import { ArrowUpRight, CheckSquare2 } from "@lucide/svelte";
	import { attention } from "#lib/shell/fixtures.js";
	import DashboardCard from "./DashboardCard.svelte";
	import DueBadge from "#lib/ui/DueBadge.svelte";
	let { order = 0, showAction = true }: { order?: number; showAction?: boolean } = $props();
</script>

<DashboardCard title="Checklist attention" headingId="attention-heading" description={`${attention.length} overdue`} action={showAction ? { href: "/inbox", label: "Open inbox" } : undefined} {order}>
	<ul class="space-y-(--card-gap)">
		{#each attention as item (item.id)}
			<li>
				<a href={item.href} data-interactive="row" style:--item-hue="var(--color-pending-soft)" class="work-row flex items-start gap-(--row-pad) px-(--row-pad) py-(--row-pad)">
					<span class="bg-pending-soft text-pending mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"><CheckSquare2 size={14} aria-hidden="true" /></span>
					<div class="min-w-0 flex-1">
						<p class="item-title">{item.title}</p>
						<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
							<p class="text-muted text-xs leading-5">{item.opportunity} · {item.stage}</p>
							<DueBadge label={item.due} state={item.dueState} />
						</div>
					</div>
					<ArrowUpRight size={16} class="text-muted mt-1 shrink-0" aria-hidden="true" />
				</a>
			</li>
		{/each}
	</ul>
</DashboardCard>
