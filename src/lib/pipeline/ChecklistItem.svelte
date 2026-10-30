<script lang="ts">
	import { onDestroy, untrack } from "svelte";
	import { ArrowDown, ArrowUp, CalendarPlus, CalendarX2, EllipsisVertical, GripVertical, PencilLine, Trash2 } from "@lucide/svelte";
	import type { Workspace } from "#lib/data/workspace.js";
	import DueBadge from "#lib/ui/DueBadge.svelte";
	import Menu from "#lib/ui/Menu.svelte";
	import { dueLabel, dueState } from "./due.js";
	type Item = Workspace["checklists"][number]["items"][number];
	type Checklist = Workspace["checklists"][number];
	let {
		item,
		checklist,
		today,
		busy,
		first,
		last,
		dragging = false,
		drop = null,
		save,
		rename,
		remove,
		move,
		dragstart,
		dragover,
		dropItem,
		dragend,
	}: {
		item: Item;
		checklist: Checklist;
		today: string;
		busy: boolean;
		first: boolean;
		last: boolean;
		dragging?: boolean;
		drop?: "above" | "below" | null;
		save: (input: { checklistId: string; revision: number; itemId: string; itemRevision: number; completed: boolean; dueDate: string | null }) => Promise<void>;
		rename: (title: string) => Promise<void>;
		remove: () => Promise<void>;
		move: (offset: -1 | 1) => Promise<void>;
		dragstart: (event: DragEvent) => void;
		dragover: (event: DragEvent) => void;
		dropItem: () => void;
		dragend: () => void;
	} = $props();
	const id = $props.id();
	// Local values are the draft: a failed save leaves them in place rather than snapping back.
	let completed = $state(untrack(() => !!item.completedAt));
	let dueDate = $state(untrack(() => item.dueDate ?? ""));
	let renaming = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let dragBlocked = false;
	// Checking items off stays responsive during another save; the change waits for that save, then goes out against the fresh revision.
	let queued = $state(false);
	let dirty = $derived(completed !== !!item.completedAt || dueDate !== (item.dueDate ?? ""));

	function commit() {
		clearTimeout(timer);
		timer = undefined;
		if (busy) {
			queued = true;
			return;
		}
		queued = false;
		if (!dirty) return;
		void save({ checklistId: checklist.id, revision: checklist.revision, itemId: item.id, itemRevision: item.revision, completed, dueDate: dueDate || null });
	}
	// Typing a date fires change once per edited segment, so keyboard edits settle before saving.
	function scheduleCommit() {
		clearTimeout(timer);
		timer = setTimeout(commit, 700);
	}
	$effect(() => {
		if (queued && !busy) commit();
	});
	// A date picked just before the dialog closes still saves; a save that already failed is not retried.
	onDestroy(() => {
		if (timer || queued) commit();
	});
	function finishRename(input: HTMLInputElement, keep: boolean) {
		if (!renaming) return;
		renaming = false;
		const title = input.value.trim();
		if (keep && title && title !== item.title) void rename(title);
	}
</script>

