<script lang="ts">
	import "./style-guide.css";
	import type { Attachment } from "svelte/attachments";
	import { onMount } from "svelte";
	import { Archive, ArrowLeft, Banknote, Bookmark, Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, CircleAlert, Clock3, Columns3, ContactRound, DollarSign, Inbox, Link2, MapPin, PencilLine, Pin, PinOff, Plus, RefreshCw, Search, Shapes, Tags, Trash2, Undo2, UserRound, X } from "@lucide/svelte";
	import { chooseTheme, themes } from "#lib/shell/themes.js";
	import DashboardCard from "#lib/dashboard/DashboardCard.svelte";
	import Scorecard from "#lib/dashboard/Scorecard.svelte";
	import TaskList from "#lib/tasks/TaskList.svelte";
	import DueBadge from "#lib/ui/DueBadge.svelte";
	import Menu from "#lib/ui/Menu.svelte";
	import OpportunityCard from "#lib/pipeline/OpportunityCard.svelte";
	import ChecklistItem from "#lib/pipeline/ChecklistItem.svelte";
	import ReferenceList from "#lib/pipeline/ReferenceList.svelte";
	import { dueLabel } from "#lib/pipeline/due.js";
	import { stageLabels, stageTones, timelineLabels, typeLabels, typeStyles } from "#lib/pipeline/labels.js";
	import { sampleCards, sampleChecklist, sampleItems, sampleReferences, sampleReferenceWorkspace, sampleTasks, today, type ChecklistRecord, type SampleCard } from "./fixtures.js";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";
	import { guide, guideSections, type GuideSectionId } from "./guide.svelte.js";
	import Select, { optionsFrom } from "#lib/ui/Select.svelte";
	import StageMark, { stageNumerals } from "./kit/StageMark.svelte";
	import InputExplorations from "./kit/InputExplorations.svelte";
	import OverlayExplorations from "./kit/OverlayExplorations.svelte";
	import FeedbackExplorations from "./kit/FeedbackExplorations.svelte";
	type Stage = keyof typeof stageLabels;
	type OpportunityType = keyof typeof typeLabels;

	const pageId = $props.id();
	const fontPairs = {
		cream: { display: "Newsreader", body: "DM Sans" },
		evening: { display: "Instrument Serif", body: "Instrument Sans" },
		pop: { display: "Bricolage Grotesque", body: "Bricolage Grotesque" },
		butter: { display: "Fredoka", body: "Nunito" },
		sage: { display: "Young Serif", body: "Work Sans" },
		lilac: { display: "Fraunces", body: "Figtree" },
	} as const;
	let activeTheme = $state<keyof typeof fontPairs>("pop");
	let fontPair = $derived(fontPairs[activeTheme]);
	let composition = $state("Original");
	onMount(() => {
		const sync = () => {
			const value = document.documentElement.dataset.theme;
			activeTheme = themes.find((theme) => theme.id === value)?.id ?? "pop";
		};
		sync();
		const observer = new MutationObserver(sync);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
		return () => observer.disconnect();
	});

	onMount(() => {
		guide.restore();
		const target = guideSections.find((section) => `#${section.id}` === location.hash);
		if (target) void guide.reveal(target.id);
	});

	// The ancestor main scrolls, so its position drives the mask, like the dashboard's. The top fade starts under whichever section header is pinned, so the header stays solid while content fades beneath it.
	const contentFade = overflowFade({
		axis: "y",
		scrollSource: (element) => element.closest<HTMLElement>("#workspace-main"),
		startInset: (source) => {
			const top = source.getBoundingClientRect().top;
			for (const summary of source.querySelectorAll("[data-guide-section] > details > summary")) {
				const box = summary.getBoundingClientRect();
				if (box.top <= top + 1 && box.bottom > top) return box.bottom - top;
			}
			return 0;
		},
	});

	// Marks the section crossing the upper band of the main surface as current, for the rail.
	const spy: Attachment<HTMLElement> = (root) => {
		const visible = new Set<string>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) visible.add(entry.target.id);
					else visible.delete(entry.target.id);
				}
				const first = guideSections.find((section) => visible.has(section.id));
				if (first) guide.active = first.id;
			},
			{ root: document.getElementById("workspace-main"), rootMargin: "-12% 0px -70% 0px" },
		);
		for (const section of root.querySelectorAll("[data-guide-section]")) observer.observe(section);
		return () => observer.disconnect();
	};

	// Resolves any color the browser understands, including color-mix() and relative colors, to hex for the swatch labels.
	let probe: CanvasRenderingContext2D | null = null;
	function hex(color: string) {
		probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
		if (!probe) return "";
		probe.clearRect(0, 0, 1, 1);
		probe.fillStyle = color;
		probe.fillRect(0, 0, 1, 1);
		const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data;
		return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
	}
	const swatchValue: Attachment<HTMLElement> = (node) => {
		void activeTheme;
		const label = node.parentElement?.querySelector("[data-value]");
		if (label) label.textContent = hex(getComputedStyle(node).backgroundColor);
	};

	const surfaces = [
		{ token: "paper", label: "paper", use: "Viewport and rail" },
		{ token: "canvas", label: "canvas", use: "Gradient end, dialogs" },
		{ token: "white", label: "white", use: "Cards, fields, controls" },
		{ token: "paper-pill", label: "paper-pill", use: "Scrollbars, placeholder bars" },
		{ token: "highlight", label: "highlight", use: "Hover, keyboard-active rows" },
		{ token: "selected", label: "selected", use: "Current navigation, selected options" },
		{ token: "hairline", label: "hairline", use: "1px boundaries" },
		{ token: "muted", label: "muted", use: "Supporting text" },
		{ token: "ink", label: "ink", use: "Content" },
	];
	const actions = [
		{ token: "field", label: "field", use: "Links, focus, checks", value: "var(--color-field)" },
		{ token: "field-deep", label: "field-deep", use: "Link hover", value: "var(--color-field-deep)" },
		{ token: "primary", label: "primary", use: "Primary buttons", value: "var(--color-primary)" },
		{ token: "primary-hover", label: "primary hover", use: "Primary hover", value: "var(--color-primary-hover)" },
	];
	// Full class names so Tailwind generates every tone.
	const tones = [
		{ id: "info", use: "New lead · upcoming", soft: "bg-info-soft", text: "text-info", fill: "bg-info" },
		{ id: "pending", use: "Active lead · due today", soft: "bg-pending-soft", text: "text-pending", fill: "bg-pending" },
		{ id: "tour", use: "Under contract", soft: "bg-tour-soft", text: "text-tour", fill: "bg-tour" },
		{ id: "success", use: "Closed · confirmed", soft: "bg-success-soft", text: "text-success", fill: "bg-success" },
		{ id: "urgent", use: "Overdue · destructive", soft: "bg-urgent-soft", text: "text-urgent", fill: "bg-urgent" },
	] as const;
	const stages = Object.keys(stageLabels) as Stage[];
	const types = Object.keys(typeLabels) as OpportunityType[];
	const states = ["rest", "disabled", "busy"] as const;
	type State = (typeof states)[number];
	const buttonKinds = [
		{ id: "secondary", label: "Secondary" },
		{ id: "primary", label: "Primary" },
		{ id: "leading", label: "With icon" },
		{ id: "icon", label: "Icon" },
		{ id: "compact", label: "Compact icon" },
		{ id: "quiet", label: "Quiet icon" },
		{ id: "text", label: "Text action" },
	] as const;
	const panelTabs = [
		{ id: "notes", label: "Notes", count: 0 },
		{ id: "history", label: "History", count: 3 },
	] as const;
	const tags = [
		{ name: "sphere", color: "var(--color-success)" },
		{ name: "nurture", color: "var(--color-pending)" },
	];
	const stateAttributes = (state: State) => ({
		disabled: state === "disabled" || state === "busy",
		"aria-busy": state === "busy" ? ("true" as const) : undefined,
	});
	let cards = $state(sampleCards);
	let selectedId = $state(sampleCards[0]!.opportunity.id);
	let selected = $derived(cards.find((card) => card.opportunity.id === selectedId) ?? cards[0]!);
	let items = $state(sampleItems);
	let done = $derived(items.filter((item) => item.completedAt).length);
	let dialogOpen = $state(false);
	let editingTimeline = $state(false);
	let timelineDraft = $state("");
	let bookmarked = $state(false);
	let adding = $state(false);
	let tabs = $state<Record<string, "notes" | "history">>({});
	const activeTab = (scope: string) => tabs[scope] ?? "notes";
	let toast = $state<{ id: number; text: string } | null>(null);
	let form = $state({ name: "Ada Maple", birthday: "1988-04-12", phoneLabel: "Mobile", phone: "(555) 014-2290", email: "ada.maple@", source: "Referral", referredBy: "Leo Birch", tags: ["sphere"], consent: ["call", "text", "email", "mail"], preferences: "Prefers texts after 5 PM. Goes by Ada, never Adaline." });
	let emailInvalid = $state(false);
	let sampleStage = $state<Stage>("active-lead");
	let typeFilter = $state("buyer");
	const leadSources = ["Referral", "Open house", "Sign", "Website", "Walk-in"];

	function announce(text: string) {
		toast = { id: Date.now(), text };
	}
	function open(card: SampleCard) {
		selectedId = card.opportunity.id;
		dialogOpen = true;
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
	function togglePin(card: SampleCard) {
		card.opportunity.pinnedAt = card.opportunity.pinnedAt ? null : new Date().toISOString();
	}
	async function saveItem(input: { itemId: string; completed: boolean; dueDate: string | null }) {
		const item = items.find((row) => row.id === input.itemId);
		if (!item) return;
		item.completedAt = input.completed ? new Date().toISOString() : null;
		item.dueDate = input.dueDate;
	}
	async function moveItem(index: number, offset: -1 | 1) {
		const next = [...items];
		const [item] = next.splice(index, 1);
		next.splice(index + offset, 0, item!);
		items = next;
	}
	function addItem(input: HTMLInputElement) {
		const title = input.value.trim();
		if (!title) return;
		items.push({ id: crypto.randomUUID(), title, completedAt: null, dueDate: null, revision: 1 } as unknown as ChecklistRecord);
		input.value = "";
	}
	function submitForm(event: SubmitEvent) {
		event.preventDefault();
		emailInvalid = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email);
		if (!emailInvalid) announce("Simulated: nothing was saved.");
	}
	const noop = () => {};
	const simulated = (action: string) => () => announce(`Simulated: ${action}.`);
	const bodies: Record<GuideSectionId, typeof paletteBody> = {
		foundations: foundationsBody,
		surfaces: allSurfacesBody,
		buttons: buttonsBody,
		fields: allFieldsBody,
		choices: selectionBody,
		chips: chipsBody,
		overlays: overlayExplorationsBody,
		patterns: patternsBody,
	};
