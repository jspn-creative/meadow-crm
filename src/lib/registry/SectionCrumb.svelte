<script lang="ts" module>
	/** The client editor's section in view, and whether the panel was scrolling down when it changed. */
	export type PanelSection = { name: string; forward: boolean };
</script>

<script lang="ts">
	import { fly } from "svelte/transition";
	import { MediaQuery } from "svelte/reactivity";

	let { section }: { section: PanelSection } = $props();
	const reducedMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
	// Scrolling down, the new section rises from below as the old one leaves upward; scrolling up reverses both.
	const roll = (node: Element, entering: boolean) => fly(node, { y: (section.forward === entering ? 1 : -1) * 8, duration: reducedMotion.current ? 0 : 220, opacity: 0 });
</script>

<!-- Only the name rolls; the slash before it stays put. Both names share one cell while they pass, so the breadcrumb never reflows mid-change. -->
{#if section.name}<span aria-hidden="true">/</span>{/if}
<span class="grid shrink-0 *:col-start-1 *:row-start-1">
	<!-- Global, because the crumb sits in an if inside the key: a local transition would only play when that if toggles, never when the key swaps it. -->
	{#key section.name}
		{#if section.name}<span class="text-ink font-medium whitespace-nowrap" in:roll|global={true} out:roll|global={false}>{section.name}</span>{/if}
	{/key}
</span>
