<script lang="ts">
	let { opportunity = "", dialogOnly = false, onclose = () => {} }: { opportunity?: string; dialogOnly?: boolean; onclose?: () => void } = $props();
	import { onDestroy, onMount, untrack } from "svelte";
	import { Archive, ArrowLeft, Banknote, Bookmark, Clock3, Columns3, ContactRound, Link2, MapPin, PencilLine, Pin, PinOff, Plus, RefreshCw, Shapes, SlidersHorizontal, Tags, Trash2, Undo2, UserRound, X } from "@lucide/svelte";
	import { page } from "$app/state";
	import { getWorkspace, saveOpportunity } from "#lib/crm.remote.js";
	import { bookmarks } from "#lib/bookmarks/bookmarks.svelte.js";
	import OpportunityEditor from "#lib/pipeline/OpportunityEditor.svelte";
	import OpportunityCard from "#lib/pipeline/OpportunityCard.svelte";
	import OpportunityNotes from "#lib/pipeline/OpportunityNotes.svelte";
	import OpportunityHistory from "#lib/pipeline/OpportunityHistory.svelte";
	import ReferenceList from "#lib/pipeline/ReferenceList.svelte";
	import ChecklistItem from "#lib/pipeline/ChecklistItem.svelte";
	import BoardColumn from "#lib/pipeline/BoardColumn.svelte";
	import Menu from "#lib/ui/Menu.svelte";
	import ImpersonationIndicator from "#lib/shell/ImpersonationIndicator.svelte";
	import Select, { optionsFrom } from "#lib/ui/Select.svelte";
	import { browser } from "$app/env";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";
	import { collapsedStagesScript, measureCollapsedStages, readCollapsedStages, storeCollapsedStages, type CollapsedStages } from "#lib/pipeline/board-columns.js";
	import { opportunityDraft, draftInput, referenceKinds, referenceTargets, type OpportunityDraft, type ReferenceDraft } from "#lib/pipeline/opportunity-draft.js";
	import { workspaceData } from "#lib/data/workspace.js";
	import { stageLabels, stageTones, typeLabels, typeStyles, timelineLabels } from "#lib/pipeline/labels.js";
	type Stage = keyof typeof stageLabels;
	type OpportunityType = keyof typeof typeLabels;
	const remote = getWorkspace({ archived: false });
	await remote;
	const data = workspaceData(remote);
	onDestroy(() => data.dispose());
	let workspace = $derived(await remote);
	let creating = $state(false);
	let opportunityId = $state("");
	let drafts = $state<Record<string, OpportunityDraft>>({});
	let editing = $state(false);
	let selectedId = $state(untrack(() => opportunity || (dialogOnly ? "" : (page.url.searchParams.get("opportunity") ?? ""))));
	let inspectedStage = $state(untrack(() => (dialogOnly ? "" : (page.url.searchParams.get("stage") ?? ""))));
	let failure = $state("");
	let pending = $state(false);
	let status = $state("");
	let toast = $state(0);
	let ready = $state(false);
	let filterTypes = $state<OpportunityType[]>([]);
	let filterTimeline = $state("all");
	let filterTag = $state("all");
	let tab = $state<"notes" | "history">("notes");
	let adding = $state(false);
	let dragId = $state("");
	let dropStage = $state("");
	// Checklist reorder rides HTML5 drag: checklistDrag holds the row being hauled, checklistDropAt the gap it will land in.
	let checklistDrag = $state<number>();
	let checklistDropAt = $state<number>();
	const clearChecklistDrag = () => {
		checklistDrag = undefined;
		checklistDropAt = undefined;
	};
	// Inline editing of single properties on the open record; edit-all stays available as the alternative.
	type InlineField = "budget" | "address";
	let inlineEditing = $state<InlineField | "">("");
	let inlineDraft = $state("");
	let inlineOriginal = $state("");
	let referenceAdding = $state(false);
	let referenceDraft = $state<ReferenceDraft>({ key: "", kind: "url", label: "", destination: "" });
	onMount(() => {
		ready = true;
		bookmarks.hydrate();
	});
	let savedBookmarks = $derived(bookmarks.ids);
	let selected = $derived(workspace.opportunities.find((row) => row.id === selectedId));
	let checklist = $derived(selected && (workspace.checklists.find((list) => list.opportunityId === selected.id && list.stage === (inspectedStage || selected.stage)) ?? workspace.checklists.find((list) => list.opportunityId === selected.id && list.stage === selected.stage)));
	let clientById = $derived(new Map(workspace.referenceClients.map((client) => [client.id, client])));
	let clientIdsByOpportunity = $derived(workspace.links.reduce((map, link) => map.set(link.opportunityId, [...(map.get(link.opportunityId) ?? []), link.clientId]), new Map<string, string[]>()));
	const clientIds = (id: string) => clientIdsByOpportunity.get(id) ?? [];
	let allTags = $derived([...new Map(workspace.referenceClients.flatMap((client) => client.tags.map((tag) => [tag.id, tag]))).values()]);
	const timelineRank = (timeline: string | null) => (timeline === "1-3-mo" ? 0 : timeline === "3-6-mo" ? 1 : timeline === "6-plus-mo" ? 2 : 3);
	let filtered = $derived(filterTypes.length > 0 || filterTimeline !== "all" || filterTag !== "all");
	// Pinned opportunities lead their stage, oldest pin first; everything else follows the timeline sort.
	const boardOrder = (a: { pinnedAt: string | null; timeline: string | null }, b: { pinnedAt: string | null; timeline: string | null }) => {
		if (a.pinnedAt && b.pinnedAt) return a.pinnedAt.localeCompare(b.pinnedAt);
		if (a.pinnedAt || b.pinnedAt) return a.pinnedAt ? -1 : 1;
		return timelineRank(a.timeline) - timelineRank(b.timeline);
	};
	let visible = $derived(
		workspace.opportunities
			.filter((opportunity) => {
				// Types combine with OR among themselves and AND with the other filters.
				if (filterTypes.length && !filterTypes.includes(opportunity.type)) return false;
				if (filterTimeline !== "all" && opportunity.timeline !== filterTimeline) return false;
				if (filterTag !== "all" && !clientIds(opportunity.id).some((clientId) => clientById.get(clientId)?.tags.some((tag) => tag.id === filterTag))) return false;
				return true;
			})
			.sort(boardOrder),
	);
	const stages = Object.keys(stageLabels) as Stage[];
	// The inline board script has already applied and stored this session's state when the page was server-rendered.
	const storedStages = browser ? readCollapsedStages() : null;
	let collapsedStages = $state<CollapsedStages>(storedStages ?? {});
	let settled = $state(false);
	function toggleStage(stage: Stage) {
		collapsedStages = { ...collapsedStages, [stage]: !collapsedStages[stage] };
		storeCollapsedStages(collapsedStages);
	}
	// A new session without the inline script (client navigation) measures its default once; transitions start only after the first frame so the default never animates in.
	function settleBoard(row: HTMLElement) {
		if (!storedStages) {
			const measured = measureCollapsedStages(row, stages);
			collapsedStages = measured;
			storeCollapsedStages(measured);
		}
		let frame = requestAnimationFrame(() => (frame = requestAnimationFrame(() => (settled = true))));
		return () => cancelAnimationFrame(frame);
	}
	const boardFade = overflowFade({ axis: "x", fadePercent: 5 });
	const filterFade = overflowFade({ axis: "x", fadePercent: 12 });
	function toggleType(type: OpportunityType) {
		filterTypes = filterTypes.includes(type) ? filterTypes.filter((value) => value !== type) : [...filterTypes, type];
	}
	const tabs = [
		{ id: "notes", label: "Notes" },
		{ id: "history", label: "History" },
	] as const;
	let linked = $derived(selected ? clientIds(selected.id).flatMap((id) => clientById.get(id) ?? []) : []);
	let tags = $derived([...new Map(linked.flatMap((client) => client.tags.map((tag) => [tag.id, tag]))).values()]);
	let references = $derived(selected ? workspace.references.filter((reference) => reference.opportunityId === selected.id) : []);
	let changes = $derived(selected ? workspace.history.filter((change) => change.recordId === selected.id) : []);
	let done = $derived(checklist?.items.filter((item) => item.completedAt).length ?? 0);
	const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

	function progress(opportunity: (typeof visible)[number]) {
		const list = workspace.checklists.find((row) => row.opportunityId === opportunity.id && row.stage === opportunity.stage);
		return list ? { done: list.items.filter((item) => item.completedAt).length, total: list.items.length } : null;
	}
	function announce(text: string) {
		status = text;
		toast += 1;
	}
	function open(id: string) {
		selectedId = id;
		editing = false;
		inspectedStage = "";
		adding = false;
		referenceAdding = false;
		inlineEditing = "";
		clearChecklistDrag();
		tab = "notes";
		failure = "";
		status = "";
	}
	function closeOpportunity() {
		selectedId = "";
		if (dialogOnly) onclose();
	}
	function newOpportunity(stage?: Stage) {
		if (!opportunityId) {
			opportunityId = crypto.randomUUID();
			drafts[opportunityId] = opportunityDraft(workspace, opportunityId, page.url.searchParams.get("client") ?? undefined);
		}
		if (stage) drafts[opportunityId]!.stage = stage;
		failure = "";
		creating = true;
	}
	function showDialog(dialog: HTMLDialogElement) {
		const opener = document.activeElement;
		dialog.showModal();
		dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
		return () => {
			dialog.close();
			if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
		};
	}
	// Every write shares one pending flag and one failure message, so the board never runs two at once.
	async function run(working: string, done: string, failed: string, write: () => Promise<unknown>) {
		pending = true;
		failure = "";
		status = working;
		try {
			await write();
			announce(done);
			return true;
		} catch {
			failure = failed;
			status = "";
			return false;
		} finally {
			pending = false;
		}
	}
	const saveStep = (input: Parameters<typeof data.saveStep>[0] extends infer T ? Omit<T, "requestId"> : never) =>
		run("Saving checklist item…", "Checklist item saved.", "Checklist item could not be saved or has changed. Your draft is retained. Refresh before retrying.", () => data.saveStep({ ...input, requestId: crypto.randomUUID() })).then(() => {});
	async function moveCard(opportunity: { id: string; revision: number; stage: Stage }, stage: Stage) {
		if (stage === opportunity.stage) return;
		const moved = await run("Moving opportunity…", `Moved to ${stageLabels[stage]}.`, "Stage could not be saved or has changed. The move was rolled back. Refresh before retrying.", () => data.move({ requestId: crypto.randomUUID(), id: opportunity.id, revision: opportunity.revision, stage }));
		if (moved && opportunity.id === selectedId) {
			inspectedStage = "";
			status = "Stage saved.";
		}
	}
	async function archive(opportunity: { id: string; revision: number }) {
		if (await run("Archiving opportunity…", "Opportunity archived.", "Opportunity could not be archived or has changed. Refresh before retrying.", () => data.archive({ requestId: crypto.randomUUID(), id: opportunity.id, revision: opportunity.revision }))) if (selectedId === opportunity.id) closeOpportunity();
	}
	async function pin(opportunity: { id: string; revision: number; stage: Stage; pinnedAt: string | null }) {
		const pinned = !opportunity.pinnedAt;
		await run(pinned ? "Pinning opportunity…" : "Unpinning opportunity…", pinned ? `Pinned to the top of ${stageLabels[opportunity.stage]}.` : "Opportunity unpinned.", `Opportunity could not be ${pinned ? "pinned" : "unpinned"} or has changed. Refresh before retrying.`, () =>
			data.pin({ requestId: crypto.randomUUID(), id: opportunity.id, revision: opportunity.revision, pinned }),
		);
	}
	async function remove(opportunity: { id: string; revision: number }) {
		if (!confirm("Delete this opportunity? This cannot be undone.")) return;
		if (await run("Deleting opportunity…", "Opportunity deleted.", "Opportunity could not be deleted or has changed. Refresh before retrying.", () => data.delete({ requestId: crypto.randomUUID(), id: opportunity.id, revision: opportunity.revision }))) if (selectedId === opportunity.id) closeOpportunity();
	}
	function checklistWrite(working: string, done: string, failed: string, write: (list: NonNullable<typeof checklist>) => Promise<unknown>) {
		const list = checklist;
		if (!list) return Promise.resolve(false);
		return run(working, done, failed, () => write(list));
	}
	// Moving an item can jump over several positions: the drag handle and the keyboard both end here.
	const reorder = (index: number, target: number) =>
		checklistWrite("Moving checklist item…", "Checklist item moved.", "Could not reorder. Refresh before retrying.", (list) => {
			const ids = list.items.map((row) => row.id);
			const [moved] = ids.splice(index, 1);
			const at = target > index ? target - 1 : target;
			ids.splice(at, 0, moved!);
			return data.reorderChecklistItems({ requestId: crypto.randomUUID(), checklistId: list.id, revision: list.revision, itemIds: ids });
		}).then(() => {});
	const rename = (item: NonNullable<typeof checklist>["items"][number], title: string) =>
		checklistWrite("Renaming checklist item…", "Checklist item renamed.", "Could not rename. Refresh before retrying.", (list) => data.renameChecklistItem({ requestId: crypto.randomUUID(), checklistId: list.id, revision: list.revision, itemId: item.id, itemRevision: item.revision, title })).then(() => {});
	const removeItem = async (item: NonNullable<typeof checklist>["items"][number]) => {
		if (!confirm(`Remove “${item.title}” from this checklist?`)) return;
		await checklistWrite("Removing checklist item…", "Checklist item removed.", "Could not remove. Refresh before retrying.", (list) => data.removeChecklistItem({ requestId: crypto.randomUUID(), checklistId: list.id, revision: list.revision, itemId: item.id }));
	};
	// Checklist reorder rides HTML5 drag: checklistDrag holds the row being hauled, checklistDropAt the gap it will land in.
	function checklistDragStart(event: DragEvent, index: number) {
		checklistDrag = index;
		if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
	}
	function checklistDragOver(event: DragEvent, index: number) {
		if (checklistDrag === undefined) return;
		event.preventDefault();
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		checklistDropAt = event.clientY - box.top < box.height / 2 ? index : index + 1;
	}
	async function checklistDrop() {
		const from = checklistDrag;
		const at = checklistDropAt;
		clearChecklistDrag();
		if (from === undefined || at === undefined || at === from || at === from + 1) return;
		await reorder(from, at);
	}
	// One property edited in place: a fresh draft built from the saved record plus the patch saves against the current revision.
	async function saveField(patch: Partial<OpportunityDraft>, working: string, done: string, failed: string) {
		const row = selected;
		if (!row) return false;
		const draft = opportunityDraft(workspace, row.id);
		Object.assign(draft, patch);
		const input = draftInput(draft);
		if (typeof input === "string") {
			failure = input;
			return false;
		}
		return run(working, done, failed, () => saveOpportunity({ ...input, requestId: crypto.randomUUID(), revision: row.revision }).updates(remote));
	}
	function startInline(kind: InlineField) {
		const row = selected;
		if (!row) return;
		inlineEditing = kind;
		inlineOriginal = kind === "budget" ? (row.budgetCents == null ? "" : (row.budgetCents / 100).toFixed(2)) : (row.address ?? "");
		inlineDraft = inlineOriginal;
	}
	async function commitInline() {
		const kind = inlineEditing;
		if (!kind) return;
		const value = inlineDraft.trim();
		if (value === inlineOriginal) {
			inlineEditing = "";
			return;
		}
		const ok = kind === "budget" ? await saveField({ budget: value }, "Saving budget…", "Budget saved.", "Budget could not be saved or has changed. Refresh before retrying.") : await saveField({ address: value }, "Saving address…", "Address saved.", "Address could not be saved or has changed. Refresh before retrying.");
		if (ok) inlineEditing = "";
	}
	function startReferenceAdd() {
		referenceDraft = { key: crypto.randomUUID(), kind: "url", label: "", destination: "" };
		referenceAdding = true;
	}
	async function saveReferenceAdd() {
		const reference = { ...referenceDraft, label: referenceDraft.label.trim(), destination: referenceDraft.destination.trim() };
		if (!reference.label || !reference.destination) return;
		const ok = await saveField({ references: [...opportunityDraft(workspace, selected!.id).references, reference] }, "Adding reference…", "Reference added.", "Reference could not be added or has changed. Refresh before retrying.");
		if (ok) referenceAdding = false;
	}
	function removeReference(reference: { id: string; label: string }) {
		const row = selected;
		if (!row) return;
		if (!confirm(`Remove the reference “${reference.label}”?`)) return;
		void saveField({ references: opportunityDraft(workspace, row.id).references.filter((draft) => draft.key !== reference.id) }, "Removing reference…", "Reference removed.", "Reference could not be removed or has changed. Refresh before retrying.");
	}
	async function addItem(input: HTMLInputElement) {
		const title = input.value.trim();
		if (!title) return;
		if (await checklistWrite("Adding checklist item…", "Checklist item added.", "Could not add the checklist item. Refresh before retrying.", (list) => data.addChecklistItem({ requestId: crypto.randomUUID(), checklistId: list.id, revision: list.revision, title }))) {
			input.value = "";
			input.focus();
		}
	}
	function switchTab(event: KeyboardEvent) {
		if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
		event.preventDefault();
		const index = tabs.findIndex(({ id }) => id === tab);
		const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
		tab = tabs[next]!.id;
		document.getElementById(`opportunity-tab-${tab}`)?.focus();
	}