</script>

{#snippet foundationsBody()}{@render paletteBody()}{@render typeBody()}{/snippet}
{#snippet allSurfacesBody()}{@render surfacesBody()}{/snippet}
{#snippet allFieldsBody()}{@render fieldsBody()}{@render inputExplorationsBody()}{/snippet}
{#snippet patternsBody()}{@render cardsBody()}{@render opportunityBody()}{@render formBody()}{@render feedbackBody()}{@render feedbackExplorationsBody()}{/snippet}

{#snippet subheading(text: string, note?: string)}
	<div class="mb-4">
		<h3 class="text-sm font-semibold">{text}</h3>
		{#if note}<p class="text-muted mt-0.5 max-w-2xl text-xs/5 text-pretty">{note}</p>{/if}
	</div>
{/snippet}

{#snippet fieldLabel(text: string)}
	<span class="text-muted block text-xs font-medium">{text}</span>
{/snippet}

{#snippet typeChip(type: OpportunityType)}
	{@const style = typeStyles[type]}
	<span class="chip" data-tone={style.tone}><style.icon size={12} strokeWidth={2.25} aria-hidden="true" />{typeLabels[type]}</span>
{/snippet}

{#snippet tagChip(tag: (typeof tags)[number])}
	<span class="chip" data-dot style:--dot={tag.color}>{tag.name}</span>
{/snippet}

{#snippet clientChip(client: string, href: string)}
	<a {href} class="chip pl-0.5"><span class="grid size-5 shrink-0 place-items-center rounded-sm bg-current/12" aria-hidden="true"><UserRound size={12} strokeWidth={2.25} /></span><span class="truncate">{client}</span></a>
{/snippet}

{#snippet swatch(label: string, use: string, value: string)}
	<figure class="min-w-0">
		<div class="ring-ink/8 h-16 rounded-2xl ring-1 ring-inset" style:background={value} {@attach swatchValue}></div>
		<figcaption class="mt-2 px-0.5 text-xs">
			<span class="flex items-baseline justify-between gap-2"><span class="truncate font-medium">{label}</span><span class="text-muted shrink-0 tabular-nums" data-value></span></span>
			<span class="text-muted block truncate">{use}</span>
		</figcaption>
	</figure>
{/snippet}

{#snippet sampleButton(kind: (typeof buttonKinds)[number]["id"], state: State)}
	{@const busy = state === "busy"}
	{#if kind === "secondary"}
		<button type="button" class="control" {...stateAttributes(state)}>{busy ? "Saving…" : "Cancel"}</button>
	{:else if kind === "primary"}
		<button type="button" class="control" data-variant="primary" {...stateAttributes(state)}>{busy ? "Saving…" : "Save"}</button>
	{:else if kind === "leading"}
		<button type="button" class="control" {...stateAttributes(state)}><Plus size={16} aria-hidden="true" />{busy ? "Adding…" : "Add client"}</button>
	{:else if kind === "icon"}
		<button type="button" class="control" data-icon aria-label="Edit opportunity" {...stateAttributes(state)}><PencilLine size={16} aria-hidden="true" /></button>
	{:else if kind === "compact"}
		<button type="button" class="control" data-size="sm" data-icon aria-label="Bookmark opportunity" {...stateAttributes(state)}><Bookmark size={16} aria-hidden="true" /></button>
	{:else if kind === "quiet"}
		<button type="button" class="control" data-variant="ghost" data-size="sm" data-icon aria-label="Close" {...stateAttributes(state)}><X size={17} aria-hidden="true" /></button>
	{:else}
		<button type="button" class="text-action" {...stateAttributes(state)}><Plus size={16} aria-hidden="true" />{busy ? "Adding…" : "Add reference"}</button>
	{/if}
{/snippet}

{#snippet opportunityPanel(inDialog: boolean)}
	<fieldset class="p-4">
		<legend class="sr-only">Opportunity composition</legend>
		<div class="segmented">
			{#each ["Original", "Record first", "Work first"] as option (option)}<label><input type="radio" name={`${pageId}-${inDialog ? "dialog" : "inline"}-composition`} value={option} bind:group={composition} />{option}</label>{/each}
		</div>
	</fieldset>
	{#if composition === "Original"}
		{@render originalOpportunityPanel(inDialog)}
	{:else}
		{@render alternateOpportunityPanel(inDialog, composition === "Work first")}
	{/if}
{/snippet}

{#snippet timelineValue()}
	{#if editingTimeline}
		<div class="inline-flex max-w-full items-center gap-1">
			<Select appearance="pill" label="Edit timeline" bind:value={timelineDraft} options={[{ value: "", label: "No timeline" }, ...Object.entries(timelineLabels).map(([value, label]) => ({ value, label }))]} />
			<button
				type="button"
				class="control"
				data-variant="ghost"
				data-size="sm"
				data-icon
				aria-label="Save timeline"
				onclick={() => {
					selected.opportunity.timeline = (timelineDraft || null) as typeof selected.opportunity.timeline;
					editingTimeline = false;
				}}><Check size={14} aria-hidden="true" /></button>
		</div>
	{:else}
		<span class="group/timeline inline-flex items-center gap-1"
			><span class="text-sm font-medium">{selected.opportunity.timeline ? timelineLabels[selected.opportunity.timeline] : "No timeline"}</span><button
				type="button"
				class="control pointer-fine:opacity-0 pointer-fine:group-focus-within/timeline:opacity-100 pointer-fine:group-hover/timeline:opacity-100"
				data-variant="ghost"
				data-size="sm"
				data-icon
				aria-label="Edit timeline"
				onclick={() => {
					timelineDraft = selected.opportunity.timeline ?? "";
					editingTimeline = true;
				}}><PencilLine size={12} aria-hidden="true" /></button
			></span>
	{/if}
{/snippet}

{#snippet compactStage(scope: string)}
	<fieldset>
		<legend class="text-muted mb-2 text-xs font-medium">Stage</legend>
		<div class="bg-paper/70 grid grid-cols-2 gap-1 rounded-2xl p-1 @min-[36rem]/opportunity:grid-cols-4">
			{#each stages as stage (stage)}
				<label class="has-focus-visible:outline-field flex min-h-10 min-w-0 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-white/60 has-checked:bg-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2">
					<input type="radio" name={`${scope}-stage`} class="sr-only" checked={stage === selected.opportunity.stage} onchange={() => (selected.opportunity.stage = stage)} />
					<StageMark {stage} /><span class="min-w-0 text-xs font-medium">{stageLabels[stage]}</span>
				</label>
			{/each}
		</div>
	</fieldset>
{/snippet}

{#snippet recordFacts()}
	<dl class="divide-hairline [&_dt]:text-muted divide-y text-sm [&_dt]:text-xs [&>div]:grid [&>div]:grid-cols-[5.5rem_minmax(0,1fr)] [&>div]:items-center [&>div]:gap-3 [&>div]:py-3">
		<div>
			<dt>Timeline</dt>
			<dd>{@render timelineValue()}</dd>
		</div>
		<div>
			<dt>Budget</dt>
			<dd class="font-medium tabular-nums">{selected.budget || "Not set"}</dd>
		</div>
		<div>
			<dt>Property</dt>
			<dd class="font-medium text-pretty">{selected.address || "Not set"}</dd>
		</div>
		<div>
			<dt>Clients</dt>
			<dd class="flex flex-wrap gap-1.5">
				{#each selected.clients as client (client)}{@render clientChip(client, "#opportunity")}{/each}
			</dd>
		</div>
		<div>
			<dt>Tags</dt>
			<dd class="flex flex-wrap gap-1.5">{@render tagChip(tags[0]!)}</dd>
		</div>
	</dl>
{/snippet}

{#snippet recordNotes(scope: string)}
	<section class="mt-6">
		{@render underlineTabs("Notes and history", true, scope)}
		{#each panelTabs as entry (entry.id)}
			<div id={`${scope}-${entry.id}-panel`} role="tabpanel" aria-labelledby={`${scope}-${entry.id}-tab`} hidden={activeTab(scope) !== entry.id} class="pt-3 text-sm/6">
				{#if entry.id === "notes"}<p>Ada and Eli want a yard for the dog and a short walk to the library. Flexible on closing date.</p>
				{:else}<ol class="space-y-3">
						<li>
							<p class="font-medium">Moved to Active lead</p>
							<p class="text-muted text-xs">Assistant · 2 days ago</p>
						</li>
						<li>
							<p class="font-medium">Pinned</p>
							<p class="text-muted text-xs">Realtor · 3 days ago</p>
						</li>
						<li>
							<p class="font-medium">Created</p>
							<p class="text-muted text-xs">Assistant · last week</p>
						</li>
					</ol>{/if}
			</div>
		{/each}
	</section>
{/snippet}

{#snippet alternateOpportunityPanel(inDialog: boolean, workFirst: boolean)}
	{@const opportunity = selected.opportunity}
	{@const style = typeStyles[opportunity.type]}
	{@const scope = `${pageId}-${inDialog ? "dialog" : "inline"}`}
	<div class="@container/opportunity relative isolate" style:--wash={`var(--color-category-${style.tone})`}>
		<div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-52 bg-linear-to-b from-(--wash)/65 to-transparent" aria-hidden="true"></div>
		<header class="border-hairline flex flex-wrap items-center gap-2 border-b px-5 py-3 sm:px-7">
			<span class="text-muted mr-auto flex items-center gap-2 text-xs"><Columns3 size={14} aria-hidden="true" />Pipeline</span>
			<button type="button" class="control" data-variant="ghost" data-size="sm" data-icon aria-pressed={bookmarked} aria-label={bookmarked ? "Remove bookmark" : "Bookmark opportunity"} onclick={() => (bookmarked = !bookmarked)}><Bookmark size={15} class={bookmarked ? "fill-current" : null} aria-hidden="true" /></button>
			<button type="button" class="control" data-variant="ghost" data-size="sm" data-icon aria-pressed={!!opportunity.pinnedAt} aria-label={opportunity.pinnedAt ? "Unpin opportunity" : "Pin opportunity"} onclick={() => togglePin(selected)}><Pin size={15} aria-hidden="true" /></button>
			<button type="button" class="control" data-variant="ghost" data-size="sm" data-icon aria-label="Edit opportunity" onclick={simulated("the editor is not part of this demo")}><PencilLine size={15} aria-hidden="true" /></button>
			<Menu label="Opportunity actions"
				><button type="button" role="menuitem" class="menu-item" onclick={simulated("archived")}><Archive size={15} aria-hidden="true" />Archive opportunity</button><button type="button" role="menuitem" class="menu-item" data-tone="danger" onclick={simulated("deleted")}
					><Trash2 size={15} aria-hidden="true" />Delete opportunity</button
				></Menu>
			{#if inDialog}<button type="button" class="control" data-variant="ghost" data-size="sm" data-icon data-autofocus aria-label="Close" onclick={() => (dialogOpen = false)}><X size={17} aria-hidden="true" /></button>{/if}
		</header>
		{#if !workFirst}
			<div class="px-5 pt-6 pb-5 sm:px-7">
				<div class="mb-3 flex items-center gap-2">
					{@render typeChip(opportunity.type)}{#if opportunity.pinnedAt}<span class="chip"><Pin size={12} strokeWidth={2.25} class="rotate-45 fill-current" aria-hidden="true" />Pinned</span>{/if}
				</div>
				<h2 id={inDialog ? "sg-opportunity-heading" : undefined} class="font-display text-3xl/tight tracking-tight text-balance">{opportunity.title}</h2>
				<div class="mt-5">{@render compactStage(scope)}</div>
			</div>
		{/if}
		<div class={["grid min-w-0", workFirst ? "@min-[48rem]/opportunity:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" : "@min-[48rem]/opportunity:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)]"]}>
			<div class="min-w-0 px-5 pt-2 pb-7 sm:px-7">
				{#if workFirst}<div class="pt-4 pb-5">
						{@render typeChip(opportunity.type)}
						<h2 id={inDialog ? "sg-opportunity-heading" : undefined} class="font-display mt-3 text-3xl/tight tracking-tight text-balance">{opportunity.title}</h2>
						<div class="mt-5 space-y-2">
							<span class="text-muted text-xs">Stage</span><Select appearance="pill" class="max-w-full" label="Opportunity stage" value={opportunity.stage} dot={`var(--color-${stageTones[opportunity.stage]})`} options={optionsFrom(stageLabels)} onchange={(stage) => (opportunity.stage = stage)} />
						</div>
					</div>{/if}
				{@render recordFacts()}
				{@render recordNotes(`${pageId}-${inDialog ? "dialog" : "inline"}`)}
			</div>
			{@render workingMaterial(opportunity.stage)}
		</div>
	</div>
{/snippet}

{#snippet originalOpportunityPanel(inDialog: boolean)}
	{@const opportunity = selected.opportunity}
	{@const current = stages.indexOf(opportunity.stage)}
	{@const style = typeStyles[opportunity.type]}
	{@const scope = `${pageId}-${inDialog ? "dialog" : "inline"}`}
	<div style:--wash={`var(--color-category-${style.tone})`}>
		<header class="border-hairline sticky top-0 z-20 flex flex-wrap items-center gap-1.5 border-b bg-(--wash)/85 px-4 py-2.5 backdrop-blur-md sm:px-6">
			<span class="text-muted flex min-w-0 items-center gap-1.5 text-sm">
				<Columns3 size={14} class="shrink-0" aria-hidden="true" />Pipeline<span aria-hidden="true">/</span>
				<span class="size-2 shrink-0 rounded-full" style:background={`var(--color-${stageTones[opportunity.stage]})`} aria-hidden="true"></span>
				<span class="text-ink truncate font-medium">{stageLabels[opportunity.stage]}</span>
			</span>
			<span class="ml-auto"></span>
			<button type="button" class="control" data-variant="ghost" data-size="sm" data-icon aria-pressed={bookmarked} aria-label={bookmarked ? "Remove bookmark" : "Bookmark opportunity"} title={bookmarked ? "Remove bookmark" : "Bookmark opportunity"} onclick={() => (bookmarked = !bookmarked)}
				><Bookmark size={16} class={bookmarked ? "fill-current" : null} aria-hidden="true" /></button>
			<button
				type="button"
				class="control"
				data-variant="ghost"
				data-size="sm"
				data-icon
				aria-pressed={!!opportunity.pinnedAt}
				aria-label={opportunity.pinnedAt ? "Unpin opportunity" : "Pin opportunity"}
				title={opportunity.pinnedAt ? "Unpin from the top of its stage" : "Pin to the top of its stage"}
				onclick={() => togglePin(selected)}>
				{#if opportunity.pinnedAt}<PinOff size={16} aria-hidden="true" />{:else}<Pin size={16} aria-hidden="true" />{/if}
			</button>
			<button type="button" class="control" data-variant="ghost" data-size="sm" data-icon aria-label="Edit opportunity" title="Edit opportunity" onclick={simulated("the editor is not part of this demo")}><PencilLine size={16} aria-hidden="true" /></button>
			<Menu label="Opportunity actions">
				<button type="button" role="menuitem" class="menu-item" onclick={simulated("archived")}><Archive size={15} aria-hidden="true" />Archive opportunity</button>
				<button type="button" role="menuitem" class="menu-item" data-tone="danger" onclick={simulated("deleted")}><Trash2 size={15} aria-hidden="true" />Delete opportunity</button>
			</Menu>
			{#if inDialog}<button class="control" data-variant="ghost" data-size="sm" data-icon type="button" data-autofocus aria-label="Close" onclick={() => (dialogOpen = false)}><X size={17} aria-hidden="true" /></button>{/if}
		</header>
		<div class="@container/opportunity">
			<div class="grid min-w-0 @min-[48rem]/opportunity:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)]">
				<div class="min-w-0 pb-8">
					<!-- The title sits on its category's wash, so the type reads before any label does. -->
					<div class="relative isolate px-5 pt-7 pb-7 text-(--ink) sm:px-8" style:--wash={`var(--color-category-${style.tone})`} style:--ink={`var(--color-category-${style.tone}-ink)`}>
						<div data-opportunity-wash class="absolute inset-0 -z-10 bg-linear-to-b from-(--wash) via-(--wash)/45 to-transparent" aria-hidden="true"></div>
						<div class="flex flex-wrap items-center gap-1.5">
							{@render typeChip(opportunity.type)}
							{#if opportunity.pinnedAt}<span class="chip"><Pin size={12} strokeWidth={2.25} class="rotate-45 fill-current" aria-hidden="true" />Pinned</span>{/if}
						</div>
						<h2 id={inDialog ? "sg-opportunity-heading" : undefined} class="font-display text-ink mt-3.5 text-4xl/tight tracking-tight text-balance wrap-anywhere">{opportunity.title}</h2>
						<p class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
							{#if selected.clients.length}<span class="inline-flex items-center gap-1.5"><ContactRound size={14} aria-hidden="true" />{selected.clients.join(" & ")}</span>{/if}
							{#if selected.address}<span class="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden="true" />{selected.address}</span>{/if}
						</p>
					</div>

					<div class="space-y-8 px-5 sm:px-8">
						<!-- Stages are a sequence, so they read as a stepper: passed stages fill in, and choosing one moves the opportunity. -->
						<fieldset>
							<legend class="text-muted mb-2.5 text-xs font-medium">Stage</legend>
							<div class="bg-paper/70 grid grid-cols-2 gap-1 rounded-2xl p-1 @min-[30rem]/opportunity:grid-cols-4">
								{#each stages as stage, index (stage)}
									<label
										class="has-focus-visible:outline-field flex min-h-10 min-w-0 cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 transition-[background-color,box-shadow] duration-200 hover:bg-white/60 has-checked:bg-white has-checked:shadow-[0_1px_2px_oklch(from_var(--color-ink)_l_c_h/0.06)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
										style:--soft={`var(--color-${stageTones[stage]}-soft)`}
										style:--strong={`var(--color-${stageTones[stage]})`}>
										<input type="radio" name={`${scope}-stage`} class="sr-only" value={stage} checked={stage === opportunity.stage} onchange={() => (opportunity.stage = stage)} />
										<span class={["grid size-6 shrink-0 place-items-center rounded-full font-sans text-xs leading-6 font-medium transition-colors duration-200", index <= current ? "bg-(--strong) text-white" : "bg-(--soft) text-(--strong) ring-1 ring-(--strong)/20 ring-inset"]} aria-hidden="true">{stageNumerals[stage]}</span>
										<span class={["truncate text-xs", index === current ? "font-semibold" : "text-muted font-medium"]}>{stageLabels[stage]}</span>
									</label>
								{/each}
							</div>
						</fieldset>

						<!-- Facts are tiles on a hairline grid rather than a label column, so each value gets room and its own control. -->
						<dl class="border-hairline bg-hairline grid grid-cols-2 gap-px overflow-clip rounded-2xl border @min-[36rem]/opportunity:grid-cols-3">
							<div class="min-w-0 bg-white p-3.5">
								<dt class="text-muted flex items-center gap-1.5 text-xs font-medium"><Clock3 size={13} aria-hidden="true" />Timeline</dt>
								<dd class="mt-1.5">{@render timelineValue()}</dd>
							</div>
							<div class="min-w-0 bg-white p-3.5">
								<dt class="text-muted flex items-center gap-1.5 text-xs font-medium"><Banknote size={13} aria-hidden="true" />Budget</dt>
								<dd class={["mt-1.5 text-sm/8 font-medium tabular-nums", !selected.budget && "text-muted"]}>{selected.budget || "Not set"}</dd>
							</div>
							<div class="col-span-2 min-w-0 bg-white p-3.5 @min-[36rem]/opportunity:col-span-1">
								<dt class="text-muted flex items-center gap-1.5 text-xs font-medium"><MapPin size={13} aria-hidden="true" />Property</dt>
								<dd class={["mt-1.5 text-sm/8 text-pretty", selected.address ? "font-medium" : "text-muted"]}>{selected.address || "Not set"}</dd>
							</div>
							<div class="col-span-2 min-w-0 bg-white p-3.5">
								<dt class="text-muted flex items-center gap-1.5 text-xs font-medium"><ContactRound size={13} aria-hidden="true" />Clients</dt>
								<dd class="mt-2 flex flex-wrap gap-1.5">
									{#each selected.clients as client (client)}{@render clientChip(client, "#opportunity")}{/each}
								</dd>
							</div>
							<div class="col-span-2 min-w-0 bg-white p-3.5 @min-[36rem]/opportunity:col-span-1">
								<dt class="text-muted flex items-center gap-1.5 text-xs font-medium"><Tags size={13} aria-hidden="true" />Tags</dt>
								<dd class="mt-2 flex flex-wrap gap-1.5">
									{#each tags.slice(0, 1) as tag (tag.name)}{@render tagChip(tag)}{/each}
								</dd>
							</div>
						</dl>

						<section>
							{@render underlineTabs("Notes and history", true, scope)}
							{#each panelTabs as entry (entry.id)}
								<div id={`${scope}-${entry.id}-panel`} role="tabpanel" aria-labelledby={`${scope}-${entry.id}-tab`} hidden={activeTab(scope) !== entry.id} class="pt-3">
									{#if entry.id === "notes"}
										<p class="text-sm/6 text-pretty">Ada and Eli want a yard for the dog and a short walk to the library. Flexible on closing date.</p>
									{:else}
										<ol class="space-y-3 text-sm">
											<li class="flex gap-3">
												<span class="bg-tour-soft text-tour mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full"><Columns3 size={12} aria-hidden="true" /></span><span><span class="font-medium">Moved to Active lead</span><span class="text-muted block text-xs">Assistant · 2 days ago</span></span>
											</li>
											<li class="flex gap-3"><span class="bg-pending-soft text-pending mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full"><Pin size={12} aria-hidden="true" /></span><span><span class="font-medium">Pinned</span><span class="text-muted block text-xs">Realtor · 3 days ago</span></span></li>
											<li class="flex gap-3"><span class="bg-success-soft text-success mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full"><Plus size={12} aria-hidden="true" /></span><span><span class="font-medium">Created</span><span class="text-muted block text-xs">Assistant · last week</span></span></li>
										</ol>
									{/if}
								</div>
							{/each}
						</section>
					</div>
				</div>

				<!-- The sidebar holds the working material: the stage's checklist, then the references beneath it. -->
				{@render workingMaterial(opportunity.stage)}
			</div>
		</div>
	</div>
{/snippet}

{#snippet workingMaterial(stage: Stage)}
	<aside class="border-hairline bg-paper/30 min-w-0 border-t @min-[48rem]/opportunity:border-t-0 @min-[48rem]/opportunity:border-l">
		<section class="px-2 pt-6 pb-5 sm:px-5 @min-[48rem]/opportunity:px-3" aria-label="Checklist">
			<div class="px-2.5">
				<div class="flex items-baseline justify-between gap-3">
					<h3 class="font-display text-xl tracking-tight">{stageLabels[stage]} checklist</h3>
					<span class="text-muted shrink-0 text-xs font-medium tabular-nums"><span class="sr-only">Complete: </span>{done} of {items.length}</span>
				</div>
				<div class="mt-2.5 flex gap-1" aria-hidden="true">
					{#each items as item (item.id)}<span class={["h-1 flex-1 rounded-full transition-colors duration-300", item.completedAt ? "bg-field" : "bg-ink/10"]}></span>{/each}
				</div>
			</div>
			<ul class="[&>li:has(.check:checked)]:bg-paper/70 mt-3 space-y-1.5">
				{#each items as item, index (item.id)}
					<ChecklistItem
						{item}
						checklist={sampleChecklist}
						{today}
						busy={false}
						first={index === 0}
						last={index === items.length - 1}
						save={saveItem}
						rename={async (title) => void (item.title = title)}
						remove={async () => void (items = items.filter((row) => row.id !== item.id))}
						move={(offset) => moveItem(index, offset)}
						dragstart={noop}
						dragover={noop}
						dropItem={noop}
						dragend={noop} />
				{/each}
			</ul>
			{#if adding}
				<div class="mt-0.5 flex items-center gap-2 py-1 pr-1 pl-2.5">
					<span class="border-muted/40 size-5 shrink-0 rounded-full border-[1.5px] border-dashed" aria-hidden="true"></span>
					<input
						class="field min-h-8 rounded-lg px-2 py-1"
						aria-label="New checklist item"
						placeholder="Describe the item, then press Enter"
						maxlength="200"
						{@attach (input) => input.focus()}
						onkeydown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								addItem(event.currentTarget);
							}
							if (event.key === "Escape") {
								event.preventDefault();
								event.stopPropagation();
								adding = false;
							}
						}}
						onblur={(event) => {
							if (!event.currentTarget.value.trim()) adding = false;
						}} />
				</div>
			{:else}
				<button type="button" class="text-action mt-0.5 flex min-h-9 w-full items-center gap-3 px-2.5" onclick={() => (adding = true)}>
					<span class="flex size-5 items-center justify-center"><Plus size={16} aria-hidden="true" /></span>Add item
				</button>
			{/if}
		</section>
		<section aria-label="References" class="border-hairline mx-4 border-t pt-5 pb-6 sm:mx-7 @min-[48rem]/opportunity:mx-5">
			<h3 class="mb-3 flex items-baseline justify-between gap-2"><span class="font-display text-xl tracking-tight">References</span><span class="text-muted text-xs font-medium tabular-nums">{sampleReferences.length}</span></h3>
			<ReferenceList workspace={sampleReferenceWorkspace} references={sampleReferences} openOpportunity={() => true} remove={simulated("reference removed")} />
			<button type="button" class="text-action mt-2" onclick={simulated("reference form not part of this demo")}><Plus size={16} aria-hidden="true" />Add reference</button>
		</section>
	</aside>
{/snippet}

{#snippet underlineTabs(label: string, counts: boolean, scope: string)}
	<div role="tablist" aria-label={label} class="tabs" data-slide style:--tab-count={panelTabs.length} style:--tab-index={panelTabs.findIndex((entry) => entry.id === activeTab(scope))}>
		{#each panelTabs as entry (entry.id)}
			<button
				type="button"
				role="tab"
				id={`${scope}-${entry.id}-tab`}
				aria-controls={`${scope}-${entry.id}-panel`}
				aria-selected={activeTab(scope) === entry.id}
				tabindex={activeTab(scope) === entry.id ? 0 : -1}
				class="tab -mb-px flex items-center gap-1.5 transition-colors"
				onclick={() => (tabs[scope] = entry.id)}
				onkeydown={(event) => {
					if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
					event.preventDefault();
					const index = panelTabs.findIndex((item) => item.id === activeTab(scope));
					const next = event.key === "Home" ? 0 : event.key === "End" ? panelTabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + panelTabs.length) % panelTabs.length;
					tabs[scope] = panelTabs[next]!.id;
					(event.currentTarget.parentElement?.querySelectorAll("button")[next] as HTMLButtonElement | undefined)?.focus();
				}}
				>{entry.label}{#if counts && entry.count}<span class="chip tabular-nums">{entry.count}</span>{/if}</button>
		{/each}
	</div>
{/snippet}

{#snippet inputExplorationsBody()}
	<InputExplorations />
{/snippet}

{#snippet overlayExplorationsBody()}
	<OverlayExplorations />
{/snippet}

{#snippet feedbackExplorationsBody()}
	<FeedbackExplorations />
{/snippet}

<!-- Sections -->

{#snippet paletteBody()}
	<div>
		{@render subheading("Themes", "Choose a production theme. It applies to the entire app and is saved in your browser; only its font pairing loads.")}
		<div class="segmented" role="group" aria-label="Theme">
			{#each themes as theme (theme.id)}<label><input type="radio" name={`${pageId}-theme`} checked={activeTheme === theme.id} onchange={() => chooseTheme(theme.id)} />{theme.label}</label>{/each}
		</div>
	</div>
	<div>
		{@render subheading("Surfaces and ink", "The rail sits on paper grading into canvas; content surfaces are white, whatever white means in the palette.")}
		<div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,8.5rem),1fr))] gap-3">
			{#each surfaces as entry (entry.token)}{@render swatch(entry.label, entry.use, `var(--color-${entry.token})`)}{/each}
		</div>
	</div>
	<div>
		{@render subheading("Action", "One accent marks links, focus, checks and progress. Primary buttons take their own palette color.")}
		<div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,8.5rem),1fr))] gap-3">
			{#each actions as entry (entry.token)}{@render swatch(entry.label, entry.use, entry.value)}{/each}
		</div>
	</div>
	<div>
		{@render subheading("Status tones", "A soft surface with a strong ink of the same hue. Stages and due states use these.")}
		<div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-3">
			{#each tones as tone (tone.id)}
				<div class="border-hairline overflow-hidden rounded-2xl border bg-white">
					<div class={[tone.soft, tone.text, "flex h-20 items-end justify-between p-3"]}>
						<span class="font-display text-3xl leading-none tracking-tight">Aa</span>
						<span class={[tone.fill, "size-3 rounded-full"]}></span>
					</div>
					<div class="p-3 text-xs">
						<span class="block font-medium">{tone.id}</span>
						<span class="text-muted block">{tone.use}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>
	<div>
		{@render subheading("Categories", "Each opportunity type owns a family: a wash, an edge and an ink.")}
		<div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-3">
			{#each types as type (type)}
				{@const style = typeStyles[type]}
				<div class="rounded-2xl border border-(--edge)/45 bg-linear-160 from-(--wash) via-(--wash)/70 to-white/80 p-3 text-(--ink)" style:--wash={`var(--color-category-${style.tone})`} style:--ink={`var(--color-category-${style.tone}-ink)`} style:--edge={`var(--color-category-${style.tone}-edge)`}>
					<div class="flex items-center justify-between">
						<style.icon size={18} strokeWidth={2} aria-hidden="true" />
						<span class="flex gap-1" aria-hidden="true"><span class="size-3 rounded-full border border-(--edge) bg-(--wash)"></span><span class="size-3 rounded-full bg-(--edge)"></span><span class="size-3 rounded-full bg-(--ink)"></span></span>
					</div>
					<p class="mt-6 text-sm font-semibold">{typeLabels[type]}</p>
					<p class="text-xs text-(--ink)/75">category-{style.tone}</p>
				</div>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet typeBody()}
	<div class="grid gap-3 @min-[40rem]/guide:grid-cols-2">
		{#each [{ name: fontPair.display, family: "font-display", role: "View titles, headings, opportunity titles and figures", weights: fontPair.display === "Instrument Serif" ? "400 · italic" : "400 · 500" }, { name: fontPair.body, family: "font-sans", role: "Controls, records, body and supporting text", weights: "400 · 500 · 600" }] as face (face.family)}
			<div data-sg-panel class="border-hairline flex items-end justify-between gap-4 rounded-3xl border bg-white p-5">
				<div class="min-w-0">
					<p class="text-sm font-semibold">{face.name}</p>
					<p class="text-muted mt-0.5 text-xs/5 text-pretty">{face.role}</p>
					<p class="text-muted mt-3 text-xs tabular-nums">{face.weights}</p>
				</div>
				<span class={[face.family, "text-field shrink-0 text-7xl leading-none tracking-tight"]} aria-hidden="true">Aa</span>
			</div>
		{/each}
	</div>
	<dl data-sg-panel class="divide-hairline border-hairline divide-y rounded-3xl border bg-white px-5">
		{#each [{ label: "View title", spec: `${fontPair.display} 30`, class: "font-display text-3xl tracking-tight", text: "Pipeline" }, { label: "Section", spec: `${fontPair.display} 20`, class: "font-display text-xl tracking-tight", text: "Active lead checklist" }, { label: "Figure", spec: `${fontPair.display} 36`, class: "font-display text-4xl leading-8 tracking-tight tabular-nums", text: "12" }, { label: "Item title", spec: `${fontPair.body} 14 · 500`, class: "item-title", text: "Maple first home" }, { label: "Body", spec: `${fontPair.body} 14`, class: "text-sm", text: "Prefers texts after 5 PM." }, { label: "Supporting", spec: `${fontPair.body} 12`, class: "text-muted text-xs", text: "Assistant · 2 days ago" }, { label: "Label", spec: `${fontPair.body} 12 · 500`, class: "text-muted text-xs font-medium", text: "Property address" }, { label: "Name", spec: `${fontPair.body} 14`, class: "text-sm", text: "Ada Maple" }] as row (row.label)}
			<div class="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-4 py-4 @min-[36rem]/guide:grid-cols-[8rem_minmax(0,1fr)_auto]">
				<dt class="text-xs font-medium">{row.label}</dt>
				<dd class={[row.class, "min-w-0 truncate"]}>{row.text}</dd>
				<dd class="text-muted hidden text-xs tabular-nums @min-[36rem]/guide:block">{row.spec}</dd>
			</div>
		{/each}
	</dl>
{/snippet}

{#snippet surfacesBody()}
	<div class="grid min-w-0 gap-6 @min-[46rem]/guide:grid-cols-3">
		{#each [{ name: "Standard", framed: false, floating: false }, { name: "Framed", framed: true, floating: false }, { name: "Floating", framed: false, floating: true }] as surface (surface.name)}
			<section class="min-w-0 space-y-4">
				<h3 class="text-sm font-semibold">{surface.name}</h3>
				<div class={["surface space-y-4 p-(--inset)", surface.floating && "surface-floating"]} data-surface={surface.framed ? "framed" : undefined}>
					<h4 class="font-display text-lg">Maple first home</h4>
					<p class="text-muted text-xs">Local specimen · no saved records</p>
					<label class="field-group"><span class="field-addon">$</span><input class="field-bare" aria-label={`${surface.name} budget`} inputmode="decimal" placeholder="450,000" /><span class="field-addon">USD</span></label>
					<div class="flex flex-wrap gap-2"><button type="button" class="control">Cancel</button><button type="button" class="control" data-variant="primary">Save</button></div>
				</div>
			</section>
		{/each}
	</div>
	<div>
		{@render subheading("Stage frames", "The same framed surface, tinted with each stage’s soft color.")}
		<div class="grid min-w-0 gap-6 @min-[36rem]/guide:grid-cols-4">
			{#each stages as stage (stage)}
				<div class="surface min-w-0 p-(--inset)" data-surface="framed" style:--surface-frame={`var(--color-${stageTones[stage]}-soft)`}><p class="text-sm font-medium">{stageLabels[stage]}</p></div>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet buttonsBody()}
	<div>
		{@render subheading("States", "Use the pointer and keyboard to inspect real hover, pressed and focus states. Disabled and busy states are explicit specimens.")}
		<div data-sg-panel class="border-hairline overflow-x-auto rounded-3xl border bg-white">
			<table class="w-full min-w-[44rem] text-left text-sm whitespace-nowrap">
				<thead>
					<tr class="text-muted border-hairline border-b text-xs">
						<th scope="col" class="px-5 py-3 font-medium">Kind</th>
						{#each states as state (state)}<th scope="col" class="px-3 py-3 font-medium capitalize">{state}</th>{/each}
					</tr>
				</thead>
				<tbody class="divide-hairline divide-y">
					{#each buttonKinds as kind (kind.id)}
						<tr>
							<th scope="row" class="px-5 py-4 text-xs font-medium whitespace-nowrap">{kind.label}</th>
							{#each states as state (state)}<td class="px-3 py-4">{@render sampleButton(kind.id, state)}</td>{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
	<div class="grid gap-6 @min-[48rem]/guide:grid-cols-3">
		<div data-sg-panel class="border-hairline rounded-3xl border bg-white p-5">
			{@render subheading("Reveal on hover", "Pipeline header actions show their label on hover or focus.")}
			<div class="flex flex-wrap gap-2">
				<button type="button" class="control" data-size="sm" data-reveal aria-label="View archived opportunities"><Archive size={15} aria-hidden="true" /><span class="control-label" aria-hidden="true"><span><span>Archived</span></span></span></button>
				<button type="button" class="control" data-size="sm" data-reveal data-variant="primary" aria-label="New opportunity"><Plus size={16} aria-hidden="true" /><span class="control-label" aria-hidden="true"><span><span>New opportunity</span></span></span></button>
			</div>
		</div>
		<div data-sg-panel class="border-hairline rounded-3xl border bg-white p-5">
			{@render subheading("Menu", "A live trigger beside its open state.")}
			<div class="flex items-start gap-3">
				<Menu label="Sample actions">
					<button type="button" role="menuitem" class="menu-item"><Pin size={15} aria-hidden="true" />Pin</button>
					<button type="button" role="menuitem" class="menu-item"><Archive size={15} aria-hidden="true" />Archive</button>
					<button type="button" role="menuitem" class="menu-item" data-tone="danger"><Trash2 size={15} aria-hidden="true" />Delete</button>
				</Menu>
				<div class="surface surface-floating menu static min-w-40 transform-none! opacity-100!" aria-hidden="true">
					<span class="menu-item" data-sg-state="hover"><Pin size={15} />Pin</span>
					<span class="menu-item"><Archive size={15} />Archive</span>
					<span class="menu-item" data-tone="danger"><Trash2 size={15} />Delete</span>
				</div>
			</div>
		</div>
		<div data-sg-panel class="border-hairline rounded-3xl border bg-white p-5">
			{@render subheading("Sliding underline tabs", "Arrow keys, Home and End move between linked panels. The underline slides without shifting layout; reduced motion removes its travel.")}
			{@render underlineTabs("Sample tabs", true, `${pageId}-sample`)}
			{#each panelTabs as entry (entry.id)}
				<div id={`${pageId}-sample-${entry.id}-panel`} role="tabpanel" aria-labelledby={`${pageId}-sample-${entry.id}-tab`} hidden={activeTab(`${pageId}-sample`) !== entry.id} tabindex="0" class="text-muted pt-3 text-xs">{entry.id === "notes" ? "Notes content" : "History content"}</div>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet fieldsBody()}
	<div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
		<div data-sg-panel class="border-hairline space-y-4 rounded-3xl border bg-white p-5">
			{@render subheading("Text field", "Every state, forced where the pointer would be needed.")}
			<label class="block space-y-1.5">{@render fieldLabel("Rest")}<input class="field" placeholder="Property address" /></label>
			<label class="block space-y-1.5">{@render fieldLabel("Hover")}<input class="field" data-sg-state="hover" placeholder="Property address" /></label>
			<label class="block space-y-1.5">{@render fieldLabel("Focus")}<input class="field" data-sg-state="focus" value="14 Orchard Row" /></label>
			<label class="block space-y-1.5"
				>{@render fieldLabel("Invalid")}<input class="field" aria-invalid="true" aria-describedby="sg-invalid-hint" value="ada.maple@" /><span id="sg-invalid-hint" class="text-urgent flex items-center gap-1.5 text-xs"><CircleAlert size={13} aria-hidden="true" />Enter a full email address.</span></label>
			<label class="block space-y-1.5">{@render fieldLabel("Disabled")}<input class="field" disabled value="Saving…" /></label>
		</div>
		<div data-sg-panel class="border-hairline space-y-4 rounded-3xl border bg-white p-5">
			{@render subheading("Field groups", "One boundary and one focus ring around a label, an addon or an icon.")}
			<label class="field-group field-inset"><span>Property address</span><input class="field-bare" value="14 Orchard Row, Meadow Lane" /></label>
			<label class="field-group field-inset"><span>Birthday</span><input class="field-bare" type="date" value="1988-04-12" /></label>
			<label class="field-group"><span class="field-addon"><DollarSign size={15} aria-hidden="true" /></span><input class="field-bare tabular-nums" inputmode="numeric" aria-label="Budget" value="485,000" /><span class="field-addon">USD</span></label>
			<label class="field-group"><span class="field-addon"><Search size={15} aria-hidden="true" /></span><input class="field-bare" type="search" aria-label="Search clients" placeholder="Search clients" /></label>
		</div>
		<div data-sg-panel class="border-hairline space-y-4 rounded-3xl border bg-white p-5">
			{@render subheading("Select, date and text area", "Native selects use the shared indicator and the browser’s picker.")}
			<div class="space-y-1.5">{@render fieldLabel("Stage")}<Select label="Stage" bind:value={sampleStage} dot={`var(--color-${stageTones[sampleStage]})`} options={optionsFrom(stageLabels)} /></div>
			<div class="space-y-1.5">{@render fieldLabel("Lead source")}<Select label="Lead source" bind:value={form.source} options={leadSources.map((source) => ({ value: source, label: source }))} /></div>
			<label class="block space-y-1.5">{@render fieldLabel("Date")}<input class="field" type="date" value={today} /></label>
			<label class="block space-y-1.5">{@render fieldLabel("Text area")}<textarea class="field field-sizing-content min-h-24">Flexible on closing date.</textarea></label>
		</div>
		<div data-sg-panel class="border-hairline space-y-4 rounded-3xl border bg-white p-5">
			{@render subheading("Pill selects", "Compact filters; they show the accent when set to anything other than their default.")}
			<div class="flex flex-wrap gap-2">
				<Select appearance="pill" label="Type filter" bind:value={typeFilter} active={typeFilter !== "all"} options={[{ value: "all", label: "All types" }, ...optionsFrom(typeLabels)]} />
				<Select appearance="pill" label="Timeline filter" value="1-3-mo" active options={optionsFrom(timelineLabels)} />
				<Select appearance="pill" label="Stage" bind:value={sampleStage} dot={`var(--color-${stageTones[sampleStage]})`} options={optionsFrom(stageLabels)} />
				<Select appearance="pill" label="Disabled filter" value="off" disabled options={[{ value: "off", label: "Disabled" }]} />
			</div>
		</div>
	</div>
{/snippet}

{#snippet selectionBody()}
	<div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
		<div data-sg-panel class="border-hairline rounded-3xl border bg-white p-5">
			{@render subheading("Checks", "Round, with the check drawn in the accent.")}
			<div class="grid grid-cols-2 gap-3 text-sm">
				<label class="flex min-h-9 items-center gap-2.5"><input type="checkbox" class="check" />Unchecked</label>
				<label class="flex min-h-9 items-center gap-2.5"><input type="checkbox" class="check" data-sg-state="hover" />Hover</label>
				<label class="flex min-h-9 items-center gap-2.5"><input type="checkbox" class="check" checked />Checked</label>
				<label class="flex min-h-9 items-center gap-2.5"><input type="checkbox" class="check" data-sg-state="focus" checked />Focus</label>
				<label class="text-muted flex min-h-9 items-center gap-2.5"><input type="checkbox" class="check" disabled />Disabled</label>
				<label class="text-muted flex min-h-9 items-center gap-2.5"><input type="checkbox" class="check" disabled checked />Disabled</label>
			</div>
		</div>
		<div data-sg-panel class="border-hairline rounded-3xl border bg-white p-5">
			{@render subheading("Check list", "Choosing clients in the opportunity editor. Adjacent chosen rows join into one block.")}
			<div class="border-hairline grid rounded-xl border bg-white p-1">
				{#each ["Ada Maple", "Eli Maple", "Mira Willow"] as name, index (name)}<label class="has-checked:bg-selected flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-sm transition-[background-color,border-radius] has-checked:has-[+label_:checked]:rounded-b-none has-checked:[label:has(:checked)+&]:rounded-t-none"
						><input type="checkbox" class="check" checked={index < 2} />{name}</label
					>{/each}
			</div>
		</div>
		<div data-sg-panel class="border-hairline rounded-3xl border bg-white p-5">
			{@render subheading("Checklist progress", "Segments fill in the accent as items are checked off.")}
			<div class="flex items-baseline justify-between gap-3 text-sm">
				<span class="font-medium">Active lead checklist</span><span class="text-muted text-xs tabular-nums">{done} of {items.length}</span>
			</div>
			<div class="mt-2.5 flex gap-1" aria-hidden="true">
				{#each items as item (item.id)}<span class={["h-1 flex-1 rounded-full transition-colors duration-300", item.completedAt ? "bg-field" : "bg-ink/10"]}></span>{/each}
			</div>
		</div>
	</div>
{/snippet}

{#snippet chipsBody()}
	<dl data-sg-panel class="divide-hairline border-hairline divide-y rounded-3xl border bg-white px-5">
		{#each [{ label: "Stage", note: "A numeral in the stage tone; hover reveals the name over its neighbours" }, { label: "Type", note: "Category family with its icon" }, { label: "Due", note: "The type primitive, with a calendar glyph per state" }, { label: "Tag", note: "Tag dot on paper" }, { label: "Client", note: "A client icon and name, not a person’s avatar" }, { label: "Indicators", note: "Counts, timeline, pin and progress" }] as row (row.label)}
			<div class="grid items-center gap-x-6 gap-y-2 py-4 @min-[36rem]/guide:grid-cols-[10rem_minmax(0,1fr)]">
				<dt>
					<span class="block text-xs font-medium">{row.label}</span>
					<span class="text-muted block text-xs">{row.note}</span>
				</dt>
				<dd class="flex flex-wrap items-center gap-1.5">
					{#if row.label === "Stage"}
						{#each stages as stage (stage)}<StageMark {stage} />{/each}<span class="bg-hairline mx-2 h-5 w-px" aria-hidden="true"></span>{#each stages as stage (stage)}<StageMark {stage} expanded />{/each}
					{:else if row.label === "Type"}
						{#each types as type (type)}{@render typeChip(type)}{/each}
					{:else if row.label === "Due"}
						<DueBadge label={dueLabel("2026-01-01", today)} state="overdue" /><DueBadge label="Today" state="today" /><DueBadge label="Tomorrow" state="upcoming" /><DueBadge label="No date" state="undated" />
					{:else if row.label === "Tag"}
						{#each tags as tag (tag.name)}{@render tagChip(tag)}{/each}
					{:else if row.label === "Client"}
						{#each ["Ada Maple", "Mira Willow"] as client (client)}{@render clientChip(client, "#chips")}{/each}
					{:else}
						<span class="flex flex-wrap items-center gap-3">
							<span class="chip tabular-nums">3</span>
							<span data-chip data-pill class="bg-category-sky text-category-sky-ink inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs leading-5 font-medium tabular-nums"><Clock3 size={12} strokeWidth={2.25} aria-hidden="true" />1–3 mo</span>
							<span data-chip class="bg-category-sky text-category-sky-ink flex size-6 items-center justify-center rounded-full"><Pin size={12} strokeWidth={2.25} class="rotate-45 fill-current" aria-hidden="true" /><span class="sr-only">Pinned</span></span>
							<span class="flex gap-0.75" role="img" aria-label="3 of 5 checklist items done"
								>{#each { length: 5 }, index (index)}<span class={["size-1.5 rounded-full", index < 3 ? "bg-ink" : "bg-ink/20"]}></span>{/each}</span>
						</span>
					{/if}
				</dd>
			</div>
		{/each}
	</dl>
{/snippet}

{#snippet cardsBody()}
	<div class="dashboard-content space-y-6">
		<div>
			{@render subheading("Scorecards", "The Pipeline summary, one per stage.")}
			<div class="surface grid grid-cols-2 gap-3 p-(--inset) @min-[48rem]/guide:grid-cols-4" data-surface="framed">
				{#each stages as stage, index (stage)}<Scorecard label={stageLabels[stage]} value={[4, 7, 2, 11][index]!} detail={["This week", "2 pinned", "Closing soon", "This year"][index]!} color={stageTones[stage]} href="#cards" />{/each}
			</div>
		</div>
		<div class="grid gap-5 @min-[56rem]/guide:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
			<div>
				{@render subheading("Widget and task rows", "Rows expand for notes.")}
				<DashboardCard title="Today’s Tasks" headingId="sg-tasks-heading" description="Rows expand for notes" descriptionInline action={{ href: "#cards", label: "All tasks" }}>
					<TaskList items={sampleTasks} />
				</DashboardCard>
			</div>
			<div>
				{@render subheading("Opportunity cards", "Open one to see the dialog.")}
				<div class="@container/cards grid content-start gap-2.5 @min-[30rem]/cards:grid-cols-2">
					{#each cards as card (card.opportunity.id)}
						<OpportunityCard opportunity={card.opportunity} clients={card.clients} progress={card.progress} ready busy={false} open={() => open(card)} move={(stage) => (card.opportunity.stage = stage)} archive={simulated("archived")} pin={() => togglePin(card)} remove={simulated("deleted")} dragstart={noop} dragend={noop} />
					{/each}
				</div>
			</div>
		</div>
	</div>
{/snippet}

{#snippet opportunityBody()}
	<div>
		<div class="mb-4 flex flex-wrap items-center gap-2">
			<p class="text-muted max-w-2xl text-xs/5">Compare Original, Record first, and Work first in the variant toolbar. Each uses the same opportunity and checklist; changes are local to this demo.</p>
			<button type="button" class="control sm:ml-auto" data-size="sm" data-variant="primary" onclick={() => (dialogOpen = true)}>Open as dialog</button>
		</div>
		{#if !dialogOpen}
			<div class="bg-canvas text-ink shadow-panel border-hairline/60 overflow-clip rounded-3xl border">{@render opportunityPanel(false)}</div>
		{:else}
			<p class="text-muted border-hairline rounded-xl border border-dashed px-3 py-3 text-xs">The dialog is open.</p>
		{/if}
	</div>
{/snippet}

{#snippet formBody()}
	<form onsubmit={submitForm} aria-label="Sample client form" data-sg-panel class="border-hairline @container/form max-w-3xl space-y-6 rounded-3xl border bg-white p-5 sm:p-7" novalidate>
		<p class="text-muted text-xs">Fields are illustrative, not the Registry’s client form.</p>
		<div class="grid gap-4 @min-[32rem]/form:grid-cols-2">
			<label class="block space-y-1.5">{@render fieldLabel("Name")}<input class="field" bind:value={form.name} required /></label>
			<label class="block space-y-1.5">{@render fieldLabel("Birthday (optional)")}<input class="field" type="date" bind:value={form.birthday} /></label>
			<div class="space-y-1.5">
				<span class="text-muted block text-xs font-medium" id="sg-phone-label">Phone</span>
				<div class="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
					<Select label="Phone label" bind:value={form.phoneLabel} options={["Mobile", "Home", "Work"].map((label) => ({ value: label, label }))} />
					<input class="field tabular-nums" type="tel" aria-labelledby="sg-phone-label" bind:value={form.phone} />
				</div>
			</div>
			<label class="block space-y-1.5">
				{@render fieldLabel("Email")}
				<input class="field" type="email" bind:value={form.email} aria-invalid={emailInvalid || undefined} aria-describedby={emailInvalid ? "sg-email-error" : undefined} oninput={() => (emailInvalid = false)} />
				{#if emailInvalid}<span id="sg-email-error" class="text-urgent flex items-center gap-1.5 text-xs"><CircleAlert size={13} aria-hidden="true" />Enter a full email address, such as ada@example.com.</span>{/if}
			</label>
			<div class="space-y-1.5">{@render fieldLabel("Lead source")}<Select label="Lead source" bind:value={form.source} options={leadSources.map((source) => ({ value: source, label: source }))} /></div>
			<label class="block space-y-1.5">{@render fieldLabel("Referred by")}<input class="field" bind:value={form.referredBy} placeholder="A client or a name" /></label>
		</div>
		<div class="grid gap-6 @min-[32rem]/form:grid-cols-2">
			<fieldset>
				<legend class="text-muted mb-2 text-xs font-medium">Tags</legend>
				<div class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
					{#each tags as tag (tag.name)}<label class="flex min-h-9 items-center gap-2.5"><input type="checkbox" class="check" value={tag.name} bind:group={form.tags} />{tag.name}</label>{/each}
				</div>
			</fieldset>
			<fieldset>
				<legend class="text-muted mb-2 text-xs font-medium">Consent</legend>
				<div class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
					{#each ["call", "text", "email", "mail"] as channel (channel)}<label class="flex min-h-9 items-center gap-2.5 capitalize"><input type="checkbox" class="check" value={channel} bind:group={form.consent} />{channel}</label>{/each}
				</div>
				{#if !form.consent.length}<p class="bg-urgent-soft text-urgent mt-2 rounded-lg px-2.5 py-1.5 text-xs">Not to be contacted.</p>{/if}
			</fieldset>
		</div>
		<label class="block space-y-1.5">{@render fieldLabel("Preferences")}<textarea class="field field-sizing-content min-h-24" bind:value={form.preferences}></textarea></label>
		<div class="border-hairline flex flex-wrap justify-end gap-2 border-t pt-4">
			<button type="button" class="control" onclick={simulated("cancelled")}>Cancel</button>
			<button class="control" data-variant="primary">Save client</button>
		</div>
	</form>
{/snippet}

{#snippet feedbackBody()}
	<div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-4">
		<div role="alert" class="bg-urgent-soft text-urgent flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl py-1.5 pr-1.5 pl-4 text-sm [--action-color:var(--color-urgent)]">
			<span class="min-w-0 flex-1 basis-60 py-1">Stage could not be saved or has changed.</span>
			<button type="button" class="control -ml-3" data-variant="ghost" data-size="sm" onclick={simulated("refreshed")}><RefreshCw size={15} aria-hidden="true" />Refresh records</button>
		</div>
		<div class="bg-pending-soft text-pending flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl py-1.5 pr-1.5 pl-4 text-sm [--action-color:var(--color-pending)]">
			<span class="min-w-0 flex-1 basis-60 py-1">An unsaved editing draft is retained.</span>
			<span class="-ml-3 flex shrink-0 flex-wrap items-center gap-1">
				<button type="button" class="control" data-variant="ghost" data-size="sm" onclick={simulated("editing resumed")}><PencilLine size={15} aria-hidden="true" />Resume editing</button>
				<button type="button" class="control" data-variant="ghost" data-size="sm" onclick={simulated("draft discarded")}><Undo2 size={15} aria-hidden="true" />Discard editing draft</button>
			</span>
		</div>
		<div class="bg-tour-soft text-tour flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl py-1.5 pr-1.5 pl-4 text-sm [--action-color:var(--color-tour)]">
			<span class="min-w-0 flex-1 basis-60 py-1">Viewing earlier New lead work. The opportunity is still in Active lead.</span>
			<button type="button" class="control -ml-3" data-variant="ghost" data-size="sm" onclick={simulated("returned to the current checklist")}><ArrowLeft size={15} aria-hidden="true" />Return to current checklist</button>
		</div>
		<p class="text-muted border-hairline flex items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-xs"><Link2 size={13} aria-hidden="true" />No references yet. Add links to listings, documents, or related records.</p>
		<div class="text-muted flex items-center gap-3 rounded-xl px-1 text-sm"><Inbox size={18} aria-hidden="true" />Nothing needs you right now.</div>
		<div class="flex items-center justify-between gap-3">
			<p class="toast">Simulated: opportunity saved.</p>
			<button type="button" class="control" data-size="sm" onclick={() => announce("Simulated: opportunity saved.")}>Play toast</button>
		</div>
	</div>
{/snippet}

<div class="surface-content @container/guide pb-24 [--gutter:--spacing(5)] sm:[--gutter:--spacing(8)] lg:[--gutter:--spacing(10)]" data-tight {@attach spy} {@attach contentFade}>
	<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-8">
		<div class="max-w-2xl space-y-2">
			<p class="text-muted text-sm/6 text-pretty">The app’s shared classes and components, shown with fictional records. The variant toolbar restyles the whole workspace while this view is open. Records are never saved; local file selection and clipboard actions are identified where they occur.</p>
			<p class="text-muted text-xs/5">Themes come from the account menu or Foundations. The development-only Material setting compares Glass and Tactile across every view. All specimens use production primitives.</p>
		</div>
		<div class="flex gap-2">
			<button type="button" class="control" data-size="sm" onclick={() => guide.setAll(true)}><ChevronsUpDown size={15} aria-hidden="true" />Expand all</button>
			<button type="button" class="control" data-size="sm" onclick={() => guide.setAll(false)}><ChevronsDownUp size={15} aria-hidden="true" />Collapse all</button>
		</div>
	</div>

	{#each guideSections as section (section.id)}
		<section id={section.id} data-guide-section aria-labelledby={`${section.id}-heading`}>
			<details class="sg-section group/section" open={guide.isOpen(section.id)} ontoggle={(event) => guide.setOpen(section.id, event.currentTarget.open)}>
				<summary class="group/summary border-hairline sticky top-0 z-30 -mx-(--gutter) block cursor-pointer list-none border-y bg-white px-(--gutter) focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden">
					<!-- The title's 32px line and the note's 24px line together match the 56px icon tile. -->
					<div class="flex items-center gap-5 py-7">
						<span class="bg-field/10 text-field grid size-14 shrink-0 place-items-center rounded-2xl"><section.icon size={24} strokeWidth={1.7} aria-hidden="true" /></span>
						<div class="min-w-0 flex-1">
							<h2 id={`${section.id}-heading`} class="font-display truncate text-[1.625rem]/8 tracking-tight sm:text-3xl/8">{section.label}</h2>
							<p class="text-muted truncate text-sm/6">{section.note}</p>
						</div>
						<span class="border-hairline text-muted group-hover/summary:bg-paper group-hover/summary:text-ink grid size-9 shrink-0 place-items-center rounded-full border bg-white transition-colors" aria-hidden="true">
							<ChevronDown size={17} class="transition-transform duration-300 ease-(--ease-shell) group-open/section:rotate-180 motion-reduce:transition-none" />
						</span>
					</div>
				</summary>
				<div class="space-y-12 pt-6 pb-16">{@render bodies[section.id]()}</div>
			</details>
		</section>
	{/each}
</div>

{#if dialogOpen}
	<dialog {@attach showDialog} aria-labelledby="sg-opportunity-heading" class="dialog" data-size="lg" oncancel={() => (dialogOpen = false)} onclose={() => (dialogOpen = false)}>
		{@render opportunityPanel(true)}
		{@render toastMessage()}
	</dialog>
{:else}
	{@render toastMessage()}
{/if}

{#snippet toastMessage()}
	{#if toast}
		{#key toast.id}
			<p role="status" class="toast pointer-events-none fixed bottom-6 left-1/2 z-[1000] -translate-x-1/2 animate-[toast_3.2s_var(--ease-shell)_forwards] whitespace-nowrap motion-reduce:animate-[toast-fade_3.2s_linear_forwards]">{toast.text}</p>
		{/key}
	{/if}
{/snippet}
