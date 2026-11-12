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

	// The field owns its text: typing writes no reactive state, so keystrokes never wait on, or get replayed by, the async work a search starts. `value` and `onChange` follow after the pause.
	let input: HTMLInputElement;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let published = "";
	onDestroy(() => clearTimeout(timer));
	// Follow outside changes, such as clearing filters or going back, but never while the user is typing, when `value` may be an echo of an older search.
	function follow(node: HTMLInputElement) {
		const next = value;
		if (document.activeElement === node || timer !== undefined || node.value === next) return;
		node.value = next;
		published = next;
	}
	function commit(next: string) {
		clearTimeout(timer);
		timer = undefined;
		if (next === published) return;
		published = next;
		if (onChange) onChange(next);
		else value = next;
	}
	function changed() {
		clearTimeout(timer);
		timer = undefined;
		if (debounce > 0) timer = setTimeout(() => commit(input.value), debounce);
		else commit(input.value);
	}
	function clearValue() {
		input.value = "";
		commit("");
		input.focus();
	}
</script>

<div class={["relative min-w-0", className]}>
	<label for={id} class="sr-only">{label}</label>
	<Search size={16} class="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" aria-hidden="true" />
	<input
		{id}
		bind:this={input}
		{@attach follow}
		type="search"
		class="field peer pr-12 pl-10 [&::-webkit-search-cancel-button]:hidden"
		{placeholder}
		autocomplete="off"
		oninput={changed}
		onkeydown={(event) => {
			if (event.key === "Escape" && input.value) {
				event.preventDefault();
				clearValue();
			}
		}} />
	<button type="button" class="control absolute top-1/2 right-1 -translate-y-1/2 peer-placeholder-shown:hidden" data-variant="ghost" data-size="sm" data-icon aria-label="Clear search" onclick={clearValue}><X size={15} aria-hidden="true" /></button>
</div>
