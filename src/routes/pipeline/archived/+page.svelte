<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { getWorkspace, deleteOpportunity, restoreOpportunity } from "#lib/crm.remote.js";
	import { workspaceData } from "#lib/data/workspace.js";
	import { ArchiveRestore, ArrowLeft, RefreshCw, Trash2 } from "@lucide/svelte";
	import { stageLabels, stageTones, typeLabels, typeStyles } from "#lib/pipeline/labels.js";
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

	async function deleteOpportunityFn(opportunity: (typeof workspace.opportunities)[number]) {
		if (!confirm("Delete this opportunity? This cannot be undone.")) return;
		pending = true;
		failure = "";
		status = "Deleting opportunity…";
		try {
			await data.delete({ requestId: crypto.randomUUID(), id: opportunity.id, revision: opportunity.revision });
			status = "Opportunity deleted.";
		} catch {
			failure = "Opportunity could not be deleted or has changed. Refresh before retrying.";
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

<div class="surface-content @container/board" data-tight>
	<div class="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
		<a class="control" data-size="sm" href="/pipeline"><ArrowLeft size={15} aria-hidden="true" />Back to board</a>
		<p class="text-muted max-w-xl min-w-0 flex-1 basis-72 text-sm">Hidden from the board with every field, link, and its history kept. Restore one to return it to its stage.</p>
	</div>
	<p role="status" aria-live="polite" class="sr-only">{status}</p>
	{#if failure}
		<div role="alert" class="bg-urgent-soft text-urgent mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl py-1.5 pr-1.5 pl-4 text-sm [--action-color:var(--color-urgent)]">
			<span class="min-w-0 flex-1 basis-60 py-1">{failure}</span>
			<button
				class="control -ml-3"
				data-variant="ghost"
				data-size="sm"
				type="button"
				disabled={pending}
				onclick={async () => {
					await remote.refresh();
					failure = "";
				}}><RefreshCw size={15} aria-hidden="true" />Refresh records</button>
		</div>
	{/if}
	<h2 class="mb-3 flex items-baseline gap-2 text-sm font-semibold">Archived opportunities<span class="chip tabular-nums">{workspace.opportunities.length}</span></h2>
	<ul class="space-y-2">
		{#each workspace.opportunities as opportunity (opportunity.id)}
			{@const style = typeStyles[opportunity.type]}
			{@const Icon = style.icon}
			{@const clients = clientNames(opportunity)}
			<li id={`opportunity-${opportunity.id}`} class="surface flex flex-wrap items-center gap-x-4 gap-y-3 p-3 pr-4">
				<span class="chip shrink-0" data-tone={style.tone}><Icon size={17} aria-hidden="true" /></span>
				<div class="min-w-0 flex-1 basis-48">
					<p class="font-medium wrap-anywhere">{opportunity.title}</p>
					<p class="text-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs leading-5">
						<span>{typeLabels[opportunity.type]}</span><span aria-hidden="true">·</span>
						<span class="chip" data-tone={stageTones[opportunity.stage]} data-dot>{stageLabels[opportunity.stage]}</span><span aria-hidden="true">·</span>
						<span class="wrap-anywhere">{clients || "No linked clients"}</span>
					</p>
				</div>
				<div class="flex shrink-0 items-center gap-1.5 max-[30rem]:w-full max-[30rem]:justify-end">
					<button type="button" class="control" data-variant="danger" data-size="sm" disabled={!ready || pending} onclick={() => deleteOpportunityFn(opportunity)}><Trash2 size={15} aria-hidden="true" />Delete</button>
					<button type="button" class="control" data-size="sm" disabled={!ready || pending} onclick={() => restore(opportunity)}><ArchiveRestore size={15} aria-hidden="true" />Restore</button>
				</div>
			</li>
		{:else}
			<li class="text-muted border-hairline rounded-2xl border border-dashed px-4 py-8 text-center text-sm">No archived opportunities. Archive one from its card or detail view when the work has ended without closing.</li>
		{/each}
	</ul>
</div>
