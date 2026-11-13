<script lang="ts">
	import { Columns3, X } from "@lucide/svelte";
	import type { getWorkspace } from "#lib/crm.remote.js";
	import type { Workspace } from "#lib/data/workspace.js";
	import OpportunityEditor from "./OpportunityEditor.svelte";
	import type { OpportunityDraft } from "./opportunity-draft.js";

	let { draft = $bindable(), workspace, remote, pending = $bindable(false), cancel, saved }: { draft: OpportunityDraft; workspace: Workspace; remote: ReturnType<typeof getWorkspace>; pending?: boolean; cancel: () => void; saved: () => void } = $props();
	const heading = $props.id();

	function showDialog(dialog: HTMLDialogElement) {
		const opener = document.activeElement;
		dialog.showModal();
		dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
		return () => {
			dialog.close();
			if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
		};
	}
</script>

<dialog
	{@attach showDialog}
	aria-labelledby={heading}
	class="dialog"
	data-size="md"
	oncancel={(event) => {
		if (pending) event.preventDefault();
		else cancel();
	}}
	onclose={cancel}>
	<header class="bg-canvas/95 border-hairline sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-2.5 sm:px-6">
		<span class="text-muted flex min-w-0 items-center gap-1.5 text-sm">
			<Columns3 size={14} class="shrink-0" aria-hidden="true" />Pipeline<span aria-hidden="true">/</span>
			<span class="text-ink truncate font-medium">New opportunity</span>
		</span>
		<button type="button" class="control ml-auto" data-variant="ghost" data-size="sm" data-icon data-autofocus aria-label="Close" disabled={pending} onclick={cancel}><X size={17} aria-hidden="true" /></button>
	</header>
	<div class="@container/opportunity px-4 pt-5 pb-5 sm:px-8 sm:pt-6 sm:pb-7">
		<h2 id={heading} class="font-display mb-6 text-3xl tracking-tight">New opportunity</h2>
		<OpportunityEditor bind:draft {workspace} {remote} bind:pending {cancel} {saved} />
	</div>
</dialog>
