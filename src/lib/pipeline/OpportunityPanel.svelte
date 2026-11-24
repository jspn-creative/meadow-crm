<script lang="ts">
	import { untrack } from "svelte";
	import { NotebookPen } from "@lucide/svelte";
	import ActivitySection from "#lib/activity/ActivitySection.svelte";
	import LogContactPane from "#lib/activity/LogContactPane.svelte";
	import NoteComposer from "#lib/activity/NoteComposer.svelte";
	import type { ClientFacts } from "#lib/activity/client-facts.js";
	import type { ActivityLookup } from "#lib/activity/entries.js";
	import { RecordActivity } from "#lib/activity/record-activity.svelte.js";
	import { mainPaneClass, SubPanel, subPaneClass } from "#lib/activity/sub-panel.svelte.js";
	import type { ContactEntry } from "#lib/activity/types.js";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";
	import type { getActivity } from "#lib/crm.remote.js";
	import type { Workspace } from "#lib/data/workspace.js";
	import { stageLabels, stageTones, timelineLabels, typeLabels, typeStyles } from "./labels.js";

	// One of a client's opportunities, opened in the client's drawer: a short summary, its own Activity with nothing rolled up, and Log contact asking nothing. Open full view, beside Back, opens the Pipeline's dialog for everything else.
	let {
		opportunity,
		clients,
		called,
		identity,
		timeZone,
		lookup,
		clientActivity,
		oncrumb,
	}: {
		opportunity: Workspace["opportunities"][number];
		/** The opportunity's clients, with the key details Log contact shows. */
		clients: ClientFacts[];
		/** The name its clients go by in sentences. */
		called: string;
		identity: () => { actorUserId: string; effectiveUserId: string };
		timeZone: string;
		lookup: ActivityLookup;
		/** The client's Activity behind the drawer, which shows what is posted here too. */
		clientActivity?: ReturnType<typeof getActivity>;
		/** Names the panel's own sub-panel, such as Log contact, for a breadcrumb the panel does not own. */
		oncrumb?: (name: string) => void;
	} = $props();

	const uid = $props.id();
	const record = new RecordActivity({ opportunityId: untrack(() => opportunity.id) }, { identity: () => identity(), others: () => [clientActivity] });
	let entries = $derived(record.entries(lookup));
	const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
	const fade = overflowFade({ axis: "y", fadePercent: 12 });
	const look = $derived(typeStyles[opportunity.type]);

	let activity = $state<ReturnType<typeof ActivitySection>>();
	let announcement = $state("");
	const logging = new SubPanel<true>((open) => oncrumb?.(open ? "Log contact" : ""));

	async function post(body: string) {
		const { id, saved } = record.post(body);
		void activity?.reveal(id);
		const posted = await saved;
		announcement = posted ? "Note posted." : "";
		return posted;
	}
	async function log(entry: ContactEntry, about: Parameters<typeof record.log>[1]) {
		const { id, saved } = record.log(entry, about);
		if (!(await saved)) return false;
		logging.close();
		announcement = "Contact logged.";
		void activity?.reveal(id);
		return true;
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
					{#if clients.length}<p class="text-muted mt-1.5">With {clients.map((client) => client.name).join(" and ")}</p>{/if}
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<span class="chip" data-tone={stageTones[opportunity.stage]}>{stageLabels[opportunity.stage]}</span>
						{#if clients.length}<button type="button" class="control ml-auto @max-[26rem]/shell:w-full" data-variant="primary" data-size="sm" onclick={() => logging.open(true)}><NotebookPen size={15} aria-hidden="true" />Log contact</button>{/if}
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
				</section>
				<ActivitySection bind:this={activity} id={uid} {entries} client={called} {timeZone} failure={record.failure} onedit={(id, text) => record.edit(id, text)} ondelete={(id) => void record.remove(id)}>
					{#snippet empty()}
						{#if record.query.loading && !record.query.current}
							<p class="text-muted py-6 text-center" role="status">Loading Activity…</p>
						{:else if record.query.error}
							<p class="text-urgent py-6 text-center" role="alert">Activity could not load. <button type="button" class="text-action" onclick={() => record.query.refresh()}>Try again</button></p>
						{:else}
							<p class="border-hairline text-muted rounded-xl border border-dashed px-4 py-6 text-center">Nothing here yet. Add a note below, or log your first contact about this opportunity.</p>
						{/if}
					{/snippet}
				</ActivitySection>
			</div>
			<NoteComposer placeholder="Add a note about this opportunity…" onpost={post} />
		</div>
		<section class={subPaneClass} data-active={!!logging.current} inert={!logging.current} aria-labelledby={`${uid}-log-heading`}>
			<LogContactPane panel={logging} back={opportunity.title} headingId={`${uid}-log-heading`} client={called} {clients} opportunities={[]} about={opportunity} {timeZone} userId={identity().effectiveUserId} onlog={log} />
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
