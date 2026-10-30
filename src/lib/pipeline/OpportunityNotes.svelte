<script lang="ts">
	import { saveOpportunity } from "#lib/crm.remote.js";
	import type { Workspace } from "#lib/data/workspace.js";
	import { draftInput, opportunityDraft } from "./opportunity-draft.js";
	let { workspace, remote, opportunityId, notes, pending = $bindable(false), saved }: { workspace: Workspace; remote: ReturnType<typeof import("#lib/crm.remote.js").getWorkspace>; opportunityId: string; notes: string; pending?: boolean; saved: () => void } = $props();
	// The field shows the saved notes until someone types; a draft then survives refreshes of the record.
	let draft = $state<string | null>(null);
	let failure = $state("");
	let value = $derived(draft ?? notes);
	let dirty = $derived(draft !== null && draft !== notes);

	async function save() {
		const input = draftInput({ ...opportunityDraft(workspace, opportunityId), notes: value });
		if (typeof input === "string") {
			failure = input;
			return;
		}
		const revision = workspace.opportunities.find((row) => row.id === opportunityId)?.revision;
		if (!revision) return;
		pending = true;
		failure = "";
		try {
			await saveOpportunity({ ...input, requestId: crypto.randomUUID(), revision }).updates(remote);
			draft = null;
			saved();
		} catch {
			failure = "Notes could not be saved. If the opportunity changed, refresh and try again. Your text is retained.";
		} finally {
			pending = false;
		}
	}
</script>

<form
	class="space-y-2"
	onsubmit={(event) => {
		event.preventDefault();
		void save();
	}}>
	<label class="sr-only" for="opportunity-notes">Opportunity notes</label>
	<textarea
		id="opportunity-notes"
		class="field block field-sizing-content max-h-[60dvh] resize-none leading-6"
		data-variant="quiet"
		placeholder="Add a note…"
		maxlength="20000"
		disabled={pending}
		{value}
		oninput={(event) => (draft = event.currentTarget.value)}
		onkeydown={(event) => {
			if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && dirty) {
				event.preventDefault();
				void save();
			}
			if (event.key === "Escape" && dirty) {
				event.preventDefault();
				event.stopPropagation();
				draft = null;
			}
		}}></textarea>
	{#if failure}<p role="alert" class="text-urgent px-3 text-xs">{failure}</p>{/if}
	{#if dirty}
		<div class="flex items-center justify-end gap-2">
			<span class="text-muted mr-auto hidden px-3 text-xs pointer-fine:inline">Ctrl or ⌘ + Enter saves · Esc discards</span>
			<button type="button" class="control" data-size="sm" disabled={pending} onclick={() => (draft = null)}>Discard</button>
			<button class="control" data-size="sm" data-variant="primary" disabled={pending}>{pending ? "Saving…" : "Save notes"}</button>
		</div>
	{/if}
</form>