<li
	data-dragging={dragging}
	data-drop={drop}
	draggable={!busy && !renaming}
	onpointerdown={(event) => {
		const target = event.target as Element;
		dragBlocked = !!target.closest("input, textarea, select, button:not([data-reorder]), label:has(input[type='date'])");
	}}
	ondragstart={(event) => {
		if (dragBlocked) event.preventDefault();
		else dragstart(event);
	}}
	ondragend={dragend}
	ondragover={dragover}
	ondrop={dropItem}
	class="group/item hover:bg-highlight focus-within:bg-highlight relative flex items-start gap-2 rounded-xl py-2 pr-1 pl-2.5 text-sm/5 transition-[opacity] data-[dragging=true]:opacity-40 pointer-fine:[--due-reveal:0px] pointer-fine:hover:[--due-reveal:8rem] pointer-fine:has-focus-visible:[--due-reveal:8rem]">
	<!-- A drop lands on the gap beside the row, sitting half outside the row on the hovered side. -->
	{#if drop === "above"}<span class="bg-field absolute inset-x-2.5 top-0 z-10 h-0.5 -translate-y-1/2 rounded-full" aria-hidden="true"></span>{/if}
	{#if drop === "below"}<span class="bg-field absolute inset-x-2.5 bottom-0 z-10 h-0.5 translate-y-1/2 rounded-full" aria-hidden="true"></span>{/if}
	<button
		type="button"
		aria-label={`Reorder ${item.title}: drag, or press ArrowUp or ArrowDown`}
		data-reorder
		data-variant="ghost"
		data-size="sm"
		data-icon
		title="Reorder: drag, or press ArrowUp or ArrowDown"
		disabled={busy}
		class="control absolute top-2 -left-1 h-lh min-h-0 w-3 cursor-grab opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
		onkeydown={(event) => {
			if (event.key === "ArrowUp" && !first) {
				event.preventDefault();
				void move(-1);
			}
			if (event.key === "ArrowDown" && !last) {
				event.preventDefault();
				void move(1);
			}
		}}>
		<GripVertical size={12} aria-hidden="true" />
	</button>
	<span class="flex h-lh shrink-0 items-center">
		<input id={`${id}-done`} type="checkbox" class="check" bind:checked={completed} onchange={commit} />
	</span>
	<span class="min-w-0 flex-1">
		{#if renaming}
			<input
				class="field -my-1.5 min-h-8 rounded-lg px-2 py-1"
				aria-label={`Rename ${item.title}`}
				value={item.title}
				maxlength="200"
				{@attach (input) => input.select()}
				onkeydown={(event) => {
					if (event.key === "Enter") finishRename(event.currentTarget, true);
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						finishRename(event.currentTarget, false);
					}
				}}
				onblur={(event) => finishRename(event.currentTarget, true)} />
		{:else}
			<label for={`${id}-done`} class="block cursor-pointer wrap-anywhere transition-colors">
				{#if completed}<span class="text-muted line-through">{item.title}</span>{:else}{item.title}{/if}
			</label>
		{/if}
	</span>
	<label
		class={[
			"has-focus-visible:outline-field relative -my-0.5 flex h-6 shrink-0 cursor-pointer items-center justify-end rounded-md has-focus-visible:outline-2 has-focus-visible:outline-offset-2 pointer-fine:w-6",
			!dueDate && "text-muted hover:text-ink pointer-fine:opacity-0 pointer-fine:group-hover/item:opacity-100 pointer-fine:has-focus-visible:opacity-100",
		]}>
		<!-- On fine pointers the row reserves only the icon; the revealed date grows leftward over the title's tail on an opaque base, so nothing reflows. -->
		{#if dueDate}<span class="flex rounded-md bg-white pointer-fine:absolute pointer-fine:top-0 pointer-fine:right-0 pointer-fine:z-10"><DueBadge label={dueLabel(dueDate, today)} state={dueState(dueDate, today)} done={completed} compact /></span>{:else}<span
				class="flex size-6 items-center justify-center rounded-md"
				title="Add a due date"><CalendarPlus size={15} aria-hidden="true" /></span
			>{/if}
		<input
			type="date"
			aria-label={`Due date for ${item.title}`}
			class="focus-visible:shadow-floating absolute inset-y-0 right-0 w-full min-w-0 cursor-pointer opacity-0 focus-visible:z-20 focus-visible:w-36 focus-visible:rounded-md focus-visible:bg-white focus-visible:px-1.5 focus-visible:text-xs focus-visible:opacity-100"
			bind:value={dueDate}
			onclick={(event) => {
				try {
					event.currentTarget.showPicker();
				} catch {
					// Browsers without showPicker still open their own picker on click.
				}
			}}
			onchange={scheduleCommit} />
	</label>
	<Menu
		label={`Checklist item actions for ${item.title}`}
		icon={EllipsisVertical}
		disabled={busy}
		class="text-muted pointer-fine:hover:text-ink -my-0.5 h-6 min-h-0 w-5 rounded-md pointer-coarse:-my-3 pointer-coarse:h-11 pointer-coarse:w-6 pointer-fine:opacity-0 pointer-fine:group-focus-within/item:opacity-100 pointer-fine:group-hover/item:opacity-100">
		<button type="button" role="menuitem" class="menu-item" onclick={() => (renaming = true)}><PencilLine size={15} aria-hidden="true" />Rename</button>
		<button type="button" role="menuitem" class="menu-item pointer-fine:hidden" disabled={first} onclick={() => move(-1)}><ArrowUp size={15} aria-hidden="true" />Move up</button>
		<button type="button" role="menuitem" class="menu-item pointer-fine:hidden" disabled={last} onclick={() => move(1)}><ArrowDown size={15} aria-hidden="true" />Move down</button>
		{#if dueDate}<button
				type="button"
				role="menuitem"
				class="menu-item"
				onclick={() => {
					dueDate = "";
					commit();
				}}><CalendarX2 size={15} aria-hidden="true" />Clear due date</button
			>{/if}
		<hr class="border-hairline mx-1.5 my-1" />
		<button type="button" role="menuitem" class="menu-item" data-tone="danger" onclick={remove}><Trash2 size={15} aria-hidden="true" />Remove</button>
	</Menu>
</li>
