<script lang="ts">
	import type { Snippet } from "svelte";
	import { onDestroy, onMount } from "svelte";
	import { dev } from "$app/env";
	import VariantToolbar from "./VariantToolbar.svelte";
	import { handleVariantKeys, variantRegistry } from "./variants.svelte.js";
	interface Props {
		variants: string[];
		id?: string;
		defaultIndex?: number;
		children: Snippet<[string, number]>;
	}
	let { variants, id = "default", defaultIndex = 0, children }: Props = $props();
	let entry = $derived(variantRegistry.sets.find((set) => set.id === id));
	let activeIndex = $derived(entry?.active ?? defaultIndex);
	let activeVariant = $derived(variants[activeIndex] ?? variants[0] ?? "");
	onMount(() => {
		variantRegistry.register(id, variants, defaultIndex);
	});
	onDestroy(() => {
		variantRegistry.unregister(id);
	});
	function handleKeydown(event: KeyboardEvent) {
		if (variantRegistry.hosts > 0) return;
		handleVariantKeys(event);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{@render children(activeVariant, activeIndex)}

{#if dev && variantRegistry.hosts === 0}
	<VariantToolbar groups={entry ? [entry] : [{ id, variants, active: defaultIndex }]} storageKey={`variant-picker:${id}:pos`} />
{/if}
