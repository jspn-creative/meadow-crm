<!-- Adapted from SV Table's Data Table Filters (https://sv-table.vercel.app/docs/filters): one active filter as a joined subject, operator, value, and remove control. Native popovers replace shadcn's Popover and Command; the view supplies the value editor, since Registry filters are applied on the server. -->
<script lang="ts">
	import { ChevronDown, X } from "@lucide/svelte";
	import type { Component, Snippet } from "svelte";

	type Props = {
		label: string;
		icon: Component<{ size?: number; class?: string; "aria-hidden"?: "true" }>;
		operators: readonly { value: string; label: string }[];
		operator: string;
		onOperatorChange: (operator: string) => void;
		/** What the value reads as, or undefined while the filter still needs one. */
		summary?: string;
		/** The value editor, which can close its popover once a choice is complete. */
		editor?: Snippet<[close: () => void]>;
		onRemove: () => void;
		/** Open the value editor on mount, for a filter that was just added. */
		autofocus?: boolean;
	};

	let { label, icon: Icon, operators, operator, onOperatorChange, summary, editor, onRemove, autofocus = false }: Props = $props();

	const id = $props.id();
	let operatorMenu = $state<HTMLElement>();
	let valuePopover = $state<HTMLElement>();
	let current = $derived(operators.find((item) => item.value === operator) ?? operators[0]);

	const closeValue = () => valuePopover?.hidePopover();
	const radios = () => [...(operatorMenu?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? [])];
	function navigate(event: KeyboardEvent) {
		const items = radios();
		const index = items.indexOf(document.activeElement as HTMLElement);
		const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[event.key];
		if (next === undefined) return;
		event.preventDefault();
		items[(next + items.length) % items.length]?.focus();
	}
	function openOnMount(node: HTMLElement) {
		if (autofocus) requestAnimationFrame(() => node.showPopover());
	}
	const segment = "hover:bg-highlight focus-visible:bg-highlight flex min-h-9 items-center gap-1 px-2.5 transition-colors duration-120 motion-reduce:transition-none pointer-coarse:min-h-11";
</script>

<div class="border-hairline divide-hairline flex max-w-full min-w-0 items-stretch divide-x overflow-hidden rounded-xl border bg-white text-sm" role="group" aria-label={`${label} filter`}>
	<span class="text-muted flex shrink-0 items-center gap-1.5 pr-2.5 pl-3 font-medium"><Icon size={14} aria-hidden="true" />{label}</span>
	<button type="button" class={[segment, "shrink-0"]} popovertarget={`${id}-operator`} style:anchor-name={`--${id}-operator`} aria-haspopup="menu" aria-label={`${label}: ${current?.label}. Change condition`}>
		{current?.label}<ChevronDown size={13} class="text-muted" aria-hidden="true" />
	</button>
	{#if editor}
		<button type="button" class={[segment, "min-w-0 font-medium", !summary && "text-field"]} popovertarget={`${id}-value`} style:anchor-name={`--${id}-value`} aria-label={`${label} value: ${summary ?? "not chosen"}. Change`}>
			<span class="truncate">{summary ?? "Choose…"}</span>
		</button>
	{/if}
	<button type="button" class={[segment, "text-muted hover:text-ink shrink-0 px-2"]} aria-label={`Remove ${label} filter`} title="Remove filter" onclick={onRemove}><X size={14} aria-hidden="true" /></button>
</div>

<div
	bind:this={operatorMenu}
	id={`${id}-operator`}
	popover="auto"
	role="menu"
	tabindex="-1"
	aria-label={`${label} condition`}
	class="surface surface-floating menu min-w-40 [position-area:block-end_span-inline-end]"
	style:position-anchor={`--${id}-operator`}
	ontoggle={(event) => {
		if (event.newState === "open") (radios().find((item) => item.getAttribute("aria-checked") === "true") ?? radios()[0])?.focus();
	}}
	onkeydown={navigate}>
	{#each operators as item (item.value)}
		<button
			type="button"
			role="menuitemradio"
			aria-checked={item.value === current?.value}
			class="menu-item"
			onclick={() => {
				onOperatorChange(item.value);
				operatorMenu?.hidePopover();
			}}>{item.label}</button>
	{/each}
</div>

{#if editor}
	<div
		bind:this={valuePopover}
		id={`${id}-value`}
		popover="auto"
		role="dialog"
		aria-label={`${label} value`}
		class="surface surface-floating menu w-auto min-w-56 p-3 [position-area:block-end_span-inline-end]"
		style:position-anchor={`--${id}-value`}
		ontoggle={(event) => {
			if (event.newState === "open") valuePopover?.querySelector<HTMLElement>("input, select, button")?.focus();
		}}
		{@attach openOnMount}>
		{@render editor(closeValue)}
	</div>
{/if}
