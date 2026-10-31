<!-- Adapted from SV Table's Faceted Filter (https://sv-table.vercel.app/components/data-table-faceted-filter): a native popover with Meadow's menu and check primitives instead of shadcn's Popover and Command, an optional match mode, and counts supplied by the server rather than TanStack's faceted row model. -->
<script lang="ts" module>
	export type FacetOption = { value: string; label: string; color?: string };
	export type FacetMode = { value: string; label: string; summary: string };
</script>

<script lang="ts">
	import { CirclePlus, Search, X } from "@lucide/svelte";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";

	type Props = {
		title: string;
		options: readonly FacetOption[];
		selected: readonly string[];
		onChange: (values: string[]) => void;
		/** Result counts by option value, for the current results with this filter left out. */
		counts?: Readonly<Record<string, number>>;
		/** How the chosen values combine, such as any, all, or none of them; the first mode is the default. */
		modes?: readonly FacetMode[];
		mode?: string;
		onModeChange?: (mode: string) => void;
		disabled?: boolean;
	};

	let { title, options, selected, onChange, counts, modes, mode, onModeChange, disabled = false }: Props = $props();

	const id = $props.id();
	let search = $state("");
	let list = $state<HTMLElement>();
	let input = $state<HTMLInputElement>();

	let chosen = $derived(new Set(selected));
	let chosenOptions = $derived(options.filter((option) => chosen.has(option.value)));
	let activeMode = $derived(modes?.find((item) => item.value === mode) ?? modes?.[0]);
	let showMode = $derived(!!modes && activeMode !== modes[0]);
	let matches = $derived.by(() => {
		const term = search.trim().toLowerCase();
		return term ? options.filter((option) => option.label.toLowerCase().includes(term)) : options;
	});

	function toggle(value: string) {
		onChange(chosen.has(value) ? selected.filter((item) => item !== value) : [...selected, value]);
	}
	function clear() {
		onChange([]);
		onModeChange?.(modes?.[0]?.value ?? "");
	}
	function boxes() {
		return [...(list?.querySelectorAll<HTMLInputElement>("input[type=checkbox]") ?? [])];
	}
	// Arrow keys move between the search field and the options, as in a command menu.
	function navigate(event: KeyboardEvent) {
		if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
		const items = boxes();
		if (!items.length) return;
		event.preventDefault();
		const index = items.indexOf(document.activeElement as HTMLInputElement);
		if (event.key === "Home") return items[0]?.focus();
		if (event.key === "End") return items.at(-1)?.focus();
		if (event.key === "ArrowUp" && index <= 0) return input?.focus();
		items[event.key === "ArrowDown" ? Math.min(index + 1, items.length - 1) : index - 1]?.focus();
	}
	function oninput(event: KeyboardEvent) {
		if (event.key === "Enter" && matches.length === 1) {
			event.preventDefault();
			toggle(matches[0]!.value);
		}
	}
</script>

<div class="inline-flex min-w-0">
	<button
		type="button"
		class={["control min-w-0 gap-1.5", chosen.size ? "rounded-r-none pr-2" : "border-dashed"]}
		data-size="sm"
		popovertarget={`${id}-facet`}
		style:anchor-name={`--${id}`}
		aria-label={`${title} filter${chosen.size ? `, ${showMode ? `${activeMode?.summary} ` : ""}${chosenOptions.map((option) => option.label).join(", ")}` : ""}`}
		{disabled}>
		<CirclePlus size={15} class="text-muted shrink-0" aria-hidden="true" />
		<span class="shrink-0">{title}</span>
		{#if chosen.size}
			<span class="bg-hairline mx-1 h-4 w-px shrink-0" aria-hidden="true"></span>
			{#if showMode}<span class="text-muted shrink-0 font-normal">{activeMode?.summary}</span>{/if}
			{#if chosenOptions.length > 2}
				<span class="chip text-field shrink-0">{chosenOptions.length} selected</span>
			{:else}
				{#each chosenOptions as option (option.value)}
					<span class="chip max-w-36 min-w-0" data-dot={option.color ? "" : undefined} style:--dot={option.color}><span class="truncate">{option.label}</span></span>
				{/each}
			{/if}
		{/if}
	</button>
	{#if chosen.size}
		<button type="button" class="control -ml-px rounded-l-none px-2" data-size="sm" aria-label={`Clear ${title} filter`} title={`Clear ${title.toLowerCase()}`} {disabled} onclick={clear}><X size={15} aria-hidden="true" /></button>
	{/if}
</div>

<div
	id={`${id}-facet`}
	popover="auto"
	role="dialog"
	tabindex="-1"
	aria-label={`${title} filter`}
	class="surface surface-floating menu w-72 max-w-[calc(100vw-2rem)] p-0 [position-area:block-end_span-inline-end]"
	style:position-anchor={`--${id}`}
	onbeforetoggle={(event) => {
		if (event.newState === "open") search = "";
	}}
	ontoggle={(event) => {
		if (event.newState === "open") input?.focus();
	}}
	onkeydown={navigate}>
	<label class="border-hairline flex items-center gap-2 border-b px-3">
		<Search size={15} class="text-muted shrink-0" aria-hidden="true" />
		<span class="sr-only">Search {title.toLowerCase()}</span>
		<input bind:this={input} bind:value={search} type="text" class="field-bare min-h-11 px-0 focus-visible:filter-none" placeholder={`Search ${title.toLowerCase()}`} autocomplete="off" onkeydown={oninput} />
	</label>
	{#if modes}
		<div class="segmented mx-1.5 mt-1.5" role="group" aria-label={`Match ${title.toLowerCase()}`}>
			{#each modes as item (item.value)}
				<button type="button" aria-pressed={item === activeMode} class="text-xs" onclick={() => onModeChange?.(item.value)}>{item.label}</button>
			{/each}
		</div>
	{/if}
	<div bind:this={list} role="group" aria-label={title} class="max-h-72 overflow-y-auto overscroll-contain p-(--inset)" {@attach overflowFade({ axis: "y" })}>
		{#each matches as option (option.value)}
			{@const count = counts?.[option.value] ?? 0}
			<label class={["menu-item has-[:focus-visible]:bg-highlight cursor-pointer gap-3 font-normal", counts && !count && !chosen.has(option.value) && "text-muted"]}>
				<input type="checkbox" class="check" data-shape="box" checked={chosen.has(option.value)} onchange={() => toggle(option.value)} />
				{#if option.color}<span class="size-2 shrink-0 rounded-full" style:background={option.color} aria-hidden="true"></span>{/if}
				<span class="min-w-0 flex-1 truncate">{option.label}</span>
				{#if counts}<span class="text-muted shrink-0 text-xs tabular-nums">{count}</span>{/if}
			</label>
		{:else}
			<p class="text-muted px-2.5 py-6 text-center">No {title.toLowerCase()} match “{search.trim()}”.</p>
		{/each}
	</div>
	{#if chosen.size}
		<div class="border-hairline border-t p-(--inset)">
			<button type="button" class="menu-item justify-center" onclick={clear}>Clear filter</button>
		</div>
	{/if}
</div>