</script>

{#if !dialogOnly}
	<div class="surface-content @container/board [--gutter:--spacing(5)] sm:[--gutter:--spacing(8)] lg:[--gutter:--spacing(10)]" data-tight>
		<p role="status" aria-live="polite" class="sr-only">{selected || creating ? "" : status}</p>
		{#if failure && !selected && !creating}
			<div role="alert" class="bg-urgent-soft text-urgent mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl py-1.5 pr-1.5 pl-4 text-sm [--action-color:var(--color-urgent)]">
				<span class="min-w-0 flex-1 basis-60 py-1">{failure}</span>
				<button
					type="button"
					class="control -ml-3"
					data-variant="ghost"
					data-size="sm"
					onclick={async () => {
						await remote.refresh();
						failure = "";
					}}><RefreshCw size={15} aria-hidden="true" />Refresh records</button>
			</div>
		{/if}
		<div class="mb-5 flex flex-wrap items-center gap-2">
			<div
				role="group"
				aria-label="Filter the board"
				class="-m-1.5 flex min-w-0 flex-1 [scrollbar-width:none] flex-nowrap items-center gap-2 overflow-x-auto p-1.5 *:shrink-0 @max-[30rem]/board:order-last @max-[30rem]/board:-mx-(--gutter) @max-[30rem]/board:basis-[calc(100%+2*var(--gutter))] @max-[30rem]/board:px-(--gutter)"
				{@attach filterFade}>
				<SlidersHorizontal size={16} class="text-muted mr-1 hidden @min-[60rem]/board:block" aria-hidden="true" />
				<div role="group" aria-label="Type" class="flex items-center gap-1.5">
					{#each Object.entries(typeLabels) as [type, label] (type)}
						{@const style = typeStyles[type as OpportunityType]}
						{@const TypeIcon = style.icon}
						<button type="button" aria-pressed={filterTypes.includes(type as OpportunityType)} class="control" data-size="sm" data-tone={style.tone} onclick={() => toggleType(type as OpportunityType)}><TypeIcon size={14} strokeWidth={2.25} aria-hidden="true" />{label}</button>
					{/each}
				</div>
				<span class="bg-hairline mx-0.5 h-5 w-px" aria-hidden="true"></span>
				<Select appearance="pill" label="Timeline" active={filterTimeline !== "all"} bind:value={filterTimeline} options={[{ value: "all", label: "All timelines" }, ...optionsFrom(timelineLabels)]} />
				<Select appearance="pill" label="Tag" active={filterTag !== "all"} bind:value={filterTag} options={[{ value: "all", label: "All tags" }, ...allTags.map((tag) => ({ value: tag.id, label: tag.name }))]} />
				{#if filtered}
					<button
						type="button"
						class="text-action"
						onclick={() => {
							filterTypes = [];
							filterTimeline = filterTag = "all";
						}}><X size={14} aria-hidden="true" />Clear</button>
				{/if}
				<span class="text-muted hidden px-1 text-xs @min-[80rem]/board:inline">Sorted by timeline</span>
			</div>
			<div class="ml-auto flex shrink-0 items-center gap-2">
				<a class="control" data-size="sm" data-reveal href="/pipeline/archived" aria-label="View archived opportunities"><Archive size={15} aria-hidden="true" /><span class="control-label" aria-hidden="true"><span><span>Archived</span></span></span></a>
				<button type="button" class="control" data-variant="primary" data-size="sm" onclick={() => newOpportunity()} disabled={!ready}><Plus size={16} aria-hidden="true" />New opportunity</button>
			</div>
		</div>
		<!-- The scroller spans the gutters so its edge fade falls in the gutter; vertical padding keeps drop outlines, focus glows and card lifts clear of its clipping edge. -->
		<div class="-mx-(--gutter) -mt-1.5 flex snap-x snap-mandatory scroll-px-(--gutter) overflow-x-auto overscroll-x-none pt-2.5 pb-4 @min-[40rem]/board:snap-none" {@attach boardFade}>
			<div data-settled={settled} class="group/board flex grow items-stretch gap-3 px-(--gutter) [--column:min(17rem,calc(100cqw-2*var(--gutter)-3.75rem))]" {@attach settleBoard}>
				{#each stages as stage (stage)}
					{@const rows = visible.filter((row) => row.stage === stage)}
					<BoardColumn
						{stage}
						count={rows.length}
						collapsed={!!collapsedStages[stage]}
						dropping={dropStage === stage}
						{ready}
						toggle={() => toggleStage(stage)}
						add={() => newOpportunity(stage)}
						dragover={(event) => {
							if (!dragId) return;
							event.preventDefault();
							dropStage = stage;
						}}
						dragleave={(event) => {
							if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) dropStage = "";
						}}
						drop={(event) => {
							event.preventDefault();
							const opportunity = workspace.opportunities.find((row) => row.id === dragId);
							dragId = dropStage = "";
							if (opportunity) void moveCard(opportunity, stage);
						}}>
						<ol class="mt-1 space-y-1.5">
							{#each rows as opportunity (opportunity.id)}
								<li>
									<OpportunityCard
										{opportunity}
										clients={clientIds(opportunity.id)
											.map((id) => workspace.clients.find((client) => client.id === id)?.name)
											.filter((name): name is string => !!name)}
										progress={progress(opportunity)}
										{ready}
										busy={!ready || pending}
										dragging={dragId === opportunity.id}
										open={() => open(opportunity.id)}
										move={(target) => moveCard(opportunity, target)}
										archive={() => archive(opportunity)}
										pin={() => pin(opportunity)}
										remove={() => remove(opportunity)}
										dragstart={(event) => {
											dragId = opportunity.id;
											event.dataTransfer?.setData("text/plain", opportunity.title);
											if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
										}}
										dragend={() => (dragId = dropStage = "")} />
								</li>
							{:else}
								<li class="text-muted border-hairline flex min-h-24 items-center justify-center rounded-2xl border border-dashed px-4 text-center text-xs">{filtered ? "No matches in this stage" : "No opportunities in this stage"}</li>
							{/each}
						</ol>
					</BoardColumn>
				{/each}
			</div>
		</div>
		{@html collapsedStagesScript}
	</div>

	{#key toast}
		{#if status && !selected && !creating && !pending}
			<p aria-hidden="true" class="toast pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-[toast_3.2s_var(--ease-shell)_forwards] whitespace-nowrap motion-reduce:animate-[toast-fade_3.2s_linear_forwards]">{status}</p>
		{/if}
	{/key}
{/if}

{#snippet dialogHeader(crumb: string, tone: string | null)}
	<span class="text-muted flex min-w-0 items-center gap-1.5 text-sm">
		<Columns3 size={14} class="shrink-0" aria-hidden="true" />Pipeline<span aria-hidden="true">/</span>
		{#if tone}<span class="size-2 shrink-0 rounded-full" style:background={`var(--color-${tone})`} aria-hidden="true"></span>{/if}
		<span class="text-ink truncate font-medium">{crumb}</span>
	</span>
{/snippet}

{#if creating}
	<dialog
		{@attach showDialog}
		aria-labelledby="create-heading"
		class="dialog"
		data-size="md"
		oncancel={(event) => {
			if (pending) event.preventDefault();
			else creating = false;
		}}
		onclose={() => (creating = false)}>
		<ImpersonationIndicator />
		<header class="bg-canvas/95 border-hairline sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-2.5 sm:px-6">
			{@render dialogHeader("New opportunity", null)}
			<button type="button" class="control ml-auto" data-variant="ghost" data-size="sm" data-icon data-autofocus aria-label="Close" disabled={pending} onclick={() => (creating = false)}><X size={17} aria-hidden="true" /></button>
		</header>
		<div class="@container/opportunity px-4 pt-5 pb-5 sm:px-8 sm:pt-6 sm:pb-7">
			<h2 id="create-heading" class="font-display mb-6 text-3xl tracking-tight">New opportunity</h2>
			<OpportunityEditor
				bind:draft={drafts[opportunityId]!}
				{workspace}
				{remote}
				bind:pending
				cancel={() => (creating = false)}
				saved={() => {
					creating = false;
					open(opportunityId);
					delete drafts[opportunityId];
					opportunityId = "";
				}} />
		</div>
	</dialog>
{/if}

{#if selected}
	{@const style = typeStyles[selected.type]}
	{@const TypeIcon = style.icon}
	<dialog
		{@attach showDialog}
		aria-labelledby="opportunity-heading"
		class="dialog"
		data-size="lg"
		oncancel={(event) => {
			if (pending) event.preventDefault();
			else closeOpportunity();
		}}
		onclose={closeOpportunity}>
		<ImpersonationIndicator />
		<header class="bg-canvas/95 border-hairline sticky top-0 z-20 flex items-center gap-1.5 border-b px-4 py-2.5 sm:px-6">
			{@render dialogHeader(stageLabels[selected.stage], stageTones[selected.stage])}
			<p role="status" aria-live="polite" class="text-muted ml-auto min-w-0 truncate pr-1.5 text-xs max-sm:sr-only">{status}</p>
			<span class="ml-auto sm:hidden"></span>
			{#if !editing}
				{@const bookmarked = savedBookmarks.includes(selected.id)}
				<button
					type="button"
					class="control"
					data-variant="ghost"
					data-size="sm"
					data-icon
					aria-pressed={bookmarked}
					aria-label={bookmarked ? "Remove bookmark" : "Bookmark opportunity"}
					title={bookmarked ? "Remove bookmark" : "Bookmark opportunity"}
					onclick={() => {
						if (!selected) return;
						announce(bookmarks.toggle(selected.id) ? "Kept in the Bookmarks stack." : "Removed from the Bookmarks stack.");
					}}><Bookmark size={16} class={bookmarked ? "fill-current" : null} aria-hidden="true" /></button>
				<button
					type="button"
					class="control"
					data-variant="ghost"
					data-size="sm"
					data-icon
					disabled={pending}
					aria-pressed={!!selected.pinnedAt}
					aria-label={selected.pinnedAt ? "Unpin opportunity" : "Pin opportunity"}
					title={selected.pinnedAt ? "Unpin from the top of its stage" : "Pin to the top of its stage"}
					onclick={() => selected && pin(selected)}>
					{#if selected.pinnedAt}<PinOff size={16} aria-hidden="true" />{:else}<Pin size={16} aria-hidden="true" />{/if}
				</button>
				<button
					type="button"
					class="control"
					data-variant="ghost"
					data-size="sm"
					data-icon
					aria-label="Edit opportunity"
					title="Edit opportunity"
					disabled={pending}
					onclick={() => {
						if (selected) {
							drafts[selected.id] ??= opportunityDraft(workspace, selected.id);
							editing = true;
						}
					}}><PencilLine size={16} aria-hidden="true" /></button>
			{/if}
			<Menu label="Opportunity actions" disabled={!ready || pending}>
				<button type="button" role="menuitem" class="menu-item" onclick={() => selected && archive(selected)}><Archive size={15} aria-hidden="true" />Archive opportunity</button>
				<button type="button" role="menuitem" class="menu-item" data-tone="danger" onclick={() => selected && remove(selected)}><Trash2 size={15} aria-hidden="true" />Delete opportunity</button>
			</Menu>
			<button class="control" data-variant="ghost" data-size="sm" data-icon type="button" data-autofocus aria-label="Close" disabled={pending} onclick={closeOpportunity}><X size={17} aria-hidden="true" /></button>
		</header>
		<div class="@container/opportunity">
			<div class="grid min-w-0 @min-[48rem]/opportunity:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)] @min-[48rem]/opportunity:grid-rows-[auto_1fr]">
				<div class="min-w-0 space-y-7 px-4 pt-6 pb-7 sm:px-8">
					{#if failure}
						<div role="alert" class="bg-urgent-soft text-urgent flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl py-1.5 pr-1.5 pl-4 text-sm [--action-color:var(--color-urgent)]">
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
					<h2 id="opportunity-heading" class={["font-display text-3xl tracking-tight text-balance wrap-anywhere", editing && "sr-only"]}>{selected.title}</h2>
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
								announce("Opportunity saved.");
							}} />
					{:else}
						{#if drafts[selected.id]}
							<div class="bg-pending-soft text-pending flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl py-1.5 pr-1.5 pl-4 text-sm [--action-color:var(--color-pending)]">
								<span class="min-w-0 flex-1 basis-60 py-1">An unsaved editing draft is retained.</span>
								<span class="-ml-3 flex shrink-0 flex-wrap items-center gap-1">
									<button type="button" class="control" data-variant="ghost" data-size="sm" onclick={() => (editing = true)}><PencilLine size={15} aria-hidden="true" />Resume editing</button>
									<button
										type="button"
										class="control"
										data-variant="ghost"
										data-size="sm"
										disabled={pending}
										onclick={() => {
											if (selected) delete drafts[selected.id];
										}}><Undo2 size={15} aria-hidden="true" />Discard editing draft</button>
								</span>
							</div>
						{/if}
						<dl class="-mt-1 grid grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)] gap-x-6 text-sm @min-[34rem]/opportunity:grid-cols-[9rem_minmax(0,1fr)]">
							{#snippet property(Icon: typeof Clock3, label: string)}
								<dt class="text-muted flex min-h-10 items-center gap-2.5"><Icon size={15} aria-hidden="true" />{label}</dt>
							{/snippet}
							<div class="col-span-2 grid grid-cols-subgrid">
								{@render property(Columns3, "Stage")}
								<dd class="flex min-h-10 items-center">
									<Select appearance="pill" class="max-w-full" id="selected-stage" label="Pipeline stage" value={selected.stage} dot={`var(--color-${stageTones[selected.stage]})`} disabled={pending} options={optionsFrom(stageLabels)} onchange={(stage) => selected && moveCard(selected, stage)} />
								</dd>
							</div>
							<div class="col-span-2 grid grid-cols-subgrid">
								{@render property(Shapes, "Type")}
								<dd class="flex min-h-10 items-center">
									<span class="chip" data-tone={style.tone}><TypeIcon size={12} strokeWidth={2.25} aria-hidden="true" />{typeLabels[selected.type]}</span>
								</dd>
							</div>
							<div class="col-span-2 grid grid-cols-subgrid">
								{@render property(Clock3, "Timeline")}
								<dd class="flex min-h-10 items-center">
									<Select
										appearance="pill"
										label="Timeline"
										value={selected.timeline ?? ""}
										disabled={pending}
										options={[{ value: "", label: "No timeline" }, ...optionsFrom(timelineLabels)]}
										onchange={(value) => {
											if (selected && value !== (selected.timeline ?? "")) void saveField({ timeline: value }, "Saving timeline…", "Timeline saved.", "Timeline could not be saved or has changed. Refresh before retrying.");
										}} />
								</dd>
							</div>
							<div class="col-span-2 grid grid-cols-subgrid">
								{@render property(ContactRound, "Clients")}
								<dd class="flex min-h-10 flex-wrap items-center gap-1.5 py-1.5">
									{#each linked as client (client.id)}
										<a href={`/registry?client=${encodeURIComponent(client.id)}`} class="chip pl-0.5">
											<span class="grid size-5 shrink-0 place-items-center rounded-sm bg-current/12" aria-hidden="true"><UserRound size={12} strokeWidth={2.25} /></span>
											<span class="truncate">{client.name}</span>
										</a>
									{:else}<span class="text-muted">No clients</span>{/each}
								</dd>
							</div>
							<div class="col-span-2 grid grid-cols-subgrid">
								{@render property(Tags, "Tags")}
								<dd class="flex min-h-10 flex-wrap items-center gap-1.5 py-1.5">
									{#each tags as tag (tag.id)}
										<span class="chip" data-dot style:--dot={tag.color}>{tag.name}</span>
									{:else}<span class="text-muted">None</span>{/each}
								</dd>
							</div>
							<div class="col-span-2 grid grid-cols-subgrid">
								{@render property(Banknote, "Budget")}
								<dd class="flex min-h-10 items-center">
									{#if inlineEditing === "budget"}
										<input
											class="field w-40 tabular-nums"
											inputmode="decimal"
											placeholder="125000.50"
											aria-label="Budget (USD)"
											maxlength="20"
											bind:value={inlineDraft}
											disabled={pending}
											{@attach (input) => {
												input.focus();
												input.select();
											}}
											onkeydown={(event) => {
												if (event.key === "Enter") {
													event.preventDefault();
													void commitInline();
												}
												if (event.key === "Escape") {
													event.preventDefault();
													inlineEditing = "";
													inlineDraft = "";
												}
											}}
											onblur={() => {
												if (inlineEditing === "budget") void commitInline();
											}} />
									{:else}
										<span class="group/inline flex min-w-0 items-center gap-0.5">
											<span class={["min-w-0 wrap-anywhere", selected.budgetCents == null && "text-muted"]}>{selected.budgetCents == null ? "Not set" : money.format(selected.budgetCents / 100)}</span>
											<button type="button" class="control pointer-fine:opacity-0 pointer-fine:group-hover/inline:opacity-100 pointer-fine:focus-visible:opacity-100" data-variant="ghost" data-size="sm" data-icon aria-label="Edit budget" title="Edit budget" disabled={pending} onclick={() => startInline("budget")}
												><PencilLine size={13} aria-hidden="true" /></button>
										</span>
									{/if}
								</dd>
							</div>
							<div class="col-span-2 grid grid-cols-subgrid">
								{@render property(MapPin, "Address")}
								<dd class="flex min-h-10 items-center">
									{#if inlineEditing === "address"}
										<input
											class="field min-w-0"
											aria-label="Property address"
											maxlength="1000"
											bind:value={inlineDraft}
											disabled={pending}
											{@attach (input) => {
												input.focus();
												input.select();
											}}
											onkeydown={(event) => {
												if (event.key === "Enter") {
													event.preventDefault();
													void commitInline();
												}
												if (event.key === "Escape") {
													event.preventDefault();
													inlineEditing = "";
													inlineDraft = "";
												}
											}}
											onblur={() => {
												if (inlineEditing === "address") void commitInline();
											}} />
									{:else}
										<span class="group/inline flex min-w-0 items-center gap-0.5">
											<span class={["min-w-0 wrap-anywhere", !selected.address && "text-muted"]}>{selected.address || "Not set"}</span>
											<button type="button" class="control pointer-fine:opacity-0 pointer-fine:group-hover/inline:opacity-100 pointer-fine:focus-visible:opacity-100" data-variant="ghost" data-size="sm" data-icon aria-label="Edit address" title="Edit address" disabled={pending} onclick={() => startInline("address")}
												><PencilLine size={13} aria-hidden="true" /></button>
										</span>
									{/if}
								</dd>
							</div>
						</dl>
					{/if}
				</div>
				<div class="border-hairline bg-paper/30 min-w-0 border-y @min-[48rem]/opportunity:col-start-2 @min-[48rem]/opportunity:row-span-2 @min-[48rem]/opportunity:row-start-1 @min-[48rem]/opportunity:border-y-0 @min-[48rem]/opportunity:border-l">
					<section
						class="px-2 pt-5 pb-6 sm:px-6 @min-[48rem]/opportunity:sticky @min-[48rem]/opportunity:top-[3.5625rem] @min-[48rem]/opportunity:max-h-[calc(min(92dvh,64rem)-3.5625rem)] @min-[48rem]/opportunity:overflow-y-auto @min-[48rem]/opportunity:px-3 @min-[48rem]/opportunity:pt-6"
						aria-label="Inspected-stage checklist"
						aria-busy={pending}>
						<div class="px-2.5">
							<div class="flex items-baseline justify-between gap-3">
								<h3 class="font-display text-xl tracking-tight">{stageLabels[checklist?.stage ?? selected.stage]} checklist</h3>
								{#if checklist?.items.length}<span class="chip shrink-0 tabular-nums"><span class="sr-only">Complete: </span>{done} of {checklist.items.length}</span>{/if}
							</div>
							{#if checklist?.items.length}
								<div class="mt-2.5 flex gap-1" aria-hidden="true">
									{#each checklist.items as item (item.id)}<span class={["h-1 flex-1 rounded-full transition-colors duration-300", item.completedAt ? "bg-field" : "bg-ink/10"]}></span>{/each}
								</div>
							{/if}
							{#if checklist && checklist.stage !== selected.stage}
								<div class="bg-tour-soft text-tour mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl py-1.5 pr-1.5 pl-4 text-sm [--action-color:var(--color-tour)]">
									<span class="min-w-0 flex-1 basis-60 py-1">Viewing earlier {stageLabels[checklist.stage]} work. The opportunity is still in {stageLabels[selected.stage]}.</span>
									<button type="button" class="control -ml-3" data-variant="ghost" data-size="sm" disabled={pending} onclick={() => (inspectedStage = "")}><ArrowLeft size={15} aria-hidden="true" />Return to current checklist</button>
								</div>
							{/if}
						</div>
						{#if checklist}
							<ul class="mt-3 space-y-0.5">
								{#each checklist.items as item, index (`${checklist.id}:${item.id}`)}
									<ChecklistItem
										{item}
										{checklist}
										today={workspace.businessToday}
										busy={pending}
										first={index === 0}
										last={index === checklist.items.length - 1}
										dragging={checklistDrag === index}
										drop={checklistDropAt === index ? "above" : checklistDropAt === index + 1 ? "below" : null}
										save={saveStep}
										rename={(title) => rename(item, title)}
										remove={() => removeItem(item)}
										move={(offset) => reorder(index, offset > 0 ? index + 2 : index - 1)}
										dragstart={(event) => checklistDragStart(event, index)}
										dragover={(event) => checklistDragOver(event, index)}
										dropItem={() => void checklistDrop()}
										dragend={clearChecklistDrag} />
								{:else}<li class="text-muted px-2.5 py-4 text-sm">No items in this stage’s checklist.</li>{/each}
							</ul>
							{#if adding}
								<div class="mt-0.5 flex items-center gap-2 py-1 pr-1 pl-2.5">
									<span class="border-muted/40 size-5 shrink-0 rounded-full border-[1.5px] border-dashed" aria-hidden="true"></span>
									<input
										class="field min-h-8 rounded-lg px-2 py-1"
										aria-label="New checklist item"
										placeholder="Describe the item, then press Enter"
										maxlength="200"
										disabled={pending}
										{@attach (input) => input.focus()}
										onkeydown={(event) => {
											if (event.key === "Enter") {
												event.preventDefault();
												void addItem(event.currentTarget);
											}
											if (event.key === "Escape") {
												event.preventDefault();
												event.stopPropagation();
												adding = false;
											}
										}}
										onblur={(event) => {
											if (!event.currentTarget.value.trim() && !pending) adding = false;
										}} />
								</div>
							{:else}
								<button type="button" class="text-action mt-0.5 flex min-h-9 w-full items-center gap-3 px-2.5" disabled={pending || !ready} onclick={() => (adding = true)}>
									<span class="flex size-5 items-center justify-center"><Plus size={16} aria-hidden="true" /></span>Add item
								</button>
							{/if}
						{:else}<p class="text-muted px-2.5 py-6 text-sm">Loading this stage’s checklist…</p>{/if}
					</section>
				</div>
				{#if !editing}
					<div class="min-w-0 space-y-7 px-4 pt-7 pb-8 sm:px-8 @min-[48rem]/opportunity:pt-0">
						<section aria-labelledby="references-heading">
							<h3 id="references-heading" class="mb-2.5 flex items-baseline gap-2 text-sm font-semibold">References<span class="chip tabular-nums">{references.length}</span></h3>
							{#if references.length}
								<ReferenceList {workspace} {references} openOpportunity={(id) => (workspace.opportunities.some((row) => row.id === id) ? (open(id), true) : false)} remove={removeReference} />
							{:else}
								<p class="text-muted border-hairline rounded-xl border border-dashed px-3 py-3 text-xs">No references yet. Add links to listings, documents, or related records.</p>
							{/if}
							{#if referenceAdding}
								<form
									onsubmit={(event) => {
										event.preventDefault();
										void saveReferenceAdd();
									}}>
									<div class="bg-paper/50 grid min-w-0 gap-2 rounded-xl border border-transparent p-2">
										<Select label="New reference kind" bind:value={referenceDraft.kind} options={referenceKinds} onchange={() => (referenceDraft.destination = "")} />
										<input class="field" aria-label="New reference label" placeholder="Label" bind:value={referenceDraft.label} required maxlength="200" />
										{#if referenceDraft.kind === "url"}<input class="field" type="url" aria-label="New reference link" bind:value={referenceDraft.destination} required maxlength="2000" placeholder="https://" />{:else}<Select
												label="New reference record"
												bind:value={referenceDraft.destination}
												required
												options={referenceTargets(workspace, referenceDraft.kind)} />{/if}
										<div class="flex flex-wrap items-center justify-between gap-2">
											<p class="text-muted flex items-center gap-1.5 text-xs"><Link2 size={13} aria-hidden="true" />HTTP and HTTPS links only.</p>
											<div class="flex gap-2">
												<button type="button" class="control" data-size="sm" disabled={pending} onclick={() => (referenceAdding = false)}>Cancel</button>
												<button class="control" data-size="sm" data-variant="primary" disabled={pending}>{pending ? "Saving…" : "Add reference"}</button>
											</div>
										</div>
									</div>
								</form>
							{:else}
								<button type="button" class="text-action mt-2" disabled={pending || references.length >= 50} onclick={startReferenceAdd}><Plus size={16} aria-hidden="true" />Add reference</button>
							{/if}
						</section>
						<section>
							<div role="tablist" aria-label="Notes and history" tabindex="-1" class="tabs" data-slide style:--tab-count={tabs.length} style:--tab-index={tabs.findIndex(({ id }) => id === tab)} onkeydown={switchTab}>
								{#each tabs as { id, label } (id)}
									{@const count = id === "history" ? changes.length : 0}
									<button type="button" role="tab" id={`opportunity-tab-${id}`} aria-selected={tab === id} aria-controls={`opportunity-panel-${id}`} tabindex={tab === id ? 0 : -1} class="tab -mb-px flex items-center gap-1.5 transition-colors" onclick={() => (tab = id)}
										>{label}{#if count}<span class="chip tabular-nums">{count}</span>{/if}</button>
								{/each}
							</div>
							<div id={`opportunity-panel-${tab}`} role="tabpanel" aria-labelledby={`opportunity-tab-${tab}`} class="-mx-3 pt-3">
								{#if tab === "notes"}
									<OpportunityNotes {workspace} {remote} opportunityId={selected.id} notes={selected.notes} bind:pending saved={() => announce("Notes saved.")} />
								{:else}
									<OpportunityHistory {workspace} {changes} />
								{/if}
							</div>
						</section>
					</div>
				{/if}
			</div>
		</div>
	</dialog>
{/if}
