<script lang="ts">
	import { onMount, tick } from "svelte";
	import { Columns3, ContactRound, X } from "@lucide/svelte";
	import ClientEditor from "#lib/registry/ClientEditor.svelte";
	import SectionCrumb, { type PanelSection } from "#lib/registry/SectionCrumb.svelte";
	import OpportunityPanel from "./OpportunityPanel.svelte";
	import { variantSetting } from "#lib/dev/variants.svelte.js";
	import { stageLabels, stageTones, typeLabels } from "#lib/pipeline/labels.js";
	import type { createPrototype } from "#lib/activity/prototype-fixture.js";
	import type { ActivityEntry } from "#lib/activity/types.js";

	// The client dialog mounts the variant toolbar, so the scenario sits there with the other preview controls.
	const scenario = variantSetting("activity-preview-scenario", ["Two opportunities", "One opportunity", "No opportunities", "New relationship"], { label: "Scenario", display: "select" });
	let create = $state.raw<typeof createPrototype>();
	let generation = $state(0);
	// A fresh fixture for each scenario and each reopening; the editor mutates it, so it is deeply reactive.
	let fixture = $derived.by(() => {
		void generation;
		if (!create) return undefined;
		const sample = $state(create(scenario.value));
		return sample;
	});
	let dialog = $state<HTMLDialogElement>();
	let section = $state<PanelSection>({ name: "", forward: true });
	let loadFailure = $state("");
	// An opportunity opens in the client's drawer. Open full view stands in for the Pipeline's own dialog: it opens over the drawer, which is still there once it closes.
	let opportunityDialog = $state<HTMLDialogElement>();
	let openOpportunity = $state<string | null>(null);
	let opportunitySection = $state<PanelSection>({ name: "", forward: true });
	let shownOpportunity = $derived(fixture?.workspace.opportunities.find((row) => row.id === openOpportunity));
	async function showOpportunity(id: string) {
		openOpportunity = id;
		opportunitySection = { name: "", forward: true };
		await tick();
		opportunityDialog?.showModal();
	}
	async function open() {
		generation += 1;
		await tick();
		if (!dialog?.open) dialog?.showModal();
	}
	onMount(async () => {
		try {
			create = (await import("#lib/activity/prototype-fixture.js")).createPrototype;
			await open();
		} catch (cause) {
			loadFailure = cause instanceof Error ? cause.message : "The preview could not load.";
		}
	});
</script>

<svelte:head><title>Client Activity preview · Meadow</title></svelte:head>

