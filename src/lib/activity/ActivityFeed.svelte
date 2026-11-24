<script lang="ts">
	import { tick, type Component } from "svelte";
	import { SvelteSet } from "svelte/reactivity";
	import { Bot, ChartLine, ChevronDown, ChevronUp, CircleDot, House, Mail, Megaphone, MessageSquare, MessageSquareOff, Pencil, PencilLine, Phone, StickyNote, Trash2, UserPlus, Users } from "@lucide/svelte";
	import { typeStyles } from "#lib/pipeline/labels.js";
	import { userFirstName, userName } from "#lib/data/users.js";
	import { actorName, channelNoun, describeContact, describeNote, emphasize, outcomeLabels, type Line } from "./describe.js";
	import { activityDates, buildFeed, type FeedRow, type QuietIcon } from "./feed.js";
	import type { ActivityEntry, ActivityOpportunity, Actor, Channel, ContactEntry, Detail, NoteEntry } from "./types.js";

	let {
		entries,
		client,
		opportunities = [],
		timeZone,
		meadowSince,
		readonly = false,
		appearance = "timeline",
		recent,
		opportunityHref,
		onedit,
		ondelete,
	}: {
		/** Timeline runs every entry down one spine. Chat keeps only notes and logged contact, with the client's words on the left and the business's on the right. */
		appearance?: "timeline" | "chat";
		/** Open on this many of the newest rows; the earlier ones wait behind one control. */
		recent?: number;
		/** Notes, logged contact, History, and imported events for one record, in any order. */
		entries: ActivityEntry[];
		/** The name the client goes by in sentences: "Mira texted". */
		client: string;
		/** The client's opportunities, so rolled-up entries can carry their title. An opportunity's own Activity passes none. */
		opportunities?: ActivityOpportunity[];
		timeZone: string;
		meadowSince?: string;
		/** Where an opportunity's label links, such as its Pipeline card; without it the label is plain text. */
		opportunityHref?: (id: string) => string | undefined;
		/** Nothing can be edited or deleted. */
		readonly?: boolean;
		/** Saves a note's new text; false when it failed, which reopens the editor on the same text. */
		onedit?: (id: string, text: string) => Promise<boolean> | void;
		ondelete?: (id: string) => void;
	} = $props();

	const channelIcons: Record<Channel, Component> = { call: Phone, text: MessageSquare, email: Mail, meeting: Users, other: Megaphone, zillow: House };
	const quietIcons: Record<QuietIcon, Component> = { history: PencilLine, automation: Bot, report: ChartLine, status: CircleDot, added: UserPlus, call: Phone, text: MessageSquare };
	const markerClass = "marker relative flex h-lh items-center justify-center text-muted leading-[1.4]";
	const discClass = "grid size-6 place-items-center rounded-full border border-hairline bg-white text-ink in-data-[voice=client]:border-transparent in-data-[voice=client]:bg-(--client-voice)";
	const rowClass = "relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2.5";
	const onHover = "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:not-group-focus-within:invisible";
	const avatarClass = "grid size-7 shrink-0 place-items-center rounded-full text-2xs font-semibold";

	let dates = $derived(activityDates(timeZone));
	let feed = $derived(buildFeed(entries, { client, timeZone, meadowSince }));
	/** Chat drops everything but notes and logged contact, and any era left with neither. */
	let rows = $derived.by(() => {
		if (appearance !== "chat") return feed.rows;
		const kept = feed.rows.filter((row) => row.type === "era" || row.type === "contact" || row.type === "note");
		return kept.filter((row, index) => row.type !== "era" || (index + 1 < kept.length && kept[index + 1]!.type !== "era"));
	});
	let earlier = $state(false);
	// Holding back only a couple of rows would cost a click and save nothing.
	let holdable = $derived(recent && rows.length - recent > 2 ? rows.length - recent : 0);
	let held = $derived(earlier ? 0 : holdable);
	let shown = $derived(held ? rows.slice(held) : rows);
	let heldCount = $derived(rows.slice(0, holdable).filter((row) => row.type !== "era").length);
	const expanded = new SvelteSet<string>();
	let editing = $state<{ id: string; text: string } | null>(null);
	let confirming = $state("");
	let flashed = $state("");
	let list: HTMLOListElement | undefined = $state();

	// --- Chat ---
	const rowAt = (row: FeedRow) => (row.type === "contact" || row.type === "note" ? row.entry.at : "");
	const speaker = (row: FeedRow) => (row.type === "contact" || row.type === "note" ? `${row.entry.actor.kind}:${row.entry.actor.kind === "user" ? row.entry.actor.userId : ""}` : "");
	const initials = (name: string) =>
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]!.toUpperCase())
			.join("");
	// Only opportunities the feed can name start a band, so an opportunity's own Activity, which passes none, has none.
	const about = (row: FeedRow) =>
		row.type === "contact" || row.type === "note"
			? (row.entry.opportunityIds ?? [])
					.filter((id) => opportunities.some((row) => row.id === id))
					.toSorted()
					.join(" ")
			: "";
	/** Gradient stops for a band: each opportunity's type color, faint, holding its own stretch of the width with a soft join between them. */
	const bandColors = (subjects: ActivityOpportunity[]) => {
		const colors = subjects.length ? subjects.map((row) => `color-mix(in oklab, var(--color-category-${typeStyles[row.type].tone}) 28%, transparent)`) : ["var(--color-paper)"];
		const share = 100 / colors.length;
		const feather = colors.length > 1 ? share * 0.2 : 0;
		return colors.map((color, index) => `${color} ${index * share + feather}%, ${color} ${(index + 1) * share - feather}%`).join(", ");
	};
	type ChatRow = { row: FeedRow; continues: boolean };
	/** Consecutive messages about the same opportunities form one band, drawn as a faint bubble behind them; the rest stand alone. Within a band, each row notes whether it continues the previous speaker's run within the hour. */
	let chat = $derived.by(() => {
		const segments: { id: string; key: string; rows: ChatRow[] }[] = [];
		let previous: FeedRow | undefined;
		for (const row of shown) {
			const key = about(row);
			let segment = segments.at(-1);
			if (!segment || !key || segment.key !== key) segments.push((segment = { id: row.id, key, rows: [] }));
			const continues = segment.rows.length > 0 && !!previous && !!speaker(row) && speaker(row) === speaker(previous) && Date.parse(rowAt(row)) - Date.parse(rowAt(previous)) < 60 * 60_000;
			segment.rows.push({ row, continues });
			previous = row;
		}
		return segments;
	});

	const toggle = (id: string) => (expanded.has(id) ? expanded.delete(id) : expanded.add(id));
	const clampable = (body: string) => body.length > 320 || body.split("\n").length > 5;
	// Only Meadow's own notes and logged contact can change; History and imported entries are a record of what happened.
	const editable = (entry: NoteEntry | ContactEntry) => !readonly && !entry.imported && !entry.pending;

	/** Scroll an entry into view and mark it briefly, such as the call behind Last contacted. */
	export async function reveal(id: string) {
		earlier = true;
		await tick();
		const row = list?.querySelector<HTMLElement>(`[data-entry="${CSS.escape(id)}"]`);
		if (!row) return;
		row.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
		flashed = id;
	}
	// The new text shows at once; a failed save brings the editor back with the draft.
	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!editing) return;
		const draft = { ...editing, text: editing.text.trim() };
		editing = null;
		if ((await onedit?.(draft.id, draft.text)) === false && !editing) editing = draft;
	}
