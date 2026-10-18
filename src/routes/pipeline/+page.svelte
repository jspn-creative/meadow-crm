<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { page } from "$app/state";
	import { getWorkspace } from "#lib/crm.remote.js";
	import OpportunityEditor from "#lib/pipeline/OpportunityEditor.svelte";
	import { opportunityDraft, safeReferenceUrl, type OpportunityDraft } from "#lib/pipeline/opportunity-draft.js";
	import { workspaceData } from "#lib/data/workspace.js";
	import ChecklistStep from "#lib/pipeline/ChecklistStep.svelte";
	import { stageLabels, typeLabels, timelineLabels } from "#lib/pipeline/labels.js";
	const remote = getWorkspace({ archived: false });
	await remote;
	const data = workspaceData(remote);
	onDestroy(() => data.dispose());
	let workspace = $derived(await remote);
	let creating = $state(false);
	let opportunityId = $state("");
	let drafts = $state<Record<string, OpportunityDraft>>({});
	let editing = $state(false);
	let selectedId = $state(page.url.searchParams.get("opportunity") ?? "");
	let inspectedStage = $state(page.url.searchParams.get("stage") ?? "");
	let failure = $state("");
	let pending = $state(false);
	let status = $state("");
	let ready = $state(false);
	let filterType = $state("all");
	let filterTimeline = $state("all");
	let filterTag = $state("all");
	onMount(() => {
		ready = true;
	});
	let selected = $derived(workspace.opportunities.find((row) => row.id === selectedId));
	let checklist = $derived(selected && (workspace.checklists.find((list) => list.opportunityId === selected.id && list.stage === (inspectedStage || selected.stage)) ?? workspace.checklists.find((list) => list.opportunityId === selected.id && list.stage === selected.stage)));
	let clientById = $derived(new Map(workspace.referenceClients.map((client) => [client.id, client])));
	let allTags = $derived([...new Map(workspace.referenceClients.flatMap((client) => client.tags.map((tag) => [tag.id, tag]))).values()]);
	const timelineRank = (timeline: string | null) => (timeline === "1-3-mo" ? 0 : timeline === "3-6-mo" ? 1 : timeline === "6-plus-mo" ? 2 : 3);
	let visible = $derived(
		workspace.opportunities
			.filter((opportunity) => {
				if (filterType !== "all" && opportunity.type !== filterType) return false;
				if (filterTimeline !== "all" && opportunity.timeline !== filterTimeline) return false;
				if (filterTag !== "all") {
					const linked = workspace.links.filter((link) => link.opportunityId === opportunity.id).map((link) => link.clientId);
					if (!linked.some((clientId) => clientById.get(clientId)?.tags.some((tag) => tag.id === filterTag))) return false;
				}
				return true;
			})
			.sort((a, b) => timelineRank(a.timeline) - timelineRank(b.timeline)),
	);
	const stages = Object.keys(stageLabels) as (keyof typeof stageLabels)[];
	function newOpportunity() {
		if (!opportunityId) {
			opportunityId = crypto.randomUUID();
			drafts[opportunityId] = opportunityDraft(workspace, opportunityId, page.url.searchParams.get("client") ?? undefined);
		}
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

	async function moveCard(opportunity: (typeof visible)[number], stage: keyof typeof stageLabels) {
		if (stage === opportunity.stage) return;
		pending = true;
		failure = "";
		status = "Moving opportunity…";
		try {
			await data.move({ requestId: crypto.randomUUID(), id: opportunity.id, revision: opportunity.revision, stage });
			status = "Stage saved.";
		} catch {
			failure = "Stage could not be saved or has changed. The move was rolled back. Refresh before retrying.";
			status = "";
		} finally {
			pending = false;
		}
	}

	async function archive(opportunity: (typeof visible)[number]) {
		pending = true;
		failure = "";
		status = "Archiving opportunity…";
		try {
			await data.archive({ requestId: crypto.randomUUID(), id: opportunity.id, revision: opportunity.revision });
			if (selected && opportunity.id === selected.id) selectedId = "";
			status = "Opportunity archived.";
		} catch {
			failure = "Opportunity could not be archived or has changed. Refresh before retrying.";
			status = "";
		} finally {
			pending = false;
		}
	}

	async function deleteOpportunityFn(opportunity: { id: string; revision: number }) {
		if (!confirm("Delete this opportunity? This cannot be undone.")) return;
		pending = true;
		failure = "";
		status = "Deleting opportunity…";
		try {
			await data.delete({ requestId: crypto.randomUUID(), id: opportunity.id, revision: opportunity.revision });
			if (selected && opportunity.id === selected.id) selectedId = "";
			if (selectedId === opportunity.id) selectedId = "";
			status = "Opportunity deleted.";
		} catch {
			failure = "Opportunity could not be deleted or has changed. Refresh before retrying.";
			status = "";
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head><title>Pipeline · Meadow Lane</title></svelte:head>

<div class="surface-content @container/board">
	<p role="status" aria-live="polite" class="text-muted mb-3 text-xs">{status}</p>
	{#if failure}<p role="alert" class="text-urgent mb-3 text-xs">{failure}</p>{/if}
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<p class="text-muted max-w-lg">Four stages, one shared board.</p>
		<button type="button" class="control" onclick={newOpportunity} disabled={!ready}>New opportunity</button>
		<a class="control" href="/pipeline/archived">View archived opportunities</a>
	</div>
	<div class="mb-4 flex flex-wrap items-center gap-3">
		<label class="flex shrink-0 items-center gap-1.5"
			><span class="text-muted text-xs">Type</span><select class="field" aria-label="Type" value={filterType} onchange={(event) => (filterType = event.currentTarget.value as string)}
				><option value="all">All types</option>{#each Object.entries(typeLabels) as [value, label] (value)}
					<option {value}>{label}</option>{/each}</select
			></label>
		<label class="flex shrink-0 items-center gap-1.5"
			><span class="text-muted text-xs">Timeline</span><select class="field" aria-label="Timeline" value={filterTimeline} onchange={(event) => (filterTimeline = event.currentTarget.value as string)}
				><option value="all">All timelines</option>{#each Object.entries(timelineLabels) as [value, label] (value)}
					<option {value}>{label}</option>{/each}</select
			></label>
		<label class="flex shrink-0 items-center gap-1.5"
			><span class="text-muted text-xs">Tag</span><select class="field" aria-label="Tag" value={filterTag} onchange={(event) => (filterTag = event.currentTarget.value as string)}
				><option value="all">All tags</option>{#each allTags as tag (tag.id)}<option value={tag.id}>{tag.name}</option>{/each}
			</select></label>
		<p class="text-muted shrink-0 text-xs">Sorted by timeline within each stage.</p>
	</div>
	<div class="grid gap-5 pb-4 @min-[30rem]/board:grid-cols-2 @min-[56rem]/board:grid-cols-4">
		{#each stages as stage (stage)}
			{@const rows = visible.filter((row) => row.stage === stage)}
			<section aria-label={stageLabels[stage]} class="min-w-0">
				<h2 class="border-hairline mb-4 flex items-center justify-between border-b pb-3 text-sm font-medium">{stageLabels[stage]}<span class="text-muted text-xs">{rows.length}</span></h2>
				<div class="space-y-3">
					{#each rows as opportunity (opportunity.id)}
						<div class="space-y-2">
							<button
								type="button"
								disabled={!ready}
								class="border-hairline hover:bg-canvas w-full rounded-xl border bg-white p-5 text-left"
								onclick={() => {
									selectedId = opportunity.id;
									editing = false;
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
							<div class="flex flex-wrap items-center gap-2">
								<label for={`card-stage-${opportunity.id}`} class="text-muted shrink-0 text-xs">Move to stage</label>
								<select id={`card-stage-${opportunity.id}`} class="field" value={opportunity.stage} disabled={pending} onchange={(event) => moveCard(opportunity, event.currentTarget.value as keyof typeof stageLabels)}
									>{#each stages as stage (stage)}<option value={stage}>{stageLabels[stage]}</option>{/each}</select>
								<button type="button" class="control" disabled={!ready || pending} onclick={() => archive(opportunity)}>Archive</button>
								<button type="button" class="control" disabled={!ready || pending} onclick={() => deleteOpportunityFn(opportunity)}>Delete</button>
							</div>
						</div>
					{:else}<p class="text-muted py-4 text-xs">No opportunities in this stage.</p>{/each}
				</div>
			</section>
		{/each}
	</div>
</div>

{#if creating}
	<dialog
		{@attach showDialog}
		aria-labelledby="create-heading"
		class="bg-canvas text-ink shadow-panel backdrop:bg-ink/30 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl p-0"
		oncancel={(event) => {
			if (pending) event.preventDefault();
			else creating = false;
		}}
		onclose={() => (creating = false)}>
		<div class="@container/opportunity p-5 sm:p-8">
			<div class="mb-6 flex items-start justify-between gap-4">
				<h2 id="create-heading" class="font-display text-3xl">New opportunity</h2>
				<button type="button" class="control" disabled={pending} onclick={() => (creating = false)}>Close</button>
			</div>
			<OpportunityEditor
				bind:draft={drafts[opportunityId]!}
				{workspace}
				{remote}
				bind:pending
				cancel={() => (creating = false)}
				saved={() => {
					creating = false;
					selectedId = opportunityId;
					delete drafts[opportunityId];
					opportunityId = "";
					editing = false;
				}} />
		</div>
	</dialog>
{/if}

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
					{#if editing}
						<OpportunityEditor
							bind:draft={drafts[selected.id]!}
							{workspace}
							{remote}
							bind:pending
							cancel={() => (editing = false)}
							saved={() => {
								if (selected) delete drafts[selected.id];
								editing = false;
								inspectedStage = "";
								status = "Opportunity saved.";
							}} />
					{:else}
						<button
							type="button"
							class="control"
							disabled={pending}
							onclick={() => {
								if (selected) {
									drafts[selected.id] ??= opportunityDraft(workspace, selected.id);
									editing = true;
								}
							}}>Edit opportunity</button>
						<button type="button" class="control" disabled={!ready || pending} onclick={() => selected && archive(selected)}>Archive opportunity</button>
						<button type="button" class="control" disabled={!ready || pending} onclick={() => selected && deleteOpportunityFn(selected)}>Delete opportunity</button>
						{#if drafts[selected.id]}<p class="text-muted text-xs">An unsaved editing draft is retained.</p>
							<button
								type="button"
								class="control"
								disabled={pending}
								onclick={() => {
									if (selected) delete drafts[selected.id];
								}}>Discard editing draft</button
							>{/if}
						<div>
							<h3 class="mb-2 font-medium">Linked clients</h3>
							<p class="text-muted wrap-anywhere">
								{workspace.links
									.filter((link) => link.opportunityId === selected?.id)
									.map((link) => workspace.referenceClients.find((client) => client.id === link.clientId)?.name)
									.filter(Boolean)
									.join(", ")}
							</p>
						</div>
						<div class="space-y-2">
							<label for="selected-stage" class="block font-medium">Pipeline stage</label><select id="selected-stage" class="field" value={selected.stage} disabled={pending} onchange={(event) => move(event.currentTarget.value as keyof typeof stageLabels)}
								>{#each stages as stage (stage)}<option value={stage}>{stageLabels[stage]}</option>{/each}</select>
						</div>
						<p class="text-muted">Moving stages keeps work from each visited stage. Return to a stage to continue its checklist.</p>
						<dl class="space-y-3">
							<div>
								<dt class="font-medium">Timeline</dt>
								<dd class="text-muted">{selected.timeline === "1-3-mo" ? "1–3 mo" : selected.timeline === "3-6-mo" ? "3–6 mo" : selected.timeline === "6-plus-mo" ? "6+ mo" : "Not set"}</dd>
							</div>
							<div>
								<dt class="font-medium">Property address</dt>
								<dd class="text-muted wrap-anywhere">{selected.address || "Not set"}</dd>
							</div>
							<div>
								<dt class="font-medium">Budget (USD)</dt>
								<dd class="text-muted tabular-nums">{selected.budgetCents == null ? "Not set" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(selected.budgetCents / 100)}</dd>
							</div>
						</dl>
						<section>
							<h3 class="mb-2 font-medium">Notes</h3>
							<p class="text-muted wrap-anywhere whitespace-pre-wrap">{selected.notes || "No notes yet."}</p>
						</section>
						<section class="space-y-2" aria-label="References">
							<h3 class="font-medium">References</h3>
							{#each workspace.references.filter((reference) => reference.opportunityId === selected?.id) as reference (reference.id)}
								{@const href = reference.kind === "url" ? safeReferenceUrl(reference.url) : reference.kind === "client" ? `/registry?client=${encodeURIComponent(reference.targetClientId ?? "")}` : `/pipeline?opportunity=${encodeURIComponent(reference.targetOpportunityId ?? "")}`}
								{#if href}<a
										class="text-field block min-h-11 py-2 wrap-anywhere underline underline-offset-4"
										{href}
										target={reference.kind === "url" ? "_blank" : undefined}
										rel={reference.kind === "url" ? "noopener noreferrer" : undefined}
										onclick={reference.kind === "opportunity"
											? (event) => {
													const target = workspace.opportunities.find((row) => row.id === reference.targetOpportunityId);
													if (target) {
														event.preventDefault();
														selectedId = target.id;
														editing = false;
														inspectedStage = "";
													}
												}
											: undefined}>{reference.label}{reference.kind === "url" ? " (opens a new tab)" : ""}</a
									>{:else}<p class="text-muted wrap-anywhere">{reference.label} · unsafe link unavailable</p>{/if}
							{:else}<p class="text-muted">No references yet.</p>{/each}
						</section>
						<details class="border-hairline border-t pt-4">
							<summary class="min-h-11 cursor-pointer font-medium">History</summary>
							<ol class="mt-3 space-y-4">
								{#each workspace.history.filter((change) => change.recordId === selected?.id) as change (change.id)}<li class="min-w-0 text-xs">
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
				<section class="border-hairline min-w-0 border-t pt-6 @min-[38rem]/opportunity:border-t-0 @min-[38rem]/opportunity:border-l @min-[38rem]/opportunity:pt-0 @min-[38rem]/opportunity:pl-6" aria-label="Inspected-stage checklist" aria-busy={pending}>
					<h3 class="font-display text-2xl">{stageLabels[checklist?.stage ?? selected.stage]} checklist</h3>
					{#if checklist && checklist.stage !== selected.stage}<p class="text-muted my-2">Inspecting prior-stage work. The opportunity remains in {stageLabels[selected.stage]}.</p>
						<button class="control" type="button" disabled={pending} onclick={() => (inspectedStage = "")}>Return to current checklist</button>{/if}
					{#if checklist}
						<p class="text-muted mt-2 text-xs">{checklist.items.filter((item) => item.completedAt).length} of {checklist.items.length} complete</p>
						{#each checklist.items as item, index (`${checklist.id}:${item.id}`)}
							<div class="flex items-start gap-2">
								<div class="min-w-0 flex-1"><ChecklistStep {item} {checklist} busy={pending} save={saveStep} /></div>
								<div class="flex shrink-0 flex-col gap-1 pt-4">
									<button
										type="button"
										class="control text-xs"
										disabled={pending || index === 0}
										onclick={async () => {
											if (!checklist) return;
											const ids = checklist.items.map((row) => row.id);
											const [moved] = ids.splice(index, 1);
											ids.splice(index - 1, 0, moved);
											pending = true;
											try {
												await data.reorderChecklistItems({ requestId: crypto.randomUUID(), checklistId: checklist.id, revision: checklist.revision, itemIds: ids });
											} catch {
												failure = "Could not reorder. Refresh before retrying.";
											} finally {
												pending = false;
											}
										}}>↑</button>
									<button
										type="button"
										class="control text-xs"
										disabled={pending || index === checklist.items.length - 1}
										onclick={async () => {
											if (!checklist) return;
											const ids = checklist.items.map((row) => row.id);
											const [moved] = ids.splice(index, 1);
											ids.splice(index + 1, 0, moved);
											pending = true;
											try {
												await data.reorderChecklistItems({ requestId: crypto.randomUUID(), checklistId: checklist.id, revision: checklist.revision, itemIds: ids });
											} catch {
												failure = "Could not reorder. Refresh before retrying.";
											} finally {
												pending = false;
											}
										}}>↓</button>
									<button
										type="button"
										class="control text-xs"
										disabled={pending}
										onclick={async () => {
											if (!checklist) return;
											const next = prompt("New title", item.title);
											if (!next || next === item.title) return;
											pending = true;
											try {
												await data.renameChecklistItem({ requestId: crypto.randomUUID(), checklistId: checklist.id, revision: checklist.revision, itemId: item.id, itemRevision: item.revision, title: next });
											} catch {
												failure = "Could not rename. Refresh before retrying.";
											} finally {
												pending = false;
											}
										}}>Edit</button>
									<button
										type="button"
										class="control text-xs"
										disabled={pending}
										onclick={async () => {
											if (!checklist) return;
											if (!confirm("Remove this step?")) return;
											pending = true;
											try {
												await data.removeChecklistItem({ requestId: crypto.randomUUID(), checklistId: checklist.id, revision: checklist.revision, itemId: item.id });
											} catch {
												failure = "Could not remove. Refresh before retrying.";
											} finally {
												pending = false;
											}
										}}>Remove</button>
								</div>
							</div>
						{:else}<p class="text-muted py-6">No steps in this stage’s defaults.</p>{/each}
						<div class="mt-3">
							<button
								type="button"
								class="control"
								disabled={pending || !ready}
								onclick={async () => {
									if (!checklist) return;
									const title = prompt("New step");
									if (!title) return;
									pending = true;
									try {
										await data.addChecklistItem({ requestId: crypto.randomUUID(), checklistId: checklist.id, revision: checklist.revision, title });
									} catch {
										failure = "Could not add step. Refresh before retrying.";
									} finally {
										pending = false;
									}
								}}>Add step</button>
						</div>
					{:else}<p class="text-muted py-6">Loading this stage’s checklist…</p>{/if}
				</section>
			</div>
		</div>
	</dialog>
{/if}
