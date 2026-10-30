<script lang="ts">
	import { onMount } from "svelte";
	import UserChip from "#lib/shell/UserChip.svelte";
	import { replaceSession } from "#lib/shell/session-navigation.js";
	let ready = $state(false);
	let pending = $state(false);
	let message = $state("");
	onMount(() => {
		ready = true;
	});
	async function choose(userId: string) {
		if (pending) return;
		pending = true;
		message = "";
		try {
			const response = await fetch("/api/support/choose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
			if (!response.ok) throw new Error();
			replaceSession("/");
		} catch {
			message = "Unable to impersonate that business user. Try again.";
			pending = false;
		}
	}
</script>

<svelte:head><title>Support admin · Meadow Lane</title></svelte:head>
<main class="mx-auto max-w-lg px-5 py-12 sm:px-8">
	<h1 class="font-display text-3xl">Support admin</h1>
	<p class="text-muted mt-4">Choose a business user to impersonate. No workspace data is available until you choose.</p>
	<div class="mt-6 flex flex-wrap gap-3">
		<button class="control" data-variant="primary" disabled={!ready || pending} onclick={() => choose("business-realtor")}>Impersonate Realtor</button>
		<button class="control" disabled={!ready || pending} onclick={() => choose("business-assistant")}>Impersonate Assistant</button>
	</div>
	{#if message}<p role="alert" class="text-urgent mt-4">{message}</p>{/if}
	<div class="mt-8"><UserChip accountOnly /></div>
</main>
