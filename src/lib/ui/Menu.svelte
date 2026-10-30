<script lang="ts">
	import { Ellipsis } from "@lucide/svelte";
	import type { Snippet } from "svelte";
	let { label, children, disabled = false, class: className = "", icon: Icon = Ellipsis }: { label: string; children: Snippet; disabled?: boolean; class?: string; icon?: typeof Ellipsis } = $props();
	const id = $props.id();
	let menu = $state<HTMLElement>();
	// Items render only while open, so a board of cards does not carry every card's menu in the DOM.
	let open = $state(false);
	const items = () => [...(menu?.querySelectorAll<HTMLElement>("[role^='menuitem']:not(:disabled)") ?? [])];
	function navigate(event: KeyboardEvent) {
		const list = items();
		const index = list.indexOf(document.activeElement as HTMLElement);
		const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.length - 1 }[event.key];
		if (next === undefined) {
			if (event.key === "Tab") menu?.hidePopover();
			return;
		}
		event.preventDefault();
		if (list.length) list[(next + list.length) % list.length]?.focus();
	}
</script>

<button type="button" popovertarget={`${id}-menu`} aria-haspopup="menu" aria-label={label} title={label} {disabled} style:anchor-name={`--${id}`} class={["control", className]} data-variant="ghost" data-size="sm" data-icon>
	<Icon size={16} aria-hidden="true" />
</button>
<div
	bind:this={menu}
	id={`${id}-menu`}
	popover="auto"
	role="menu"
	tabindex="-1"
	aria-label={label}
	style:position-anchor={`--${id}`}
	class="surface surface-floating menu"
	onbeforetoggle={(event) => (open = event.newState === "open")}
	ontoggle={(event) => {
		if (event.newState === "open") items()[0]?.focus();
	}}
	onkeydown={navigate}
	onclick={(event) => {
		if ((event.target as HTMLElement).closest("[role^='menuitem']")) menu?.hidePopover();
	}}>
	{#if open}{@render children()}{/if}
</div>
