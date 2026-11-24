<script lang="ts">
	import { tick, untrack } from "svelte";
	import { GripVertical, Plus, X } from "@lucide/svelte";
	import { preferenceItems } from "./format.js";

	let { value = $bindable() }: { value: string } = $props();
	// Preferences stays plain text, one item per line; the editor shows those lines as a list. Nothing is written back until an item changes, so opening the editor never rewrites the saved text.
	let items = $state(untrack(() => preferenceItems(value).map((text) => ({ id: crypto.randomUUID(), text }))));
	let fresh = $state("");
	let list: HTMLOListElement | undefined = $state();
	// Reorder rides HTML5 drag like the checklist: dragFrom is the row being hauled, dropAt the gap it will land in.
	let dragFrom = $state<number>();
	let dropAt = $state<number>();
	let dragBlocked = false;

	// The unsent line counts too, so saving the client keeps what was typed without pressing Enter.
	function sync() {
		value = [...items.map((item) => item.text), fresh]
			.map((text) => text.trim())
			.filter(Boolean)
			.join("\n");
	}
	function add() {
		if (!fresh.trim()) return;
		items.push({ id: crypto.randomUUID(), text: fresh.trim() });
		fresh = "";
		sync();
	}
	function remove(id: string) {
		items = items.filter((item) => item.id !== id);
		sync();
	}
	/** Move a row into a gap: gap 0 is above the first row, gap n below the last. */
	async function move(from: number, gap: number) {
		if (gap === from || gap === from + 1) return;
		const [moved] = items.splice(from, 1);
		items.splice(gap > from ? gap - 1 : gap, 0, moved!);
		sync();
		await tick();
		list?.querySelector<HTMLElement>(`[data-reorder="${moved!.id}"]`)?.focus();
	}
	function dragOver(event: DragEvent, index: number) {
		if (dragFrom === undefined) return;
		event.preventDefault();
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		dropAt = event.clientY - box.top < box.height / 2 ? index : index + 1;
	}
	function drop() {
		const from = dragFrom;
		const gap = dropAt;
		dragFrom = dropAt = undefined;
		if (from !== undefined && gap !== undefined) void move(from, gap);
	}
</script>

<div role="group" aria-label="Preferences" class="labeled">
	<p class="field-label" aria-hidden="true">Preferences</p>
	<div>
		{#if items.length}
			<ol bind:this={list} class="space-y-0.5">
				{#each items as item, index (item.id)}
					<li
						class="group/item hover:bg-highlight focus-within:bg-highlight relative flex items-center gap-1 rounded-xl py-0.5 pr-0.5 pl-1 transition-[opacity] data-[dragging=true]:opacity-40"
						data-dragging={dragFrom === index}
						draggable="true"
						onpointerdown={(event) => (dragBlocked = !!(event.target as Element).closest("input, button:not([data-reorder])"))}
						ondragstart={(event) => {
							if (dragBlocked) return event.preventDefault();
							dragFrom = index;
							if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
						}}
						ondragover={(event) => dragOver(event, index)}
						ondrop={drop}
						ondragend={() => (dragFrom = dropAt = undefined)}>
						<!-- A drop lands on the gap beside the row, sitting half outside the row on the hovered side. -->
						{#if dropAt === index}<span class="bg-field absolute inset-x-2.5 top-0 z-10 h-0.5 -translate-y-1/2 rounded-full" aria-hidden="true"></span>{/if}
						{#if dropAt === index + 1}<span class="bg-field absolute inset-x-2.5 bottom-0 z-10 h-0.5 translate-y-1/2 rounded-full" aria-hidden="true"></span>{/if}
						<button
							type="button"
							class="icon-action h-9 w-5 cursor-grab active:cursor-grabbing pointer-fine:opacity-0 pointer-fine:group-hover/item:opacity-100 pointer-fine:focus-visible:opacity-100"
							data-reorder={item.id}
							aria-label={`Reorder “${item.text}”: drag, or press ArrowUp or ArrowDown`}
							title="Reorder: drag, or press ArrowUp or ArrowDown"
							onkeydown={(event) => {
								if (event.key === "ArrowUp" && index > 0) {
									event.preventDefault();
									void move(index, index - 1);
								}
								if (event.key === "ArrowDown" && index < items.length - 1) {
									event.preventDefault();
									void move(index, index + 2);
								}
							}}><GripVertical size={14} aria-hidden="true" /></button>
						<input class="field min-h-9 py-1.5" data-variant="quiet" aria-label={`Preference ${index + 1}`} bind:value={item.text} oninput={sync} maxlength="2000" />
						<button type="button" class="icon-action mx-1.5 pointer-fine:opacity-0 pointer-fine:group-focus-within/item:opacity-100 pointer-fine:group-hover/item:opacity-100" aria-label={`Remove “${item.text}”`} title="Remove" onclick={() => remove(item.id)}><X size={15} aria-hidden="true" /></button>
					</li>
				{/each}
			</ol>
		{/if}
		<div class={["flex items-center gap-1 pl-1", items.length && "mt-0.5"]}>
			<span class="text-muted grid h-9 w-5 shrink-0 place-items-center" aria-hidden="true"><Plus size={14} /></span>
			<input
				class="field min-h-9 py-1.5"
				aria-label="New preference"
				placeholder="Add a preference, then press Enter"
				maxlength="2000"
				bind:value={fresh}
				oninput={sync}
				onkeydown={(event) => {
					if (event.isComposing || event.key !== "Enter") return;
					// Enter adds the line here rather than submitting the client form.
					event.preventDefault();
					add();
				}} />
		</div>
	</div>
</div>
