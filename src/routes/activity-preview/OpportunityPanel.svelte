<script lang="ts">
	import { untrack } from "svelte";
	import { ArrowLeft, NotebookPen } from "@lucide/svelte";
	import ActivitySection from "#lib/activity/ActivitySection.svelte";
	import LogContactForm from "#lib/activity/LogContactForm.svelte";
	import { channelNoun, contactSummary } from "#lib/activity/feed.js";
	import { mainPaneClass, SubPanel, subPaneClass } from "#lib/activity/sub-panel.svelte.js";
	import type { ActivityEntry, ContactEntry } from "#lib/activity/types.js";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";
	import type { Workspace } from "#lib/data/workspace.js";
	import { stageLabels, stageTones, timelineLabels, typeLabels, typeStyles } from "#lib/pipeline/labels.js";
	import type { ClientDraft } from "#lib/registry/client-draft.js";
	import type { PanelSection } from "#lib/registry/SectionCrumb.svelte";

	// PROTOTYPE ONLY. The opportunity's side of the client Activity design: its own entries and nothing rolled up, with the same Conversation, composer, and Log contact sub-panel. The Pipeline's opportunity fields stay as they are, so a short summary stands in for them. In the client's drawer it reads and changes the client's Activity through `actions`, so what is posted here shows there too; in its full dialog it works on a copy.
	let {
		opportunity,
		client,
		entries: source,
		meadowSince,
		userId,
		timeZone,
		section = $bindable({ name: "", forward: true }),
		actions,
		oncrumb,
	}: {
		opportunity: Workspace["opportunities"][number];
		client: ClientDraft;
		/** The client's whole Activity; the panel shows only this opportunity's entries. */
		entries: ActivityEntry[];
		/** Changes the client's Activity in place of the panel's own copy. */
		actions?: { add: (entry: ActivityEntry) => void; edit: (id: string, text: string) => void; remove: (id: string) => void };
		/** Names the panel's own sub-panel, such as Log contact, for a breadcrumb the panel does not own. */
		oncrumb?: (name: string) => void;
		meadowSince: string;
		userId: string;
		timeZone: string;
		section?: PanelSection;
	} = $props();

	const uid = $props.id();
	let copy = $state(untrack(() => (actions ? [] : structuredClone($state.snapshot(source)))));
	let all = $derived(actions ? source : copy);
	let entries = $derived(all.filter((entry) => entry.opportunityIds?.includes(opportunity.id)));
	let calledName = $derived(client.people.length === 1 ? (client.people[0]!.name.trim().split(/\s+/)[0] ?? client.name) : client.name);
	let phone = $derived(client.people.flatMap((person) => person.phones).find((row) => row.value.trim())?.value);
	let email = $derived(client.people.flatMap((person) => person.emails).find((row) => row.value.trim())?.value);
	// Last contacted is the client's, across all their opportunities.
	let summary = $derived(contactSummary(all.toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at))));
	const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
	const fade = overflowFade({ axis: "y", fadePercent: 12 });
	const look = $derived(typeStyles[opportunity.type]);

	let activity = $state<ReturnType<typeof ActivitySection>>();
	let noteText = $state("");
	let announcement = $state("");
	const logging = new SubPanel<true>((open) => {
		section = { name: open ? "Log contact" : "", forward: open };
		oncrumb?.(open ? "Log contact" : "");
	});
	const record = (summary: string) => copy.push({ id: crypto.randomUUID(), kind: "history", at: new Date().toISOString(), actor: { kind: "user", userId }, opportunityIds: [opportunity.id], summary });
	const add = (entry: ActivityEntry) => (actions ? actions.add(entry) : copy.push(entry));

	function postNote(event: SubmitEvent) {
		event.preventDefault();
		const body = noteText.trim();
		if (!body) return;
		const id = crypto.randomUUID();
		add({ id, kind: "note", at: new Date().toISOString(), actor: { kind: "user", userId }, opportunityIds: [opportunity.id], body });
		noteText = "";
		announcement = "Note posted to sample data only.";
		activity?.reveal(id);
	}
	function logContact(entry: ContactEntry) {
		add(entry);
		logging.close();
		announcement = "Contact logged to sample data only.";
		activity?.reveal(entry.id);
	}
	function editEntry(id: string, text: string) {
		if (actions) return actions.edit(id, text);
		const entry = copy.find((row) => row.id === id);
		if (entry?.kind === "note" && text && text !== entry.body) {
			entry.body = text;
			entry.editedAt = new Date().toISOString();
			record("edited a note");
		} else if (entry?.kind === "contact" && text !== (entry.note ?? "")) {
			entry.note = text || undefined;
			entry.noteEditedAt = text ? new Date().toISOString() : undefined;
			record(`edited the note on a logged ${channelNoun(entry).toLowerCase()}`);
		}
	}
	function deleteEntry(id: string) {
		if (actions) return actions.remove(id);
		const entry = copy.find((row) => row.id === id);
		if (!entry || (entry.kind !== "note" && entry.kind !== "contact")) return;
		copy = copy.filter((row) => row.id !== id);
		record(entry.kind === "contact" ? `deleted a logged ${channelNoun(entry).toLowerCase()}` : "deleted a note");
	}
