<script lang="ts">
	import { untrack } from "svelte";
	import type { Workspace } from "#lib/data/workspace.js";
	type Checklist = Workspace["checklists"][number];
	let { item, checklist, busy, save }: { item: Checklist["items"][number]; checklist: Checklist; busy: boolean; save: (input: { checklistId: string; revision: number; itemId: string; itemRevision: number; completed: boolean; dueDate: string | null }) => Promise<void> } = $props();
	let completed = $state(untrack(() => !!item.completedAt));
	let dueDate = $state(untrack(() => item.dueDate ?? ""));
	let dirty = $derived(completed !== !!item.completedAt || dueDate !== (item.dueDate ?? ""));
</script>

<form
	class="border-hairline space-y-3 border-b py-4 last:border-b-0"
	onsubmit={async (event) => {
		event.preventDefault();
		await save({ checklistId: checklist.id, revision: checklist.revision, itemId: item.id, itemRevision: item.revision, completed, dueDate: dueDate || null });
	}}>
	<label class="flex min-h-11 items-start gap-3 py-2"><input type="checkbox" class="mt-0.5 size-5 shrink-0" bind:checked={completed} disabled={busy} /><span class="min-w-0 wrap-anywhere">{item.title}</span></label>
	<div class="flex flex-wrap items-end gap-3 pl-8">
		<label class="min-w-0 flex-1 space-y-1"><span class="text-muted block text-xs">Due date<span class="sr-only"> for {item.title}</span></span><input type="date" class="field min-w-0" bind:value={dueDate} disabled={busy} /></label>
		<button class="control" disabled={busy || !dirty}>Save step<span class="sr-only">: {item.title}</span></button>
	</div>
</form>
