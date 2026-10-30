<script lang="ts">
	import { ChevronRight } from "@lucide/svelte";
	import CopyLink from "./CopyLink.svelte";
	import KindBadge from "./KindBadge.svelte";
	import TreeGuides from "./TreeGuides.svelte";
	import { allTerms, mentionsOf, pathOf, slug, splitAvoid, treeGuides } from "./tree.ts";
	import type { GlossaryRow } from "./table.ts";
	import type { Term } from "./vocabulary.ts";

	let {
		rows,
		ready,
		filtering,
		reveal,
		prefer,
	}: {
		rows: GlossaryRow[];
		ready: boolean;
		filtering: boolean;
		reveal: (term: string) => void;
		/** A term to show while filtering, such as one whose name was searched exactly. */
		prefer?: string;
	} = $props();
	const guides = $derived(treeGuides(rows.map((row) => row.depth)));

	// A choice remembers which exact search it was made under, so a newer exact search can take over.
	let chosen = $state<{ id: string; prefer?: string }>();
	// Follow the search: a choice made under the current search wins, then an exactly named term, then any earlier choice that still matches, then the first match.
	const visible = (id?: string) => !!id && rows.some((row) => row.id === id);
	const recent = $derived(chosen && chosen.prefer === prefer ? chosen.id : undefined);
	const selectedId = $derived(filtering ? ([recent, prefer, chosen?.id].find(visible) ?? rows[0]?.id) : (chosen?.id ?? rows[0]?.id));
	const selected = $derived(allTerms.find((entry) => slug(entry.term) === selectedId));

	let list: HTMLOListElement | undefined = $state();
	function select(term: string) {
		chosen = { id: slug(term), prefer };
		reveal(term);
	}
	function navigate(event: KeyboardEvent) {
		const items = [...(list?.querySelectorAll<HTMLButtonElement>("[data-outline-item]") ?? [])];
		const current = items.indexOf(document.activeElement as HTMLButtonElement);
		if (current < 0) return;
		const row = rows[current];
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const next = items[Math.min(items.length - 1, Math.max(0, current + (event.key === "ArrowDown" ? 1 : -1)))];
			next.focus();
			next.click();
		} else if (event.key === "ArrowRight" && row.getCanExpand() && !filtering) {
			row.toggleExpanded(true);
		} else if (event.key === "ArrowLeft" && row.getCanExpand() && !filtering) {
			row.toggleExpanded(false);
		}
	}
</script>

{#snippet chips(label: string, terms: Term[])}
	{#if terms.length}
		<div class="mt-6">
			<h3 class="text-muted text-2xs font-medium tracking-wide uppercase">{label}</h3>
			<div class="mt-2 flex flex-wrap gap-1.5">
				{#each terms as entry (entry.term)}<button type="button" class="control" data-size="sm" aria-pressed={slug(entry.term) === selectedId} onclick={() => select(entry.term)}>{entry.term}</button>{/each}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet detail(entry: Term)}
	{@const path = pathOf(entry.term)}
	<article class="surface surface-floating p-5 sm:p-7" aria-live="polite">
		{#if path.length}
			<nav aria-label="Path" class="text-muted flex flex-wrap items-center gap-1 text-xs">
				{#each path as ancestor (ancestor)}<button type="button" class="text-action" onclick={() => select(ancestor)}>{ancestor}</button><ChevronRight size={12} aria-hidden="true" />{/each}
			</nav>
		{/if}
		<div class="mt-2 flex items-start justify-between gap-3">
			<h2 class="font-display text-3xl/9 tracking-tight">{entry.term}</h2>
			<CopyLink id={slug(entry.term)} term={entry.term} />
		</div>
		<div class="mt-2"><KindBadge kind={entry.kind} /></div>
		<p class="text-ink/90 mt-5 max-w-prose text-[0.9375rem]/7 text-pretty">{entry.meaning}</p>
		{#if entry.open}
			<div class="bg-pending-soft text-pending mt-5 rounded-xl px-4 py-3 text-sm/6">
				<p class="font-medium">Open question</p>
				<p>{entry.open}</p>
			</div>
		{/if}
		{#if entry.not?.length}
			<div class="mt-6">
				<h3 class="text-muted text-2xs font-medium tracking-wide uppercase">Don't say it this way</h3>
				<p class="mt-2 text-sm/6">
					{#each entry.not.map(splitAvoid) as avoid, index (avoid.word)}<span class="text-muted decoration-urgent/50 line-through">{avoid.word}</span>{#if avoid.note}<span class="text-muted"> ({avoid.note})</span>{/if}{index < entry.not.length - 1 ? ", " : ""}{/each}
				</p>
			</div>
		{/if}
		{@render chips("Contains", entry.children ?? [])}
		{@render chips(
			"Mentioned in",
			mentionsOf(entry.term).filter((other) => !path.includes(other.term) && !entry.children?.includes(other)),
		)}
	</article>
{/snippet}

<!-- Outline and detail: the hierarchy stays visible on the left while one term is read in full. Phones open the detail under the chosen term. -->
<div id="glossary-results" class="@container/outline">
	<div class="grid gap-6 @3xl/outline:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<ol bind:this={list} aria-label="Terms" class="space-y-px" onkeydown={navigate}>
			{#each rows as row, index (row.id)}
				{@const entry = row.original}
				{@const current = row.id === selectedId}
				<li class="relative" style:--indent={`${row.depth * 14}px`}>
					<TreeGuides guide={guides[index]} y="1.125rem" />
					<div class="flex items-center gap-0.5 pl-(--indent)">
						{#if row.getCanExpand()}
							<button type="button" tabindex="-1" class="control" data-variant="ghost" data-size="sm" data-icon disabled={!ready || filtering} aria-expanded={row.getIsExpanded()} aria-label={`${row.getIsExpanded() ? "Hide" : "Show"} terms under ${entry.term}`} onclick={() => row.toggleExpanded()}>
								<ChevronRight size={14} class="transition-transform duration-150 in-aria-expanded:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
							</button>
						{:else}
							<span class="w-9 shrink-0 pointer-coarse:w-11" aria-hidden="true"></span>
						{/if}
						<button type="button" data-outline-item aria-current={current || undefined} class="menu-item min-w-0 grow text-sm" onclick={() => select(entry.term)}>
							<span class={["truncate", row.depth === 0 && "font-medium"]}>{entry.term}</span>
							{#if entry.open}<span class="bg-pending size-1.5 shrink-0 rounded-full" title="Has an open question"></span>{/if}
							<span class="text-2xs ml-auto shrink-0 opacity-50">{entry.kind}</span>
						</button>
					</div>
					{#if current && selected}
						<div class="mt-2 mb-4 pl-[calc(var(--indent)+2.375rem)] @3xl/outline:hidden pointer-coarse:pl-[calc(var(--indent)+2.875rem)]">{@render detail(selected)}</div>
					{/if}
				</li>
			{/each}
		</ol>
		<div class="hidden @3xl/outline:block">
			<div class="sticky top-4">
				{#if selected}{@render detail(selected)}{:else}<p class="text-muted text-sm">No terms match.</p>{/if}
			</div>
		</div>
	</div>
</div>