</script>

<p class="sr-only" role="status">{announcement}</p>
<div class="@container/shell flex min-h-0 flex-1 flex-col text-sm" {@attach logging.stepBack}>
	<div class="shell grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden">
		<div class={mainPaneClass} data-active={!logging.current} inert={!!logging.current}>
			<div class="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain" {@attach fade}>
				<header class="px-(--gutter) pt-5 pb-5">
					<p class="flex items-center gap-1.5 text-xs leading-none font-medium text-(--action-color)" data-tone={look.tone}><look.icon size={12} aria-hidden="true" />{typeLabels[opportunity.type]}</p>
					<h2 id={`${uid}-heading`} class="font-display mt-2 text-2xl tracking-tight wrap-anywhere @min-[36rem]/shell:text-3xl">{opportunity.title}</h2>
					<p class="text-muted mt-1.5">With {client.name}</p>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<span class="chip" data-tone={stageTones[opportunity.stage]}>{stageLabels[opportunity.stage]}</span>
						<button type="button" class="control ml-auto @max-[26rem]/shell:w-full" data-variant="primary" data-size="sm" onclick={() => logging.open(true)}><NotebookPen size={15} aria-hidden="true" />Log contact</button>
					</div>
				</header>
				<section class="border-hairline border-t px-(--gutter) py-5" aria-label="Opportunity details" data-section="Details">
					<dl class="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 leading-[1.4]">
						<dt class="text-muted">Timeline</dt>
						<dd>{opportunity.timeline ? timelineLabels[opportunity.timeline] : "Not set"}</dd>
						<dt class="text-muted">Budget</dt>
						<dd>{opportunity.budgetCents == null ? "Not set" : money.format(opportunity.budgetCents / 100)}</dd>
						{#if opportunity.address}<dt class="text-muted">Property</dt>
							<dd class="wrap-anywhere">{opportunity.address}</dd>{/if}
					</dl>
					<p class="text-muted mt-3 text-xs">The Pipeline's own opportunity fields and checklist stay here unchanged; only Activity is new.</p>
				</section>
				<ActivitySection bind:this={activity} id={uid} {entries} client={calledName} {timeZone} {meadowSince} onedit={editEntry} ondelete={deleteEntry}>
					{#snippet empty()}<p class="border-hairline text-muted rounded-xl border border-dashed px-4 py-6 text-center">Nothing here yet. Add a note below, or log your first contact about this opportunity.</p>{/snippet}
				</ActivitySection>
			</div>
			<form aria-label="Add a note" class="border-hairline shrink-0 border-t px-(--gutter) py-3" data-pinned-bar onsubmit={postNote}>
				<div class="field-group items-end">
					<textarea
						class="field-bare field-sizing-content max-h-40 resize-none py-2 leading-[1.4]"
						aria-label="Note"
						rows="1"
						placeholder="Add a note about this opportunity…"
						maxlength="20000"
						bind:value={noteText}
						onkeydown={(event) => {
							if (!event.isComposing && event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.form?.requestSubmit();
						}}></textarea>
					<button class="control" data-variant="primary" data-size="sm" disabled={!noteText.trim()}>Post</button>
				</div>
			</form>
		</div>
		<section class={subPaneClass} data-active={!!logging.current} inert={!logging.current} aria-labelledby={`${uid}-log-heading`}>
			<div class="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain px-(--gutter) pt-4 pb-6">
				<button type="button" class="text-action" onclick={() => logging.close()}><ArrowLeft size={14} aria-hidden="true" /><span class="truncate">{opportunity.title}</span></button>
				<h2 bind:this={logging.heading} id={`${uid}-log-heading`} tabindex="-1" class="font-display mt-3 mb-5 text-2xl tracking-tight outline-none">Log contact with {calledName}</h2>
				{#key logging.key}
					<LogContactForm
						client={calledName}
						clientName={client.name}
						opportunities={[]}
						about={opportunity}
						facts={{ phone, email, prefers: client.preferredContactMethod.replace(/^./, (letter) => letter.toUpperCase()), preferences: client.preferences, consent: { call: client.consentCall, text: client.consentText, email: client.consentEmail, mail: client.consentMail } }}
						lastContacted={summary.lastContacted}
						latestAttempt={summary.latestAttempt}
						{timeZone}
						{userId}
						onlog={logContact}
						oncancel={() => logging.close()} />
				{/key}
			</div>
		</section>
	</div>
</div>

<style>
	.shell {
		--gutter: calc(var(--spacing) * 4);
		@container shell (min-width: 30rem) {
			--gutter: calc(var(--spacing) * 6);
		}
	}
</style>
