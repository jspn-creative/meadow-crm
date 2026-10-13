<script lang="ts">
	import { Sparkles, Orbit, Sprout, Coffee } from "@lucide/svelte";
	import DashboardCard from "./DashboardCard.svelte";
	let { order = 0 }: { order?: number } = $props();
	const history = [
		{ id: "universe", title: "The universe opens for business.", detail: "Big expansion. No paperwork.", date: "13.8 billion years ago", icon: Sparkles, color: "tour" },
		{ id: "earth", title: "Earth finds its forever home.", detail: "Great light. Excellent orbital location.", date: "4.5 billion years ago", icon: Orbit, color: "info" },
		{ id: "life", title: "Life moves in.", detail: "Starts small. Really makes the place its own.", date: "About 3.7 billion years ago", icon: Sprout, color: "success" },
		{ id: "today", title: "You arrive. Coffee recommended.", detail: "Your workspace history starts here.", date: "Today", icon: Coffee, color: "pending" },
	] as const;
</script>

<DashboardCard title="Recent activity" headingId="activity-heading" description="A brief history of everything" {order}>
	<ol aria-label="No workspace activity yet. A playful history of the universe.">
		{#each history as item (item.id)}
			<li class="before:bg-hairline relative flex gap-3 pb-4 before:absolute before:top-9 before:bottom-1 before:left-[15px] before:w-px last:pb-0 last:before:hidden" style:--item-hue={`var(--color-${item.color}-soft)`} style:--item-ink={`var(--color-${item.color})`}>
				<span class="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-(--item-hue) text-(--item-ink)"><item.icon size={15} strokeWidth={1.7} aria-hidden="true" /></span>
				<div class="min-w-0 pt-0.5">
					<p class="text-sm font-medium">{item.title}</p>
					<p class="text-muted mt-1 text-xs leading-5">{item.detail}</p>
					<p class="text-muted mt-1 text-xs">{item.date}</p>
				</div>
			</li>
		{/each}
	</ol>
</DashboardCard>
