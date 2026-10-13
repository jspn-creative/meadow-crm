<script lang="ts">
	import { ArrowUpRight, ChevronDown, Phone, Hammer, Handshake } from "@lucide/svelte";
	import { tasks } from "#lib/shell/fixtures.js";
	const presentation = [
		{ color: "info", icon: Phone, note: "Confirm preferred neighborhoods and the next time to catch up." },
		{ color: "pending", icon: Hammer, note: "Review the revised quote against the agreed scope of work." },
		{ color: "tour", icon: Handshake, note: "Connect Sam with the partner and share the best contact details." },
	] as const;
</script>

<section data-tasks class="border-hairline min-w-0 rounded-2xl border bg-white" aria-labelledby="tasks-heading">
	<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pt-4 pb-3">
		<h2 id="tasks-heading" class="font-display text-xl tracking-tight">Realtor tasks</h2>
		<a href="/tasks" class="text-field hover:text-field-deep inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap underline-offset-4 transition-colors hover:underline">View all<ArrowUpRight size={14} aria-hidden="true" /></a>
	</div>
	<div class="space-y-3 px-5 pb-5">
		{#each tasks as task, index (task.id)}
			{@const treatment = presentation[index]}
			<details data-interactive="row" style:--item-hue={`var(--color-${treatment.color}-soft)`} style:--item-ink={`var(--color-${treatment.color})`} class="group border-hairline bg-canvas open:bg-paper/50 rounded-xl border">
				<summary class="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
					<span class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-(--item-hue) text-(--item-ink)"><treatment.icon size={14} aria-hidden="true" /></span>
					<span class="min-w-0 flex-1"
						><span class="block text-sm leading-5 font-medium">{task.title}</span><span class="text-muted mt-1 block text-xs leading-5">{task.context}</span><span class={["mt-2 inline-block rounded-md px-2 py-0.5 text-xs", task.due === "Due yesterday" ? "bg-urgent-soft text-urgent" : "bg-(--item-hue) text-(--item-ink)"]}
							>{task.due}</span
						></span>
					<ChevronDown size={14} class="text-muted mt-1 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
				</summary>
				<div class="px-4 pt-0 pb-4">
					<p class="text-muted text-xs leading-5">{treatment.note}</p>
					<p class="mt-3 text-xs font-medium">Assigned to the realtor</p>
				</div>
			</details>
		{/each}
	</div>
</section>
