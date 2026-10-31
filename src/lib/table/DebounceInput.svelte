<!-- Adapted from SV Table's Debounce Input (https://sv-table.vercel.app/components/debounce-input): Meadow's `field` replaces shadcn's input group, and a local timer replaces runed's Debounced. -->
<script lang="ts">
	import { Search, X } from "@lucide/svelte";
	import { onDestroy } from "svelte";

	type Props = {
		value?: string;
		onChange?: (value: string) => void;
		id: string;
		label: string;
		class?: string;
		placeholder?: string;
		debounce?: number;
	};

	let { value = $bindable(""), onChange, id, label, class: className, placeholder = "Search…", debounce = 0 }: Props = $props();

	// Typing updates the field at once; `value` and `onChange` follow after the pause. An outside change to `value` resets the field.
	let inputValue = $derived(value);
	let timer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(timer));
	function commit(next: string) {
		clearTimeout(timer);
		if (next === value) return;
		value = next;
		onChange?.(next);
	}
	function input(next: string) {
		inputValue = next;
		clearTimeout(timer);
		if (debounce > 0) timer = setTimeout(() => commit(next), debounce);
		else commit(next);
	}
	function clearValue() {
		inputValue = "";
		commit("");
	}
</script>

<div class={["relative min-w-0", className]}>
	<label for={id} class="sr-only">{label}</label>
	<Search size={16} class="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" aria-hidden="true" />
	<input
		{id}
		type="search"
		class="field pr-12 pl-10 [&::-webkit-search-cancel-button]:hidden"
		{placeholder}
		autocomplete="off"
		value={inputValue}
		oninput={(event) => input(event.currentTarget.value)}
		onkeydown={(event) => {
			if (event.key === "Escape" && inputValue) {
				event.preventDefault();
				clearValue();
			}
		}} />
	{#if inputValue}
		<button type="button" class="control absolute top-1/2 right-1 -translate-y-1/2" data-variant="ghost" data-size="sm" data-icon aria-label="Clear search" onclick={clearValue}><X size={15} aria-hidden="true" /></button>
	{/if}
</div>
