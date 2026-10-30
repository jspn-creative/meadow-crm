<script lang="ts">
	import { CheckSquare2, ChevronDown } from "@lucide/svelte";
	import DueBadge from "#lib/ui/DueBadge.svelte";
	import type { TaskListItem } from "./types.js";
	let { items, open, toggle, busy = false }: { items: readonly TaskListItem[]; open?: (id: string) => void; toggle?: (id: string) => void; busy?: boolean } = $props();
</script>

<div data-tasks class="@container/tasks space-y-(--card-gap)">
	{#each items as task (task.id)}
		{@const Icon = task.icon ?? CheckSquare2}
		<details data-task-id={task.id} data-interactive="row" style:--item-hue={task.tone ? `var(--color-${task.tone}-soft)` : "var(--color-paper)"} style:--item-ink={task.tone ? `var(--color-${task.tone})` : "var(--color-muted)"} class="work-row group open:bg-selected">
			<summary class="flex cursor-pointer list-none items-start gap-(--row-pad) px-(--row-pad) py-(--row-pad) [&::-webkit-details-marker]:hidden">
				{#if toggle}<span class="mt-0.5 flex size-7 shrink-0 items-center justify-center"
						><input type="checkbox" class="check" aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`} checked={!!task.completed} disabled={busy} onclick={(event) => event.stopPropagation()} onchange={() => toggle?.(task.id)} /></span
					>{:else}<span class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-(--item-hue) text-(--item-ink)"><Icon size={14} aria-hidden="true" /></span>{/if}
				<span class="min-w-0 flex-1">
					<span class={["item-title block", task.completed && "text-muted line-through"]}>{task.title}</span>
					<span class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
						{#if task.context}<span class="text-muted text-xs leading-5">{task.context}</span>{/if}
						{#if task.due}<DueBadge label={task.due} state={task.dueState} done={task.completed} />{/if}
					</span>
				</span>
				<ChevronDown size={14} class="text-muted mt-1 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
			</summary>
			<div class="px-(--row-pad) pt-0 pb-(--row-pad) @min-[24rem]/tasks:pl-[calc(var(--row-pad)+--spacing(10))]">
				{#if task.note}<p class="text-muted text-xs leading-5">{task.note}</p>{/if}
				<p class={["text-xs font-medium", task.note && "mt-3"]}>Assigned to the realtor</p>
				{#if open}<button type="button" class="text-action mt-3" disabled={busy} onclick={() => open?.(task.id)}>Open task</button>{/if}
			</div>
		</details>
	{/each}
</div>