<div class="surface-content" data-tight>
	<div class="max-w-xl">
		<p class="text-field text-xs font-medium">Development preview</p>
		<h1 class="font-display mt-3 text-4xl tracking-tight">A relationship, not a collection of fields.</h1>
		<p class="text-muted mt-4">Explore the client's Activity and a more considered client dialog. All people, opportunities, and entries here are fictional. Nothing is saved or sent.</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<button type="button" class="control" data-variant="primary" disabled={!fixture} onclick={open}>Open client dialog</button>
		</div>
		{#if loadFailure}<p class="text-urgent mt-4" role="alert">{loadFailure}</p>{/if}
	</div>
</div>

<dialog
	bind:this={dialog}
	class="dialog preview-dialog @container/client-dialog overflow-hidden transition-[max-width] duration-300 ease-(--ease-shell) open:flex open:flex-col motion-reduce:transition-none sm:has-data-[layout=logging]:max-w-[60rem] sm:has-data-[layout=stacked]:max-w-[40rem]"
	data-placement="side"
	aria-labelledby="client-panel-heading">
	<header class="bg-canvas border-hairline flex shrink-0 items-center gap-3 border-b px-4 py-2.5 sm:px-6">
		<span class="text-muted flex min-w-0 items-center gap-1.5 text-sm">
			<ContactRound size={14} class="shrink-0" aria-hidden="true" />Registry<span aria-hidden="true">/</span>
			<span class={["truncate transition-colors", !section.name && "text-ink font-medium"]}>{fixture?.draft.name || "Client"}</span>
			<SectionCrumb {section} />
		</span>
		<button type="button" class="icon-action ml-auto" aria-label="Close client dialog" onclick={() => dialog?.close()}><X size={17} aria-hidden="true" /></button>
	</header>
	{#if fixture}
		{@const sample = fixture}
		{#key fixture}
			<svelte:boundary>
				<ClientEditor
					bind:draft={fixture.draft}
					bind:section
					workspace={fixture.workspace}
					preview={fixture.preview}
					saved={() => {}}
					oncreateopportunity={(row) => {
						sample.workspace.opportunities.push(row);
						sample.workspace.links.push({ clientId: sample.draft.id, opportunityId: row.id });
					}}
					onpopout={showOpportunity}>
					{#snippet opportunity({ id, entries, actions, crumb }: { id: string; entries: ActivityEntry[]; actions: Parameters<typeof OpportunityPanel>[1]["actions"]; crumb: (name: string) => void })}
						{@const row = sample.workspace.opportunities.find((item) => item.id === id)}
						{#if row}<OpportunityPanel opportunity={row} client={sample.draft} {entries} {actions} oncrumb={crumb} meadowSince={sample.preview.meadowSince} userId={sample.workspace.identity.effectiveUserId} timeZone={sample.workspace.settings.timezone} />{/if}
					{/snippet}
					{#snippet opportunities(open?: (id: string) => void)}
						<!-- The same rows the Registry's client dialog shows; each opens its opportunity in the drawer. -->
						<h3 class="font-display mb-2 flex min-h-6 items-center text-base">Opportunities</h3>
						<ul class="space-y-1">
							{#each sample.workspace.opportunities as row (row.id)}
								<li>
									<button type="button" class="work-row hover:bg-highlight flex min-h-10 w-full items-center gap-3 px-3 py-1.5 text-left transition-colors" onclick={() => open?.(row.id)}
										><span class="item-title min-w-0 flex-1 truncate">{row.title}</span><span class="text-muted shrink-0 text-xs">{typeLabels[row.type]}</span><span class="chip shrink-0" data-tone={stageTones[row.stage]}>{stageLabels[row.stage]}</span></button>
								</li>
							{:else}<li class="text-muted">None yet.</li>{/each}
						</ul>
					{/snippet}
				</ClientEditor>
				{#snippet failed(error, retry)}
					<div class="p-6">
						<p class="text-urgent" role="alert">The preview could not render. Reload it to try again.</p>
						<button type="button" class="control mt-4" onclick={retry}>Retry preview</button>
					</div>
				{/snippet}
			</svelte:boundary>
		{/key}
	{/if}
</dialog>

<dialog bind:this={opportunityDialog} class="dialog preview-dialog h-[min(92dvh,56rem)] overflow-hidden open:flex open:flex-col" data-size="lg" aria-label={shownOpportunity?.title ?? "Opportunity"} onclose={() => (openOpportunity = null)}>
	<header class="bg-canvas border-hairline flex shrink-0 items-center gap-3 border-b px-4 py-2.5 sm:px-6">
		<span class="text-muted flex min-w-0 items-center gap-1.5 text-sm">
			<Columns3 size={14} class="shrink-0" aria-hidden="true" />Pipeline<span aria-hidden="true">/</span>
			<span class={["truncate transition-colors", !opportunitySection.name && "text-ink font-medium"]}>{shownOpportunity?.title ?? "Opportunity"}</span>
			<SectionCrumb section={opportunitySection} />
		</span>
		<button type="button" class="icon-action ml-auto" aria-label="Close opportunity dialog" onclick={() => opportunityDialog?.close()}><X size={17} aria-hidden="true" /></button>
	</header>
	{#if fixture && shownOpportunity}
		{#key shownOpportunity.id}
			<OpportunityPanel bind:section={opportunitySection} opportunity={shownOpportunity} client={fixture.draft} entries={fixture.preview.entries} meadowSince={fixture.preview.meadowSince} userId={fixture.workspace.identity.effectiveUserId} timeZone={fixture.workspace.settings.timezone} />
		{/key}
	{/if}
</dialog>

<style>
	.preview-dialog {
		&::backdrop {
			overflow: hidden;
			overscroll-behavior: contain;
		}
	}
</style>
