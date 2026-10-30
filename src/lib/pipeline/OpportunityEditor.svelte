<script lang="ts">
	import { Link2, Plus, X } from "@lucide/svelte";
	import { createOpportunityRecord, saveOpportunity } from "#lib/crm.remote.js";
	import type { Workspace } from "#lib/data/workspace.js";
	import Select, { optionsFrom } from "#lib/ui/Select.svelte";
	import { draftInput, referenceKinds, referenceTargets, type OpportunityDraft } from "./opportunity-draft.js";
	import { stageLabels, timelineLabels, typeLabels } from "./labels.js";
	let { draft = $bindable(), workspace, remote, saved, cancel, pending = $bindable(false) }: { draft: OpportunityDraft; workspace: Workspace; remote: ReturnType<typeof import("#lib/crm.remote.js").getWorkspace>; saved: () => void; cancel: () => void; pending?: boolean } = $props();
	let failure = $state("");
	let previousPayload = "";
	let requestId = "";
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		failure = "";
		const input = draftInput(draft);
		if (typeof input === "string") {
			failure = input;
			return;
		}
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
	const label = "text-muted block text-xs font-medium";
</script>

<form onsubmit={submit} aria-label="Opportunity editor" class="min-w-0 space-y-6" aria-busy={pending}>
	<fieldset disabled={pending} class="min-w-0 space-y-6">
		<label class="block space-y-1.5"><span class={label}>Opportunity title</span><input class="field font-display text-xl" bind:value={draft.title} required maxlength="200" /></label>
		<div class="grid min-w-0 gap-4 @min-[28rem]/opportunity:grid-cols-2">
			{#if !draft.revision}<label class="block min-w-0 space-y-1.5"><span class={label}>Type</span><Select label="Type" bind:value={draft.type} options={optionsFrom(typeLabels)} /></label>{/if}
			<label class="block min-w-0 space-y-1.5"><span class={label}>{draft.revision ? "Stage" : "Initial stage"}</span><Select label={draft.revision ? "Stage" : "Initial stage"} bind:value={draft.stage} options={optionsFrom(stageLabels)} /></label>
			<label class="block min-w-0 space-y-1.5"><span class={label}>Timeline (optional)</span><Select label="Timeline (optional)" bind:value={draft.timeline} options={[{ value: "", label: "No timeline" }, ...optionsFrom(timelineLabels)]} /></label>
			<label class="block min-w-0 space-y-1.5"><span class={label}>Budget (USD, optional)</span><input class="field tabular-nums" inputmode="decimal" bind:value={draft.budget} placeholder="125000.50" /></label>
		</div>
		<label class="block space-y-1.5"><span class={label}>Property address (optional)</span><input class="field" bind:value={draft.address} maxlength="1000" /></label>
		<fieldset class="min-w-0">
			<legend class={[label, "mb-1.5"]}>Clients · choose one or more</legend>
			<div class="border-hairline grid max-h-48 overflow-y-auto rounded-xl border bg-white p-1 @min-[28rem]/opportunity:grid-cols-2">
				{#each workspace.referenceClients.filter((client) => !client.archivedAt || draft.clientIds.includes(client.id)) as client (client.id)}<label
						class="has-checked:bg-selected flex min-h-11 items-center gap-3 rounded-lg px-2.5 has-checked:has-[+label_:checked]:rounded-b-none has-checked:[label:has(:checked)+&]:rounded-t-none"
						><input type="checkbox" class="check" value={client.id} bind:group={draft.clientIds} /><span class="min-w-0 wrap-anywhere">{client.name}{client.archivedAt ? " (archived)" : ""}</span></label
					>{/each}
			</div>
		</fieldset>
		<label class="block space-y-1.5"><span class={label}>Notes</span><textarea class="field field-sizing-content" bind:value={draft.notes} maxlength="20000"></textarea></label>
		<section aria-label="Edit references" class="min-w-0 space-y-2">
			<h3 class={label}>References</h3>
			{#each draft.references as reference, index (reference.key)}
				<div class="bg-paper/50 grid min-w-0 gap-2 rounded-xl p-2 @min-[34rem]/opportunity:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
					<Select label={`Reference ${index + 1} kind`} bind:value={reference.kind} options={referenceKinds} onchange={() => (reference.destination = "")} />
					<input class="field" aria-label={`Reference ${index + 1} label`} placeholder="Label" bind:value={reference.label} required maxlength="200" />
					{#if reference.kind === "url"}<input class="field" type="url" aria-label={`Reference ${index + 1} link`} bind:value={reference.destination} required maxlength="2000" placeholder="https://" />{:else}<Select
							label={`Reference ${index + 1} record`}
							bind:value={reference.destination}
							required
							options={referenceTargets(workspace, reference.kind)} />{/if}
					<button type="button" class="control justify-self-end" data-variant="ghost" data-size="sm" data-icon aria-label={`Remove reference ${index + 1}`} onclick={() => (draft.references = draft.references.filter((row) => row.key !== reference.key))}><X size={16} aria-hidden="true" /></button>
				</div>
			{/each}
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1">
				<button type="button" class="text-action" disabled={draft.references.length >= 50} onclick={() => draft.references.push({ key: crypto.randomUUID(), kind: "url", label: "", destination: "" })}><Plus size={16} aria-hidden="true" />Add reference</button>
				<p class="text-muted flex items-center gap-1.5 text-xs"><Link2 size={13} aria-hidden="true" />HTTP and HTTPS links only. Removing a reference never changes its destination record.</p>
			</div>
		</section>
	</fieldset>
	{#if failure}<p class="text-urgent bg-urgent-soft rounded-xl px-3 py-2" role="alert">{failure}</p>{/if}
	<div class="border-hairline flex flex-wrap justify-end gap-2 border-t pt-4"><button class="control" type="button" disabled={pending} onclick={cancel}>Cancel</button><button class="control" data-variant="primary" disabled={pending}>{pending ? "Saving…" : "Save opportunity"}</button></div>
</form>
