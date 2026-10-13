<script lang="ts">
	import { dev } from "$app/env";
	import { goto, preloadData } from "$app/navigation";
	import { page } from "$app/state";
	import { ArrowRight, LoaderCircle } from "@lucide/svelte";
	import { workspaceDestination } from "#lib/shell/navigation.js";
	import { onMount } from "svelte";
	let ready = $state(false);
	let pending = $state(false);
	let error = $state("");
	let destination = $derived(workspaceDestination(page.url.searchParams.get("next")));
	onMount(() => {
		ready = true;
	});

	async function enterDemo(event: SubmitEvent) {
		event.preventDefault();
		if (!dev || pending) return;
		pending = true;
		error = "";
		try {
			await preloadData(destination);
			await goto(destination);
		} catch {
			error = "The preview could not open. Try again.";
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head><title>Demo login · Meadow Lane</title></svelte:head>

<div class="flex min-h-[calc(100dvh-6rem)] items-center justify-center px-5 py-12 sm:px-8 lg:min-h-[calc(100dvh-1.5rem)] lg:px-10">
	<form class="w-full max-w-sm" onsubmit={enterDemo}>
		<h2 class="font-display text-4xl tracking-tight">Welcome back.</h2>
		<p class="text-muted mt-3">Open your shared workspace.</p>
		<div class="mt-8"><label for="demo-workspace" class="mb-2 block font-medium">Workspace</label><input id="demo-workspace" class="field" value="Meadow Lane" readonly /></div>
		<button type="submit" class="control mt-5 w-full" data-variant="primary" disabled={!ready || pending} aria-busy={pending}
			>{pending ? "Opening preview…" : "Enter demo workspace"}{#if pending}<LoaderCircle size={17} aria-hidden="true" />{:else}<ArrowRight size={17} aria-hidden="true" />{/if}</button>
		{#if error}<p role="alert" class="text-urgent mt-4">{error}</p>{/if}
	</form>
</div>
