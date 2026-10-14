<script lang="ts">
	import { onMount } from "svelte";
	import { createClient, getWorkspace } from "#lib/crm.remote.js";
	const remote = getWorkspace({ archived: false });
	let workspace = $derived(await remote);
	let search = $state("");
	let creating = $state(false);
	let clientId = $state("");
	let requestId = $state("");
	let failure = $state("");
	let saved = $state("");
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	let filtered = $derived(workspace.clients.filter((client) => client.name.toLowerCase().includes(search.toLowerCase())));
	function newClient() {
		clientId = crypto.randomUUID();
		requestId = crypto.randomUUID();
		failure = "";
		saved = "";
		creating = true;
	}
</script>

<svelte:head><title>Registry · Meadow Lane</title></svelte:head>

<div class="surface-content @container/registry">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<p class="text-muted max-w-lg">Clients and their linked opportunities.</p>
		<button type="button" class="control" onclick={newClient} disabled={!ready || creating}>New client</button>
	</div>
	{#if creating}
		<form
			class="border-hairline mb-6 max-w-xl space-y-4 border-b pb-6"
			{...createClient.enhance(async (form) => {
				failure = "";
				try {
					if (await form.submit().updates(remote)) {
						saved = clientId;
						creating = false;
						form.element.reset();
					}
				} catch {
					failure = "Client could not be saved. Your name is retained; try again.";
				}
			})}>
			<h2 class="font-display text-2xl">New client</h2>
			<input {...createClient.fields.id.as("hidden", clientId)} />
			<input {...createClient.fields.requestId.as("hidden", requestId)} />
			<label class="block space-y-2"><span class="font-medium">Client name</span><input class="field" {...createClient.fields.name.as("text")} required maxlength="200" autocomplete="name" /></label>
			{#each createClient.fields.allIssues() ?? [] as issue (issue)}<p class="text-urgent" role="alert">{issue.message}</p>{/each}
			{#if failure}<p class="text-urgent" role="alert">{failure}</p>{/if}
			<div class="flex flex-wrap gap-2">
				<button class="control" data-variant="primary" disabled={!!createClient.pending} aria-busy={!!createClient.pending}>{createClient.pending ? "Saving…" : "Save client"}</button><button type="button" class="control" disabled={!!createClient.pending} onclick={() => (creating = false)}>Cancel</button>
			</div>
		</form>
	{/if}
	{#if saved}<p role="status" class="mb-6">Client saved. <a class="text-field underline underline-offset-4" href={`/pipeline?client=${saved}`}>Create a linked opportunity</a></p>{/if}
	<div class="max-w-sm"><label for="client-search" class="mb-2 block font-medium">Search clients</label><input id="client-search" type="search" bind:value={search} disabled={!ready} class="field" placeholder="Client name" /></div>
	<div class="border-hairline divide-hairline mt-6 divide-y rounded-xl border bg-white">
		{#each filtered as client (client.id)}
			<div class="flex min-w-0 flex-wrap items-center justify-between gap-3 px-5 py-4">
				<div class="min-w-0">
					<p class="font-medium wrap-anywhere">{client.name}</p>
					<p class="text-muted mt-1">{workspace.links.filter((link) => link.clientId === client.id).length} linked opportunities</p>
				</div>
				<a class="control" href={`/pipeline?client=${client.id}`}>New opportunity<span class="sr-only"> for {client.name}</span></a>
			</div>
		{:else}<p class="text-muted p-5">{search ? "No clients match your search." : "No clients yet. Add a client to get started."}</p>{/each}
	</div>
</div>