</script>

<!-- `plain` keeps the actor at body weight, so only the emphasized values stand out. -->
{#snippet sentence(line: Line, quiet = false, plain = false)}
	{#if line.who}<span class={[!plain && "font-medium", !quiet && "text-ink"]}>{line.who}</span>{" "}{/if}{#each emphasize(line) as part}{#if part.em}<span class="text-ink font-medium">{part.text}</span>{:else}{part.text}{/if}{/each}{#if line.tail}<span class="text-muted">{" · "}{line.tail}</span>{/if}
{/snippet}

{#snippet stamp(at: string, label = dates.short(at), size = "text-muted text-xs")}
	<time class={["shrink-0 tabular-nums", size]} datetime={at} title={dates.full(at)}>{label}</time>
{/snippet}

{#snippet details(rows: Detail[])}
	<dl class="border-hairline mt-1.5 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 border-l pl-3 text-xs">
		{#each rows as row (row.label)}
			<dt class="text-muted">{row.label}</dt>
			<dd class="min-w-0 wrap-anywhere">{row.value}</dd>
		{/each}
	</dl>
{/snippet}

{#snippet opportunityLabels(ids: string[] | undefined, size = "")}
	{#each opportunities.filter((row) => ids?.includes(row.id)) as opportunity (opportunity.id)}
		{@const Icon = typeStyles[opportunity.type].icon}
		<span class={["chip max-w-full", size]} data-tone={typeStyles[opportunity.type].tone}><Icon size={11} aria-hidden="true" /><span class="truncate">{opportunity.title}</span></span>
	{/each}
{/snippet}

<!-- Everything that opens in place uses a chevron that points down and flips; nothing in Activity navigates away. -->
{#snippet chevron(size = 12)}
	<ChevronDown {size} class="ml-1 inline align-[-1px] transition-transform duration-200 in-aria-expanded:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
{/snippet}

{#snippet expander(id: string)}
	<button type="button" class="icon-action" aria-label="Details" title="Details" aria-expanded={expanded.has(id)} onclick={() => toggle(id)}>{@render chevron(13)}</button>
{/snippet}

{#snippet disclosure(id: string, line: Line)}
	<button type="button" class="text-action text-left text-xs [--action-color:var(--color-muted)]" aria-expanded={expanded.has(id)} onclick={() => toggle(id)}><span>{@render sentence(line, true)}{@render chevron()}</span></button>
{/snippet}

{#snippet rowActions(entry: NoteEntry | ContactEntry, text: string | undefined, noun: string)}
	{#if editable(entry) && editing?.id !== entry.id}
		<!-- Out of sight until the row is hovered or focused. Touch screens cannot hover, so a tap focuses the row and shows its actions; until then they cannot be tapped by accident. -->
		<span class={["text-muted flex shrink-0 items-center gap-3 self-center pointer-coarse:gap-8", onHover]}>
			<button type="button" class="icon-action" aria-label={text ? (entry.kind === "contact" ? `Edit note on this ${noun}` : "Edit note") : `Add a note to this ${noun}`} title={text ? "Edit note" : "Add note"} onclick={() => (editing = { id: entry.id, text: text ?? "" })}><Pencil size={13} aria-hidden="true" /></button>
			<button type="button" class="icon-action" aria-label={`Delete ${noun}`} title="Delete" onclick={() => (confirming = entry.id)}><Trash2 size={13} aria-hidden="true" /></button>
		</span>
	{/if}
{/snippet}

{#snippet editor(label: string)}
	{#if editing}
		<form class="mt-1.5 space-y-2" onsubmit={save}>
			<textarea
				class="field block field-sizing-content max-h-[40dvh] min-h-20 resize-none leading-[1.4]"
				aria-label={label}
				maxlength="20000"
				bind:value={editing.text}
				{@attach (node) => node.focus()}
				onkeydown={(event) => {
					if (!event.isComposing && event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.form?.requestSubmit();
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						editing = null;
					}
				}}></textarea>
			<div class="flex flex-wrap gap-2">
				<button class="control" data-variant="primary" data-size="sm" disabled={entries.find((entry) => entry.id === editing?.id)?.kind === "note" && !editing.text.trim()}>Save note</button>
				<button type="button" class="control" data-variant="ghost" data-size="sm" onclick={() => (editing = null)}>Cancel</button>
			</div>
		</form>
	{/if}
{/snippet}

{#snippet confirmDelete(id: string, what: string)}
	{#if confirming === id}
		<div class="bg-urgent-soft text-urgent mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-1.5 text-xs [--action-color:var(--color-urgent)]" role="alert">
			<p class="min-w-0 flex-1 basis-40">Delete this {what}? Activity will record that it was deleted.</p>
			<span class="flex gap-1">
				<button
					type="button"
					class="control"
					data-variant="danger"
					data-size="sm"
					onclick={() => {
						confirming = "";
						ondelete?.(id);
					}}>Delete</button>
				<button type="button" class="control" data-variant="ghost" data-size="sm" {@attach (node) => node.focus()} onclick={() => (confirming = "")}>Keep</button>
			</span>
		</div>
	{/if}
{/snippet}

{#snippet eraLabel(era: "boldtrail" | "meadow", label: string)}
	<span class={["flex items-center gap-3 text-xs font-medium", era === "meadow" ? "text-ink" : "text-muted"]}>
		<span class="bg-hairline h-px flex-1" aria-hidden="true"></span>
		<span class="flex items-center gap-1.5"
			>{#if era === "meadow"}<span class="bg-field size-1.5 rounded-full" aria-hidden="true"></span>{/if}{label}</span>
		<span class="bg-hairline h-px flex-1" aria-hidden="true"></span>
	</span>
{/snippet}

{#snippet avatar(actor: Actor)}
	{#if actor.kind === "user"}
		<span class={[avatarClass, "bg-success-soft text-success"]} title={userName(actor.userId)} aria-hidden="true">{initials(userName(actor.userId))}</span>
	{:else if actor.kind === "client"}
		<span class={[avatarClass, "text-ink bg-(--client-voice)"]} aria-hidden="true">{initials(client)}</span>
	{:else}
		<span class={[avatarClass, "bg-paper text-muted"]} title="BoldTrail" aria-hidden="true"><Bot size={14} /></span>
	{/if}
{/snippet}

{#snippet message({ row, continues }: ChatRow)}
	{#if row.type === "contact" || row.type === "note"}
		{@const entry = row.entry}
		{@const side = entry.actor.kind === "client" ? "client" : "business"}
		{@const busy = editing?.id === entry.id || confirming === entry.id}
		{@const Icon = entry.kind === "note" ? StickyNote : entry.stop ? MessageSquareOff : channelIcons[entry.channel]}
		{@const label = entry.kind === "note" ? "Note" : [channelNoun(entry), entry.stop ? "turned texting off" : entry.outcome && outcomeLabels[entry.outcome]].filter(Boolean).join(" · ")}
		{@const text = entry.kind === "note" ? entry.body : entry.note}
		{@const edited = entry.kind === "note" ? entry.editedAt : entry.noteEditedAt}
		{@const noun = entry.kind === "note" ? "note" : entry.channel === "other" ? "logged contact" : `logged ${channelNoun(entry).toLowerCase()}`}
		<li
			class={["group flex items-start gap-2.5 transition-opacity outline-none data-pending:opacity-60", side === "business" && "flex-row-reverse", continues ? "pt-2" : "pt-5"]}
			tabindex="-1"
			aria-busy={entry.pending || undefined}
			data-pending={entry.pending || undefined}
			data-voice={side}
			data-entry={row.id}
			data-flash={flashed === row.id || undefined}
			onanimationend={() => (flashed = "")}>
			{#if continues}<span class="w-7 shrink-0" aria-hidden="true"></span>{:else}{@render avatar(entry.actor)}{/if}
			<div class={["flex min-w-0 flex-col gap-1.5", side === "business" ? "items-end" : "items-start", busy ? "flex-1" : "max-w-[min(85%,34rem)]"]}>
				<p class={["text-muted flex min-h-5 flex-wrap items-center gap-x-1.5 gap-y-1 px-1 text-xs leading-none", side === "business" && "justify-end"]}>
					{#if !continues}<span class="text-ink font-medium">{entry.kind === "note" && entry.title ? entry.title : actorName(entry.actor, client)}</span>{/if}
					<span class="inline-flex items-center gap-1"><Icon size={12} aria-hidden="true" />{label}</span>
					<span aria-hidden="true">·</span>
					{@render stamp(entry.at)}
					{#if entry.kind === "contact" && entry.loggedBy}<span>· logged by {userFirstName(entry.loggedBy)}</span>{/if}
					{#if edited}<span title={dates.full(edited)}>· edited</span>{/if}
					{#if entry.kind === "contact" && entry.detail}{@render expander(row.id)}{/if}
					<!-- The business's rows end at the right edge, so their actions sit at the start and never push the line inward. -->
					<span class={["contents", side === "business" && "*:order-first"]}>{@render rowActions(entry, text, noun)}</span>
				</p>
				{#if editing?.id === entry.id}
					<div class="w-full">{@render editor(entry.kind === "note" ? "Note" : `Note on this ${noun}`)}</div>
				{:else if text}
					{@const open = expanded.has(row.id)}
					<div class={["bubble px-3.5 py-2.5", entry.kind === "note" ? "border-hairline bg-paper rounded-2xl rounded-se-sm border border-dashed" : side === "client" ? "rounded-2xl rounded-ss-sm bg-(--client-voice)" : "border-hairline rounded-2xl rounded-se-sm border bg-white"]}>
						<p class={["leading-[1.45] wrap-anywhere whitespace-pre-wrap", entry.kind === "note" && !open && "line-clamp-5"]}>{text}</p>
						{#if entry.kind === "note" && clampable(entry.body)}<button type="button" class="text-action mt-1.5 text-xs" aria-expanded={open} onclick={() => toggle(row.id)}>{open ? "Show less" : `Show all ${entry.body.split("\n").length} lines`}</button>{/if}
					</div>
				{/if}
				{#if entry.kind === "contact" && entry.detail && expanded.has(row.id)}<div class="w-full">{@render details(entry.detail)}</div>{/if}
				{#if confirming === entry.id}<div class="w-full">{@render confirmDelete(entry.id, noun)}</div>{/if}
			</div>
		</li>
	{/if}
{/snippet}

<!-- The same control hides the earlier entries again, so the newest stay in reach after a look back. -->
{#if holdable}
	<p class="mb-2 text-center">
		<button type="button" class="text-action text-xs" aria-expanded={earlier} onclick={() => (earlier = !earlier)}
			>{#if earlier}<ChevronDown size={12} aria-hidden="true" />Hide {heldCount} earlier {heldCount === 1 ? "entry" : "entries"}{:else}<ChevronUp size={12} aria-hidden="true" />Show {heldCount} earlier {heldCount === 1 ? "entry" : "entries"}{/if}</button>
	</p>
{/if}
{#if appearance === "chat"}
	<!-- Chat: the client on the left, the business on the right, and when it happened always in view beside who said it. -->
	<ol bind:this={list} class="activity-chat text-sm" aria-label="Notes and logged contact, oldest first">
		{#each chat as segment (segment.id)}
			{@const first = segment.rows[0]!.row}
			{#if first.type === "era"}
				<li class="pt-6 pb-2 first:pt-2" data-era={first.era}>{@render eraLabel(first.era, first.label)}</li>
			{:else if segment.key}
				{@const subjects = opportunities.filter((row) => segment.key.split(" ").includes(row.id))}
				<!-- A band's subject stays out of the way: its name surfaces on hover or focus, pinned to the top of the window while the band scrolls past. Touch screens, which cannot hover, always show it at the band's top, where it never covers a message. A band about several opportunities blends their colors from left to right. -->
				<li class="group/band -mx-1.5 mt-3 rounded-3xl px-1.5 pb-1.5 first:mt-0" style:--band={bandColors(subjects)} data-band>
					<p class="pointer-events-none sticky top-1 z-10 -mb-5 flex h-5 justify-center pointer-coarse:static">
						<span class="pointer-events-auto flex max-w-full gap-1 opacity-0 transition-opacity duration-150 group-focus-within/band:opacity-100 group-hover/band:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100">
							{#each subjects as opportunity (opportunity.id)}
								{@const Icon = typeStyles[opportunity.type].icon}
								{@const href = opportunityHref?.(opportunity.id)}
								<svelte:element this={href ? "a" : "span"} {href} class={["chip text-2xs h-5 max-w-full px-1.5 shadow-(--shadow-raised)", href && "hover:underline"]} data-tone={typeStyles[opportunity.type].tone}
									><Icon size={11} aria-hidden="true" /><span class="truncate"><span class="sr-only">About </span>{opportunity.title}</span></svelte:element>
							{/each}
						</span>
					</p>
					<ol aria-label={`About ${subjects.map((row) => row.title).join(" and ") || "an opportunity"}`}>
						{#each segment.rows as item (item.row.id)}{@render message(item)}{/each}
					</ol>
				</li>
			{:else}
				{#each segment.rows as item (item.row.id)}{@render message(item)}{/each}
			{/if}
		{/each}
	</ol>
{:else}
	<ol bind:this={list} class="activity-rail text-sm" aria-label="Activity, oldest first">
		{#each shown as row (row.id)}
			{#if row.type === "era"}
				<li class="era" data-era={row.era}>{@render eraLabel(row.era, row.label)}</li>
			{:else if row.type === "quiet"}
				{@const Icon = quietIcons[row.icon]}
				<li class={[rowClass, "py-1.5 text-xs"]} data-weight="quiet" data-entry={row.id}>
					<span class={markerClass}><Icon size={13} aria-hidden="true" /></span>
					<div class="min-w-0">
						<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
							<p class="text-muted min-w-0 flex-1 basis-48">
								{#if row.detail}{@render disclosure(row.id, row.line)}{:else}{@render sentence(row.line, true)}{/if}
							</p>
							{@render stamp(row.at)}
						</div>
						{#if row.quote}<p class="text-muted mt-0.5 line-clamp-2 text-xs">“{row.quote}”</p>{/if}
						{#if row.detail && expanded.has(row.id)}{@render details(row.detail)}{/if}
					</div>
				</li>
			{:else if row.type === "run"}
				{@const Icon = quietIcons[row.icon]}
				<li class={[rowClass, "py-1.5 text-xs"]} data-weight="quiet" data-entry={row.id}>
					<span class={markerClass}><Icon size={13} aria-hidden="true" /></span>
					<div class="min-w-0">
						<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
							<p class="text-muted min-w-0 flex-1 basis-48">{@render disclosure(row.id, row.line)}</p>
							{@render stamp(row.from, dates.range(row.from, row.to))}
						</div>
						{#if expanded.has(row.id)}
							<ol class="border-hairline text-muted mt-1.5 space-y-1 border-l pl-3 text-xs">
								{#each row.items as item (item.id)}
									<li>
										{#if item.detail}
											<details><summary class="cursor-pointer"><span class="leading-[1.4]">{item.text}</span> {@render stamp(item.at)}</summary>{@render details(item.detail)}</details>
										{:else}<div class="flex flex-wrap items-baseline gap-2"><span class="min-w-0 flex-1 basis-40 leading-[1.4]">{item.text}</span>{@render stamp(item.at)}</div>{/if}
									</li>
								{/each}
							</ol>
						{/if}
					</div>
				</li>
			{:else if row.type === "contact"}
				{@const entry = row.entry}
				{@const Icon = entry.stop ? MessageSquareOff : channelIcons[entry.channel]}
				{@const voice = entry.actor.kind === "client" ? "client" : "business"}
				{@const noun = entry.channel === "other" ? "logged contact" : `logged ${channelNoun(entry).toLowerCase()}`}
				<li
					class={[rowClass, "group py-2.5 transition-opacity outline-none data-pending:opacity-60"]}
					tabindex="-1"
					aria-busy={entry.pending || undefined}
					data-pending={entry.pending || undefined}
					data-weight="contact"
					data-voice={voice}
					data-entry={row.id}
					data-flash={flashed === row.id || undefined}
					onanimationend={() => (flashed = "")}>
					<span class={markerClass}><span class={discClass}><Icon size={12} aria-hidden="true" /></span></span>
					<div class="min-w-0">
						<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
							<p class="min-w-0 flex-1 basis-48">
								{@render sentence(describeContact(entry, client))}{#if entry.loggedBy}<span class="text-muted text-xs">{" · "}logged by {userFirstName(entry.loggedBy)}</span>{/if}{#if entry.detail}{" "}{@render expander(row.id)}{/if}
							</p>
							{@render rowActions(entry, entry.note, noun)}
							{@render stamp(entry.at)}
						</div>
						{#if entry.opportunityIds?.length}<p class="mt-1 flex flex-wrap gap-1">{@render opportunityLabels(entry.opportunityIds)}</p>{/if}
						{#if editing?.id === entry.id}
							{@render editor(`Note on this ${noun}`)}
						{:else if entry.note}
							<p class="border-hairline mt-1.5 w-fit max-w-[min(100%,34rem)] rounded-2xl rounded-ss-sm border px-3 py-2 wrap-anywhere whitespace-pre-wrap in-data-[voice=client]:border-transparent in-data-[voice=client]:bg-(--client-voice)">
								{entry.note}{#if entry.noteEditedAt}<span class="text-muted text-xs">{" · "}edited</span>{/if}
							</p>
						{/if}
						{#if entry.detail && expanded.has(row.id)}{@render details(entry.detail)}{/if}
						{@render confirmDelete(entry.id, noun)}
					</div>
				</li>
			{:else}
				{@const entry = row.entry}
				{@const open = expanded.has(row.id)}
				<li class={[rowClass, "group py-2.5 transition-opacity outline-none data-pending:opacity-60"]} tabindex="-1" aria-busy={entry.pending || undefined} data-pending={entry.pending || undefined} data-weight="note" data-entry={row.id} data-flash={flashed === row.id || undefined} onanimationend={() => (flashed = "")}>
					<span class={markerClass}><span class={discClass}><StickyNote size={12} aria-hidden="true" /></span></span>
					<div class="min-w-0">
						<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
							<p class="min-w-0 flex-1 basis-48">
								{@render sentence(describeNote(entry, client))}
							</p>
							{@render rowActions(entry, entry.body, "note")}
							{@render stamp(entry.at)}
						</div>
						{#if entry.opportunityIds?.length}<p class="mt-1 flex flex-wrap gap-1">{@render opportunityLabels(entry.opportunityIds)}</p>{/if}
						{#if editing?.id === entry.id}
							{@render editor("Note")}
						{:else}
							<div class="surface mt-1.5 px-3.5 py-3">
								<p class={["wrap-anywhere whitespace-pre-wrap", !open && "line-clamp-5"]}>{entry.body}</p>
								{#if clampable(entry.body) || entry.editedAt}
									<p class="mt-1.5 flex items-center gap-3 text-xs leading-none">
										{#if clampable(entry.body)}<button type="button" class="text-action text-xs" aria-expanded={open} onclick={() => toggle(row.id)}>{open ? "Show less" : `Show all ${entry.body.split("\n").length} lines`}</button>{/if}
										{#if entry.editedAt}<span class="text-muted" title={dates.full(entry.editedAt)}>Edited {dates.short(entry.editedAt)}</span>{/if}
									</p>
								{/if}
							</div>
						{/if}
						{@render confirmDelete(entry.id, "note")}
					</div>
				</li>
			{/if}
		{/each}
	</ol>
{/if}

<style>
	.activity-rail,
	.activity-chat {
		/* The client's own words carry a wash of the accent; the business's stay on the surface inside an edge. */
		--client-voice: color-mix(in oklab, var(--color-field) 9%, var(--color-paper));
	}
	.activity-chat [data-band] {
		background-image: linear-gradient(to right, var(--band));
	}
	.activity-chat li[data-flash] .bubble {
		animation: entry-flash 1.6s ease-out;
		@media (prefers-reduced-motion: reduce) {
			animation-duration: 1ms;
		}
	}
	.activity-rail {
		--spine: calc(var(--spacing) * 3);

		> li {
			--marker-y: calc(var(--spacing) * 1.5 + 0.7em);

			/* The spine runs through every row and stops at the markers that open and close an era. */
			&::before {
				content: "";
				position: absolute;
				inset-block: 0;
				left: calc(var(--spine) - 0.5px);
				width: 1px;
				background: var(--color-hairline);
			}
			&:first-child::before,
			.era + &::before {
				top: var(--marker-y);
			}
			&:last-child::before,
			&:has(+ .era)::before {
				bottom: auto;
				height: var(--marker-y);
			}
			.era + &:is(:last-child, :has(+ .era))::before {
				display: none;
			}

			&[data-weight="contact"],
			&[data-weight="note"] {
				--marker-y: calc(var(--spacing) * 2.5 + 0.7em);
			}
			&[data-flash] {
				animation: entry-flash 1.6s ease-out;
				@media (prefers-reduced-motion: reduce) {
					animation-duration: 1ms;
				}
			}
		}
		> .era {
			display: block;
			padding-block: calc(var(--spacing) * 4) calc(var(--spacing) * 2.5);
			&::before {
				display: none;
			}
			/* Clear of the pane's own divider above, so the two lines never read as one double rule. */
			&:first-child {
				padding-top: calc(var(--spacing) * 2);
			}
		}
	}
	.marker {
		/* Quiet glyphs sit straight on the spine, knocking it out behind them. */
		> :global(svg) {
			padding-block: 3px;
			box-sizing: content-box;
			background: var(--activity-background, var(--color-white));
		}
	}
	@keyframes entry-flash {
		from {
			background: var(--color-selected);
			box-shadow: 0 0 0 calc(var(--spacing) * 2) var(--color-selected);
		}
	}
</style>
