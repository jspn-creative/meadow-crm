<script lang="ts">
	import { createOpportunityRecord, saveOpportunity } from "#lib/crm.remote.js";
	import type { Workspace } from "#lib/data/workspace.js";
	import type { OpportunityDraft } from "./opportunity-draft.js";
	import { stageLabels, typeLabels } from "./labels.js";
	let { draft = $bindable(), workspace, remote, saved, cancel, pending = $bindable(false) }: { draft: OpportunityDraft; workspace: Workspace; remote: ReturnType<typeof import("#lib/crm.remote.js").getWorkspace>; saved: () => void; cancel: () => void; pending?: boolean } = $props();
	let failure = $state("");
	let previousPayload = "";
	let requestId = "";
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		failure = "";
		if (draft.budget && !/^\d+(\.\d{1,2})?$/.test(draft.budget)) {
			failure = "Enter a non-negative USD amount with at most two decimal places. Your draft is retained.";
			return;
		}
		const [dollars, cents = ""] = draft.budget.split(".");
		const budgetCents = draft.budget ? Number(`${dollars}${cents.padEnd(2, "0")}`) : null;
		if (budgetCents !== null && !Number.isSafeInteger(budgetCents)) {
			failure = "This budget is too large. Your draft is retained.";
			return;
		}
		const input = {
			id: draft.id,
			title: draft.title,
			stage: draft.stage,
			clientIds: [...draft.clientIds],
			timeline: (draft.timeline || null) as Workspace["opportunities"][number]["timeline"],
			address: draft.address || null,
			budgetCents,
			notes: draft.notes,
			references: draft.references.map((reference) => (reference.kind === "url" ? { kind: "url" as const, label: reference.label, url: reference.destination } : { kind: reference.kind, label: reference.label, targetId: reference.destination })),
		};
		const payload = JSON.stringify({
			...input,
			...(!draft.revision ? { type: draft.type } : {}),
			revision: draft.revision,
		});
		if (payload !== previousPayload) {
			requestId = crypto.randomUUID();
			previousPayload = payload;
		}
		pending = true;
		try {
			if (draft.revision) await saveOpportunity({ ...input, requestId, revision: draft.revision }).updates(remote);
			else await createOpportunityRecord({ ...input, type: draft.type, requestId }).updates(remote);
			saved();
		} catch {
			failure = "Opportunity could not be saved. Check the fields and links; if the record changed, refresh and reopen the editor. Your draft is retained.";
		} finally {
			pending = false;
		}
	}
</script>

<form onsubmit={submit} aria-label="Opportunity editor" class="min-w-0 space-y-5" aria-busy={pending}>
	<fieldset disabled={pending} class="min-w-0 space-y-5">
		<label class="block space-y-2"><span class="font-medium">Opportunity title</span><input class="field" bind:value={draft.title} required maxlength="200" /></label>
		<div class="grid min-w-0 gap-4 @min-[28rem]/opportunity:grid-cols-2">
			{#if !draft.revision}<label class="block min-w-0 space-y-2"
					><span class="font-medium">Type</span><select class="field" aria-label="Type" bind:value={draft.type}
						>{#each Object.entries(typeLabels) as [value, label] (value)}<option {value}>{label}</option>{/each}</select
					></label
				>{/if}
			<label class="block min-w-0 space-y-2"
				><span class="font-medium">{draft.revision ? "Stage" : "Initial stage"}</span><select class="field" aria-label={draft.revision ? "Stage" : "Initial stage"} bind:value={draft.stage}
					>{#each Object.entries(stageLabels) as [value, label] (value)}<option {value}>{label}</option>{/each}</select
				></label>
		</div>
		<fieldset class="min-w-0">
			<legend class="mb-2 font-medium">Linked clients · choose one or more</legend>
			<div class="border-hairline max-h-48 overflow-y-auto rounded-xl border p-2">
				{#each workspace.referenceClients.filter((client) => !client.archivedAt || draft.clientIds.includes(client.id)) as client (client.id)}<label class="flex min-h-11 items-center gap-3 px-2"
						><input type="checkbox" value={client.id} bind:group={draft.clientIds} /><span class="min-w-0 wrap-anywhere">{client.name}{client.archivedAt ? " (archived)" : ""}</span></label
					>{/each}
			</div>
		</fieldset>
		<div class="grid min-w-0 gap-4 @min-[28rem]/opportunity:grid-cols-2">
			<label class="block min-w-0 space-y-2"
				><span class="font-medium">Timeline (optional)</span><select class="field" aria-label="Timeline (optional)" bind:value={draft.timeline}><option value="">No timeline</option><option value="1-3-mo">1–3 mo</option><option value="3-6-mo">3–6 mo</option><option value="6-plus-mo">6+ mo</option></select></label>
			<label class="block min-w-0 space-y-2"><span class="font-medium">Budget (USD, optional)</span><input class="field tabular-nums" inputmode="decimal" bind:value={draft.budget} placeholder="125000.50" /></label>
		</div>
		<label class="block space-y-2"><span class="font-medium">Property address (optional)</span><input class="field" bind:value={draft.address} maxlength="1000" /></label>
		<label class="block space-y-2"><span class="font-medium">Notes</span><textarea class="field min-h-32" bind:value={draft.notes} maxlength="20000"></textarea></label>
		<section aria-label="Edit references" class="min-w-0 space-y-3">
			<h3 class="font-medium">References</h3>
			{#each draft.references as reference, index (reference.key)}
				<div class="border-hairline min-w-0 space-y-3 border-b pb-4">
					<label class="block space-y-2"><span>Reference {index + 1} label</span><input class="field" bind:value={reference.label} required maxlength="200" /></label>
					<label class="block space-y-2"
						><span>Reference {index + 1} kind</span><select class="field" aria-label={`Reference ${index + 1} kind`} bind:value={reference.kind} onchange={() => (reference.destination = "")}
							><option value="url">Web link</option><option value="client">Client record</option><option value="opportunity">Opportunity record</option></select
						></label>
					<label class="block space-y-2"
						><span>Reference {index + 1} destination</span>{#if reference.kind === "url"}<input class="field" type="url" bind:value={reference.destination} required maxlength="2000" placeholder="https://" />{:else}<select
								class="field"
								aria-label={`Reference ${index + 1} destination`}
								bind:value={reference.destination}
								required
								><option value="">Choose a record</option>{#each reference.kind === "client" ? workspace.referenceClients.map((client) => ({ id: client.id, label: client.name })) : workspace.referenceOpportunities.map((row) => ({ id: row.id, label: row.title })) as target (target.id)}<option value={target.id}
										>{target.label}</option
									>{/each}</select
							>{/if}</label>
					<button type="button" class="control" onclick={() => (draft.references = draft.references.filter((row) => row.key !== reference.key))}>Remove reference {index + 1}</button>
				</div>
			{/each}
			<button type="button" class="control" disabled={draft.references.length >= 50} onclick={() => draft.references.push({ key: crypto.randomUUID(), kind: "url", label: "", destination: "" })}>Add reference</button>
			<p class="text-muted text-xs">HTTP and HTTPS links only. Removing a reference never changes its destination record.</p>
		</section>
	</fieldset>
	{#if failure}<p class="text-urgent" role="alert">{failure}</p>{/if}
	<div class="flex flex-wrap gap-2"><button class="control" data-variant="primary" disabled={pending}>{pending ? "Saving…" : "Save opportunity"}</button><button class="control" type="button" disabled={pending} onclick={cancel}>Cancel editing</button></div>
</form>
