<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import { replaceState } from "$app/navigation";
	import { ArrowRight } from "@lucide/svelte";
	import { columnFilteringFeature, createExpandedRowModel, createFilteredRowModel, createTable, filterFn_includesString, globalFilteringFeature, rowExpandingFeature, tableFeatures, type ExpandedState } from "@tanstack/svelte-table";
	import GlossaryOutline from "#lib/glossary/GlossaryOutline.svelte";
	import { allTerms, insteadOf, pathOf, slug } from "#lib/glossary/tree.js";
	import { vocabulary, type Term } from "#lib/glossary/vocabulary.js";
	import DebounceInput from "#lib/table/DebounceInput.svelte";
	import EmptyState from "#lib/table/EmptyState.svelte";

	const features = tableFeatures({
		columnFilteringFeature,
		globalFilteringFeature,
		rowExpandingFeature,
		filteredRowModel: createFilteredRowModel(),
		expandedRowModel: createExpandedRowModel(),
		filterFns: { includesString: filterFn_includesString },
	});
	// The outline renders its own markup; the columns exist so search covers every word a term shows.
	const columns = [
		{ id: "term", accessorFn: (entry: Term) => entry.term },
		{ id: "kind", accessorFn: (entry: Term) => entry.kind },
		{ id: "meaning", accessorFn: (entry: Term) => `${entry.meaning} ${entry.open ?? ""}` },
		{ id: "not", accessorFn: (entry: Term) => (entry.not ?? []).join(", ") },
	];

	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	let search = $state(page.url.searchParams.get("q") ?? "");
	let expanded = $state<ExpandedState>(true);
	const searching = $derived(search.trim().length > 0);

	const table = createTable({
		features,
		columns,
		data: vocabulary,
		getSubRows: (entry) => entry.children,
		getRowId: (entry) => slug(entry.term),
		globalFilterFn: "includesString",
		// Keep the path to a matching term visible, and open every branch while searching.
		filterFromLeafRows: true,
		state: {
			get globalFilter() {
				return search.trim();
			},
			get expanded() {
				return searching ? true : expanded;
			},
		},
		onGlobalFilterChange: (next) => {
			search = typeof next === "function" ? next(search) : (next ?? "");
		},
		onExpandedChange: (next) => {
			expanded = typeof next === "function" ? next(expanded) : next;
		},
		// The vocabulary never changes at runtime; without this, every row-model rebuild resets the user's expansion.
		autoResetExpanded: false,
	});

	const rows = $derived(table.getRowModel().rows);
	const allExpanded = $derived(searching || table.getIsAllRowsExpanded());
	const shown = $derived(table.getFilteredRowModel().flatRows.length);
	const instead = $derived(insteadOf(search));
	const exact = $derived(allTerms.find((entry) => entry.term.toLowerCase() === search.trim().toLowerCase()));

	// Searches are shareable: the query lives in the URL without adding history entries.
	function setSearch(value: string) {
		search = value;
		if (!ready) return;
		const url = new URL(page.url.href);
		if (value.trim()) url.searchParams.set("q", value.trim());
		else url.searchParams.delete("q");
		replaceState(url, page.state);
	}
	function reveal(term: string) {
		for (const ancestor of pathOf(term)) table.getRow(slug(ancestor))?.toggleExpanded(true);
	}
</script>

<svelte:head><title>Glossary · Meadow Lane</title></svelte:head>

<div class="surface-content">
	<p class="text-muted max-w-2xl text-sm/6">The words this workspace uses, what each one means, and the words to avoid. Kinds marked with an info icon explain themselves on hover or tap.</p>

	<div class="mt-6 space-y-3">
		<div class="flex flex-wrap items-center gap-2">
			<DebounceInput id="glossary-search" label="Search terms" class="grow basis-72" placeholder="Search terms or words to avoid" debounce={180} value={search} onChange={setSearch} />
			<button type="button" class="control" disabled={!ready || searching} aria-controls="glossary-results" onclick={() => (expanded = allExpanded ? {} : true)}>{allExpanded ? "Collapse all" : "Expand all"}</button>
		</div>
		{#if instead}
			<p class="bg-pending-soft text-pending flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-4 py-2.5 text-sm [--action-color:var(--color-pending)]">
				<span>“{search.trim()}” isn't a Meadow word.</span>
				<button type="button" class="text-action" disabled={!ready} onclick={() => setSearch(instead.term)}>Say {instead.term}<ArrowRight size={14} aria-hidden="true" /></button>
			</p>
		{/if}
		<p class="text-muted text-xs" role="status">{searching ? `${shown} matching ${shown === 1 ? "term" : "terms"}` : `${allTerms.length} terms`}</p>
	</div>

	<div class="mt-5">
		{#if rows.length}
			<GlossaryOutline {rows} {ready} filtering={searching} {reveal} prefer={exact && slug(exact.term)} />
		{:else}
			<EmptyState title="Nothing matches" description={`No term, meaning, or word to avoid contains “${search.trim()}”.`}>
				{#snippet actions()}<button type="button" class="control" onclick={() => setSearch("")}>Clear search</button>{/snippet}
			</EmptyState>
		{/if}
	</div>
</div>
