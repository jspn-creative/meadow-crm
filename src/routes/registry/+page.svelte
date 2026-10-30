<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import { createClient, getWorkspace } from "#lib/crm.remote.js";
	import ClientEditor from "#lib/registry/ClientEditor.svelte";
	import { clientDraft, newClientDraft, type ClientDraft } from "#lib/registry/client-draft.js";
	const remote = getWorkspace({ archived: false });
	let workspace = $derived(await remote);
	let search = $derived(workspace.referenceClients.find((client) => client.id === page.url.searchParams.get("client"))?.name ?? "");
	let dialog: HTMLDialogElement | undefined = $state();
	let opener: HTMLElement | null = null;
	let creating = $state(false);
	let clientId = $state("");
	let requestId = $state("");
	let newName = $state("");
	let draft = $state<ClientDraft | null>(null);
	let pending = $state(false);
	let failure = $state("");
	let saved = $state("");
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	let filtered = $derived(workspace.clients.filter((client) => client.name.toLowerCase().includes(search.toLowerCase())));
	let linked = $derived(draft ? workspace.links.filter((link) => link.clientId === draft?.id) : []);
	let changes = $derived(draft ? workspace.history.filter((change) => change.recordKind === "client" && change.recordId === draft?.id) : []);
	function openPanel() {
		opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		failure = "";
		saved = "";
		dialog?.showModal();
	}
	function newClient() {
		clientId = crypto.randomUUID();
		requestId = crypto.randomUUID();
		newName = "";
		draft = null;
		creating = true;
		openPanel();
	}
	function editClient(id: string) {
		const record = workspace.clients.find((client) => client.id === id);
		if (!record) return;
		creating = false;
		draft = clientDraft(record);
		openPanel();
	}
	function closePanel() {
		dialog?.close();
	}
	function onclose() {
		creating = false;
		draft = null;
		opener?.focus();
		opener = null;
	}
</script>

<svelte:head><title>Registry · Meadow Lane</title></svelte:head>

<div class="surface-content @container/registry">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<p class="text-muted max-w-lg">Clients and their linked opportunities.</p>
		<button type="button" class="control" onclick={newClient} disabled={!ready}>New client</button>
	</div>
	{#if saved}<p role="status" class="mb-6">{saved}</p>{/if}
	<div class="max-w-sm"><label for="client-search" class="mb-2 block font-medium">Search clients</label><input id="client-search" type="search" bind:value={search} disabled={!ready} class="field" placeholder="Client name" /></div>
	<div class="surface divide-hairline mt-6 divide-y">
		{#each filtered as client (client.id)}
			<div class="flex min-w-0 flex-wrap items-center justify-between gap-3 px-5 py-4">
				<div class="min-w-0">
					<button type="button" class="text-action text-left wrap-anywhere" disabled={!ready} onclick={() => editClient(client.id)}>{client.name}</button>
					<p class="text-muted mt-1">{workspace.links.filter((link) => link.clientId === client.id).length} linked opportunities</p>
				</div>
				<a class="control" href={`/pipeline?client=${client.id}`}>New opportunity<span class="sr-only"> for {client.name}</span></a>
			</div>
		{:else}<p class="text-muted p-5">{search ? "No clients match your search." : "No clients yet. Add a client to get started."}</p>{/each}
	</div>
</div>

<dialog bind:this={dialog} {onclose} aria-labelledby="client-panel-heading" class="dialog" data-placement="side">
	<div class="@container/client-panel p-5 sm:p-8">
		<div class="mb-6 flex items-start justify-between gap-4">
			<h2 id="client-panel-heading" class="font-display min-w-0 text-3xl wrap-anywhere">{creating ? "New client" : draft?.name || "Client"}</h2>
			<button type="button" class="control" disabled={pending} onclick={closePanel}>Close</button>
		</div>
		{#if creating}
			<form
				class="space-y-4"
				{...createClient.enhance(async (form) => {
					failure = "";
					try {
						if (await form.submit().updates(remote)) {
							draft = newClientDraft(clientId, newName.trim());
							creating = false;
							saved = "Client created. Add the rest of their details below.";
						}
					} catch {
						failure = "Client could not be created. Your name is retained; try again.";
					}
				})}>
				<input {...createClient.fields.id.as("hidden", clientId)} />
				<input {...createClient.fields.requestId.as("hidden", requestId)} />
				<label class="block space-y-2"><span class="font-medium">Client name</span><input class="field" {...createClient.fields.name.as("text")} oninput={(event) => (newName = event.currentTarget.value)} required maxlength="200" autocomplete="off" /></label>
				{#each createClient.fields.allIssues() ?? [] as issue (issue)}<p class="text-urgent" role="alert">{issue.message}</p>{/each}
				{#if failure}<p class="text-urgent" role="alert">{failure}</p>{/if}
				<div class="flex flex-wrap gap-2">
					<button class="control" data-variant="primary" disabled={!!createClient.pending} aria-busy={!!createClient.pending}>{createClient.pending ? "Saving…" : "Create client"}</button>
				</div>
			</form>
		{:else if draft}
			<ClientEditor bind:draft bind:pending {workspace} {remote} saved={() => (saved = "Client saved.")} />
			<section class="border-hairline mt-10 min-w-0 space-y-3 border-t pt-6" aria-labelledby="client-opportunities">
				<h3 id="client-opportunities" class="font-display text-2xl">Opportunities</h3>
				{#each linked as link (link.opportunityId)}
					{@const opportunity = workspace.opportunities.find((row) => row.id === link.opportunityId)}
					{#if opportunity}<a class="control w-full justify-start text-left wrap-anywhere" href={`/pipeline?opportunity=${opportunity.id}`}>{opportunity.title}</a>{/if}
				{:else}<p class="text-muted">No opportunities yet.</p>{/each}
			</section>
			<details class="border-hairline mt-6 border-t pt-4">
				<summary class="min-h-11 cursor-pointer font-medium">History</summary>
				<ol class="mt-3 space-y-4">
					{#each changes as change (change.id)}<li class="min-w-0 text-xs">
							<p class="font-medium wrap-anywhere">{change.action} · {change.effectiveUserId}{change.actorUserId !== change.effectiveUserId ? ` (acting user: ${change.actorUserId})` : ""}</p>
							<time class="text-muted" datetime={change.createdAt}>{new Date(change.createdAt).toLocaleString("en-US", { timeZone: workspace.settings?.timezone ?? "America/New_York" })}</time>
							<details class="mt-2">
								<summary class="cursor-pointer py-2">Changed data</summary>
								<pre class="text-muted mt-2 wrap-anywhere whitespace-pre-wrap">{JSON.stringify(change.data, null, 2)}</pre>
							</details>
						</li>{:else}<li class="text-muted">No changes recorded.</li>{/each}
				</ol>
			</details>
		{/if}
	</div>
</dialog>
