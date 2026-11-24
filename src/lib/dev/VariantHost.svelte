<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { dev } from "$app/env";
	import VariantToolbar from "./VariantToolbar.svelte";
	import { handleVariantKeys, variantRegistry } from "./variants.svelte.js";
	/** Where the toolbar rests until dragged, as position utilities, such as above a view's pinned bar. */
	let { dock = "right-4 bottom-4" }: { dock?: string } = $props();
	onMount(() => {
		variantRegistry.hosts += 1;
	});
	onDestroy(() => {
		variantRegistry.hosts -= 1;
	});
	function handleKeydown(event: KeyboardEvent) {
		if (variantRegistry.hosts === 0) return;
		handleVariantKeys(event);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if dev && variantRegistry.sets.length > 0}
	<VariantToolbar groups={variantRegistry.sets} storageKey="variant-picker:host:pos" {dock} />
{/if}
