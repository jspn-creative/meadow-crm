<script lang="ts">
	import { Sparkles, Orbit, Sprout, Coffee } from "@lucide/svelte";
	const history = [
		{ id: "universe", title: "The universe opens for business.", detail: "Big expansion. No paperwork.", date: "13.8 billion years ago", icon: Sparkles, color: "tour" },
		{ id: "earth", title: "Earth finds its forever home.", detail: "Great light. Excellent orbital location.", date: "4.5 billion years ago", icon: Orbit, color: "info" },
		{ id: "life", title: "Life moves in.", detail: "Starts small. Really makes the place its own.", date: "About 3.7 billion years ago", icon: Sprout, color: "success" },
		{ id: "today", title: "You arrive. Coffee recommended.", detail: "Your workspace history starts here.", date: "Today", icon: Coffee, color: "pending" },
	] as const;
</script>

<section class="border-hairline min-w-0 rounded-2xl border bg-white" aria-labelledby="activity-heading">
	<div class="flex min-h-18 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pt-4 pb-3">
		<h2 id="activity-heading" class="font-display text-xl tracking-tight">Recent activity</h2>
		<span class="text-muted text-xs">A brief history of everything</span>
	</div>
	<ol class="px-5 pb-5" aria-label="No workspace activity yet. A playful history of the universe.">
		{#each history as item (item.id)}
			<li class="before:bg-hairline relative flex gap-4 pb-6 before:absolute before:top-10 before:bottom-2 before:left-[19px] before:w-px last:pb-0 last:before:hidden" style:--item-hue={`var(--color-${item.color}-soft)`} style:--item-ink={`var(--color-${item.color})`}>
				<span class="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-(--item-hue) bg-(--item-hue) text-(--item-ink)"><item.icon size={17} strokeWidth={1.7} aria-hidden="true" /></span>
				<div class="min-w-0 pt-0.5">
					<p class="text-sm font-medium">{item.title}</p>
					<p class="text-muted mt-1 text-xs leading-5">{item.detail}</p>
					<p class="text-muted mt-1 text-xs">{item.date}</p>
				</div>
			</li>
		{/each}
	</ol>
</section>
