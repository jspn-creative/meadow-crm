<script lang="ts">
	import { CheckSquare2, ChevronDown } from "@lucide/svelte";
	import DueBadge from "#lib/ui/DueBadge.svelte";
	import type { TaskListItem } from "./types.js";
	let { items }: { items: readonly TaskListItem[] } = $props();
</script>

<div data-tasks class="@container/tasks space-y-(--card-gap)">
	{#each items as task (task.id)}
		{@const Icon = task.icon ?? CheckSquare2}
		<details data-task-id={task.id} data-interactive="row" style:--item-hue={task.tone ? `var(--color-${task.tone}-soft)` : "var(--color-paper)"} style:--item-ink={task.tone ? `var(--color-${task.tone})` : "var(--color-muted)"} class="work-row group open:bg-paper/50">
			<summary class="flex cursor-pointer list-none items-start gap-(--row-pad) px-(--row-pad) py-(--row-pad) [&::-webkit-details-marker]:hidden">
				<span class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-(--item-hue) text-(--item-ink)"><Icon size={14} aria-hidden="true" /></span>
				<span class="min-w-0 flex-1">
					<span class="item-title block">{task.title}</span>
					<span class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
						{#if task.context}<span class="text-muted text-xs leading-5">{task.context}</span>{/if}
						<DueBadge label={task.due} state={task.dueState} />
					</span>
				</span>
				<ChevronDown size={14} class="text-muted mt-1 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
			</summary>
			<div class="px-(--row-pad) pt-0 pb-(--row-pad) @min-[24rem]/tasks:pl-[calc(var(--row-pad)+--spacing(10))]">
				{#if task.note}<p class="text-muted text-xs leading-5">{task.note}</p>{/if}
				<p class={["text-xs font-medium", task.note && "mt-3"]}>Assigned to the realtor</p>
			</div>
		</details>
	{/each}
</div>
