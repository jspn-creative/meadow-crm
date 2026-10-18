<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { dev } from "$app/env";
	import VariantToolbar from "./VariantToolbar.svelte";
	import { handleVariantKeys, variantRegistry } from "./variants.svelte.js";
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
	<VariantToolbar groups={variantRegistry.sets} storageKey="variant-picker:host:pos" />
{/if}
