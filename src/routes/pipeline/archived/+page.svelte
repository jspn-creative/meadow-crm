<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { getWorkspace, restoreOpportunity } from "#lib/crm.remote.js";
	import { workspaceData } from "#lib/data/workspace.js";
	import { stageLabels, typeLabels } from "#lib/pipeline/labels.js";
	const remote = getWorkspace({ archived: true });
	await remote;
	const data = workspaceData(remote);
	onDestroy(() => data.dispose());
	let workspace = $derived(await remote);
	let failure = $state("");
	let pending = $state(false);
	let status = $state("");
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	async function restore(opportunity: (typeof workspace.opportunities)[number]) {
		pending = true;
		failure = "";
		status = "Restoring opportunity…";
		try {
			await data.restore({ requestId: crypto.randomUUID(), id: opportunity.id, revision: opportunity.revision });
			status = "Opportunity restored.";
		} catch {
			failure = "Opportunity could not be restored or has changed. Refresh before retrying.";
			status = "";
		} finally {
			pending = false;
		}
	}
	function clientNames(opportunity: (typeof workspace.opportunities)[number]) {
		return workspace.links
			.filter((link) => link.opportunityId === opportunity.id)
			.map((link) => workspace.clients.find((client) => client.id === link.clientId)?.name)
			.filter(Boolean)
			.join(", ");
	}
</script>

<svelte:head><title>Archived opportunities · Meadow Lane</title></svelte:head>

<div class="surface-content @container/board">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<h2 class="font-display text-2xl">Archived opportunities</h2>
		<a class="control" href="/pipeline">Back to board</a>
	</div>
	<p class="text-muted max-w-lg">Opportunities hidden from the board. Restore one to bring it back to its stage.</p>
	<p role="status" aria-live="polite" class="text-muted mb-3 text-xs">{status}</p>
	{#if failure}<p role="alert" class="text-urgent mb-3 text-xs">{failure}</p>{/if}
	<div class="space-y-3">
		{#each workspace.opportunities as opportunity (opportunity.id)}
			<div class="border-hairline rounded-xl border bg-white p-5">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<span class="text-info bg-info-soft inline-block rounded-md px-2 py-1 text-xs">{typeLabels[opportunity.type]}</span>
						<span class="mt-2 block font-medium wrap-anywhere">{opportunity.title}</span>
						<span class="text-muted mt-1 block text-xs wrap-anywhere">{stageLabels[opportunity.stage]}</span>
						<span class="text-muted mt-1 block text-xs wrap-anywhere">{clientNames(opportunity) || "No linked clients"}</span>
					</div>
					<button type="button" class="control" disabled={!ready || pending} onclick={() => restore(opportunity)}>{pending ? "Restoring…" : "Restore"}</button>
				</div>
			</div>
		{:else}
			<p class="text-muted py-5 text-xs">No archived opportunities.</p>
		{/each}
	</div>
	{#if failure}
		<button
			class="control"
			type="button"
			disabled={pending}
			onclick={async () => {
				await remote.refresh();
				failure = "";
			}}>Refresh records</button>
	{/if}
</div>
