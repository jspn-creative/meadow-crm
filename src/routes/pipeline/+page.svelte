<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { page } from "$app/state";
	import { createOpportunity, getWorkspace } from "#lib/crm.remote.js";
	import { workspaceData } from "#lib/data/workspace.js";
	import ChecklistStep from "#lib/pipeline/ChecklistStep.svelte";
	import { stageLabels, typeLabels } from "#lib/pipeline/labels.js";
	const remote = getWorkspace({ archived: false });
	await remote;
	const data = workspaceData(remote);
	onDestroy(() => data.dispose());
	let workspace = $derived(await remote);
	let creating = $state(false);
	let opportunityId = $state("");
	let requestId = $state("");
	let selectedId = $state(page.url.searchParams.get("opportunity") ?? "");
	let inspectedStage = $state(page.url.searchParams.get("stage") ?? "");
	let failure = $state("");
	let pending = $state(false);
	let status = $state("");
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	let selected = $derived(workspace.opportunities.find((row) => row.id === selectedId));
	let checklist = $derived(selected && (workspace.checklists.find((list) => list.opportunityId === selected.id && list.stage === (inspectedStage || selected.stage)) ?? workspace.checklists.find((list) => list.opportunityId === selected.id && list.stage === selected.stage)));
	const stages = Object.keys(stageLabels) as (keyof typeof stageLabels)[];
	function newOpportunity() {
		opportunityId = crypto.randomUUID();
		requestId = crypto.randomUUID();
		failure = "";
		creating = true;
	}
	function showDialog(dialog: HTMLDialogElement) {
		const opener = document.activeElement;
		dialog.showModal();
		return () => {
			dialog.close();
			if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
		};
	}
	async function saveStep(input: Parameters<typeof data.saveStep>[0] extends infer T ? Omit<T, "requestId"> : never) {
		pending = true;
		failure = "";
		status = "Saving step…";
		try {
			await data.saveStep({ ...input, requestId: crypto.randomUUID() });
			status = "Step saved.";
		} catch {
			failure = "Step could not be saved or has changed. Your draft is retained. Refresh before retrying.";
			status = "";
		} finally {
			pending = false;
		}
	}
	async function move(stage: keyof typeof stageLabels) {
		if (!selected || stage === selected.stage) return;
		pending = true;
		failure = "";
		status = "Moving opportunity…";
		try {
			await data.move({ requestId: crypto.randomUUID(), id: selected.id, revision: selected.revision, stage });
			inspectedStage = "";
			status = "Stage saved.";
		} catch {
			failure = "Stage could not be saved or has changed. The move was rolled back. Refresh before retrying.";
			status = "";
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head><title>Pipeline · Meadow Lane</title></svelte:head>

<div class="surface-content @container/board">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<p class="text-muted max-w-lg">Four stages, one shared board.</p>
		<button type="button" class="control" onclick={newOpportunity} disabled={!ready || creating || workspace.clients.length === 0}>New opportunity</button>
	</div>
	{#if workspace.clients.length === 0}<p class="mb-6">Start with a client in the <a class="text-field underline underline-offset-4" href="/registry">Registry</a>.</p>{/if}
	{#if creating}
		<form
			class="border-hairline mb-8 max-w-2xl space-y-4 border-b pb-6"
			{...createOpportunity.enhance(async (form) => {
				failure = "";
				try {
					if (await form.submit().updates(remote)) {
						creating = false;
						selectedId = opportunityId;
						form.element.reset();
					}
				} catch {
					failure = "Opportunity could not be saved. Your draft is retained; check the client and try again.";
				}
			})}>
			<h2 class="font-display text-2xl">New opportunity</h2>
			<input {...createOpportunity.fields.id.as("hidden", opportunityId)} />
			<input {...createOpportunity.fields.requestId.as("hidden", requestId)} />
			<label class="block space-y-2"><span class="font-medium">Opportunity title</span><input class="field" {...createOpportunity.fields.title.as("text")} required maxlength="200" /></label>
			<div class="space-y-2">
				<label for="opportunity-client" class="block font-medium">Client</label><select id="opportunity-client" class="field" {...createOpportunity.fields.clientId.as("select", page.url.searchParams.get("client") ?? workspace.clients[0]?.id)} required
					>{#each workspace.clients as client (client.id)}<option value={client.id}>{client.name}</option>{/each}</select>
			</div>
			<div class="grid gap-4 @min-[28rem]/board:grid-cols-2">
				<div class="space-y-2">
					<label for="opportunity-type" class="block font-medium">Type</label><select id="opportunity-type" class="field" {...createOpportunity.fields.type.as("select", "buyer")}
						>{#each Object.entries(typeLabels) as [value, label] (value)}<option {value}>{label}</option>{/each}</select>
				</div>
				<div class="space-y-2">
					<label for="opportunity-stage" class="block font-medium">Initial stage</label><select id="opportunity-stage" class="field" {...createOpportunity.fields.stage.as("select", "new-lead")}
						>{#each stages as stage (stage)}<option value={stage}>{stageLabels[stage]}</option>{/each}</select>
				</div>
			</div>
			{#each createOpportunity.fields.allIssues() ?? [] as issue (issue)}<p class="text-urgent" role="alert">{issue.message}</p>{/each}
			{#if failure}<p class="text-urgent" role="alert">{failure}</p>{/if}
			<div class="flex flex-wrap gap-2">
				<button class="control" data-variant="primary" disabled={!!createOpportunity.pending} aria-busy={!!createOpportunity.pending}>{createOpportunity.pending ? "Saving…" : "Save opportunity"}</button><button type="button" class="control" disabled={!!createOpportunity.pending} onclick={() => (creating = false)}
					>Cancel</button>
			</div>
		</form>
	{/if}
	<div class="grid gap-5 pb-4 @min-[30rem]/board:grid-cols-2 @min-[56rem]/board:grid-cols-4">
		{#each stages as stage (stage)}
			{@const rows = workspace.opportunities.filter((row) => row.stage === stage)}
			<section aria-label={stageLabels[stage]} class="min-w-0">
				<h2 class="border-hairline mb-4 flex items-center justify-between border-b pb-3 text-sm font-medium">{stageLabels[stage]}<span class="text-muted text-xs">{rows.length}</span></h2>
				<div class="space-y-3">
					{#each rows as opportunity (opportunity.id)}
						<button
							type="button"
							disabled={!ready}
							class="border-hairline hover:bg-canvas w-full rounded-xl border bg-white p-5 text-left"
							onclick={() => {
								selectedId = opportunity.id;
								inspectedStage = "";
								failure = "";
								status = "";
							}}>
							<span class="text-info bg-info-soft inline-block rounded-md px-2 py-1 text-xs">{typeLabels[opportunity.type]}</span>
							<span class="mt-4 block font-medium wrap-anywhere">{opportunity.title}</span>
							<span class="text-muted mt-1 block text-xs wrap-anywhere"
								>{workspace.links
									.filter((link) => link.opportunityId === opportunity.id)
									.map((link) => workspace.clients.find((client) => client.id === link.clientId)?.name)
									.filter(Boolean)
									.join(", ")}</span>
						</button>
					{:else}<p class="text-muted py-4 text-xs">No opportunities in this stage.</p>{/each}
				</div>
			</section>
		{/each}
	</div>
</div>

{#if selected}
	<dialog
		{@attach showDialog}
		aria-labelledby="opportunity-heading"
		class="bg-canvas text-ink shadow-panel backdrop:bg-ink/30 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-2xl p-0"
		oncancel={(event) => {
			if (pending) event.preventDefault();
			else selectedId = "";
		}}
		onclose={() => (selectedId = "")}>
		<div class="@container/opportunity p-5 @min-[38rem]/opportunity:p-8">
			<div class="mb-6 flex items-start justify-between gap-4">
				<div class="min-w-0">
					<h2 id="opportunity-heading" class="font-display text-3xl wrap-anywhere">{selected.title}</h2>
					<p class="text-muted mt-2">{typeLabels[selected.type]} · {stageLabels[selected.stage]}</p>
				</div>
				<button class="control" type="button" disabled={pending} onclick={() => (selectedId = "")}>Close</button>
			</div>
			<div class="grid min-w-0 gap-8 @min-[38rem]/opportunity:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
				<div class="min-w-0 space-y-5">
					<div>
						<h3 class="mb-2 font-medium">Linked clients</h3>
						<p class="text-muted wrap-anywhere">
							{workspace.links
								.filter((link) => link.opportunityId === selected?.id)
								.map((link) => workspace.clients.find((client) => client.id === link.clientId)?.name)
								.filter(Boolean)
								.join(", ")}
						</p>
					</div>
					<div class="space-y-2">
						<label for="selected-stage" class="block font-medium">Pipeline stage</label><select id="selected-stage" class="field" value={selected.stage} disabled={pending} onchange={(event) => move(event.currentTarget.value as keyof typeof stageLabels)}
							>{#each stages as stage (stage)}<option value={stage}>{stageLabels[stage]}</option>{/each}</select>
					</div>
					<p class="text-muted">Moving stages keeps work from each visited stage. Return to a stage to continue its checklist.</p>
					<p role="status" aria-live="polite">{status}</p>
					{#if failure}<p role="alert" class="text-urgent">{failure}</p>
						<button
							class="control"
							type="button"
							disabled={pending}
							onclick={async () => {
								await remote.refresh();
								failure = "";
							}}>Refresh records</button
						>{/if}
				</div>
				<section class="min-w-0" aria-label="Inspected-stage checklist" aria-busy={pending}>
					<h3 class="font-display text-2xl">{stageLabels[checklist?.stage ?? selected.stage]} checklist</h3>
					{#if checklist && checklist.stage !== selected.stage}<p class="text-muted my-2">Inspecting prior-stage work. The opportunity remains in {stageLabels[selected.stage]}.</p>
						<button class="control" type="button" disabled={pending} onclick={() => (inspectedStage = "")}>Return to current checklist</button>{/if}
					{#if checklist}
						<p class="text-muted mt-2 text-xs">{checklist.items.filter((item) => item.completedAt).length} of {checklist.items.length} complete</p>
						{#each checklist.items as item (`${checklist.id}:${item.id}`)}<ChecklistStep {item} {checklist} busy={pending} save={saveStep} />{:else}<p class="text-muted py-6">No steps in this stage’s defaults.</p>{/each}
					{:else}<p class="text-muted py-6">Loading this stage’s checklist…</p>{/if}
				</section>
			</div>
		</div>
	</dialog>
{/if}
