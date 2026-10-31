<script lang="ts">
	import { onMount, tick } from "svelte";
	import { page } from "$app/state";
	import { pushState, replaceState } from "$app/navigation";
	import { Archive, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Columns3Cog, ContactRound, Plus, X } from "@lucide/svelte";
	import { columnVisibilityFeature, createTable, rowSortingFeature, tableFeatures } from "@tanstack/svelte-table";
	import { createClient, getWorkspace, getClients } from "#lib/crm.remote.js";
	import ClientEditor from "#lib/registry/ClientEditor.svelte";
	import { clientDraft, leadSources, newClientDraft, type ClientDraft } from "#lib/registry/client-draft.js";
	import DebounceInput from "#lib/table/DebounceInput.svelte";
	import EmptyState from "#lib/table/EmptyState.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";
	import { stageLabels, stageTones } from "#lib/pipeline/labels.js";

	type ClientRow = {
		id: string;
		name: string;
		archivedAt: string | null;
		leadSource: string | null;
		peopleNames: string[];
		addresses: string[];
		tagNames: string[];
		phone: string | null;
		email: string | null;
		opportunityCount: number;
	};

	const sortIds = ["name", "address", "leadSource", "tags", "opportunities"] as const;
	type SortId = (typeof sortIds)[number];
	const optionalColumns = ["contact", "address", "leadSource", "tags", "opportunities"] as const;
	type OptionalColumn = (typeof optionalColumns)[number];
	const pageSizes = [25, 50, 100] as const;

	const columns = [
		{ id: "name", header: "Client", accessorFn: (row: ClientRow) => row.name },
		{ id: "contact", header: "Contact", accessorFn: (row: ClientRow) => row.phone ?? row.email ?? "" },
		{ id: "address", header: "Address", accessorFn: (row: ClientRow) => row.addresses[0] ?? "" },
		{ id: "leadSource", header: "Lead source", accessorFn: (row: ClientRow) => row.leadSource ?? "" },
		{ id: "tags", header: "Tags", accessorFn: (row: ClientRow) => row.tagNames.join(", ") },
		{ id: "opportunities", header: "Opportunities", accessorFn: (row: ClientRow) => String(row.opportunityCount) },
	];
	const headers = Object.fromEntries(columns.map((column) => [column.id, column.header])) as Record<string, string>;

	// Column visibility is a per-browser view option, so it lives in localStorage rather than the URL.
	const VISIBILITY_STORAGE_KEY = "meadow:registry:column-visibility";
	function loadColumnVisibility(): Record<string, boolean> {
		try {
			const saved: unknown = JSON.parse(localStorage.getItem(VISIBILITY_STORAGE_KEY) ?? "{}");
			const clean: Record<string, boolean> = {};
			if (typeof saved === "object" && saved !== null) {
				for (const key of optionalColumns) {
					const value = (saved as Record<string, unknown>)[key];
					if (typeof value === "boolean") clean[key] = value;
				}
			}
			return clean;
		} catch {
			return {};
		}
	}
	let columnVisibility = $state<Record<string, boolean>>({});
	function setColumnVisible(id: OptionalColumn, visible: boolean) {
		columnVisibility = { ...columnVisibility, [id]: visible };
		try {
			localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(columnVisibility));
		} catch {
			// Storage unavailable; visibility resets on reload.
		}
	}

	// --- URL state -----------------------------------------------------------
	// Normalize before sending to the server so malformed URL values fall back to defaults instead of reaching the validator.
	function readParams() {
		const sp = page.url.searchParams;
		const rawPage = Number(sp.get("page"));
		const rawSize = Number(sp.get("pageSize"));
		const leadSource = sp.get("leadSource");
		const sortRaw = sp.get("sort");
		return {
			q: (sp.get("q") ?? "").slice(0, 200),
			archived: sp.get("archived") === "true",
			tags: sp.getAll("tag").slice(0, 50),
			leadSource: leadSource === null || leadSource === "__any__" ? null : leadSource,
			sort: sortIds.includes(sortRaw as SortId) ? (sortRaw as SortId) : "name",
			sortDir: sp.get("sortDir") === "desc" ? ("desc" as const) : ("asc" as const),
			page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
			pageSize: pageSizes.includes(rawSize as (typeof pageSizes)[number]) ? rawSize : 25,
		};
	}
	let params = $derived(readParams());
	let filtered = $derived(!!params.q || params.tags.length > 0 || params.leadSource !== null);

	// Start both requests before awaiting either, so they load in parallel.
	let remote = $derived(getWorkspace({ archived: params.archived }));
	let clientsQuery = $derived(getClients(params));
	let workspace = $derived(await remote);
	let clients = $derived(await clientsQuery);
	let loading = $derived($effect.pending() > 0);

	const total = $derived(clients.total);
	const totalPages = $derived(Math.max(1, Math.ceil(total / params.pageSize)));
	const firstShown = $derived(total ? (params.page - 1) * params.pageSize + 1 : 0);
	const lastShown = $derived(Math.min(total, params.page * params.pageSize));

	// Clamp the page to the last page when the results shrink.
	$effect(() => {
		if (params.page > totalPages) setPage(totalPages);
	});

	function updateUrl(updater: (sp: URLSearchParams) => void, history: "push" | "replace" = "replace") {
		const url = new URL(page.url.href);
		updater(url.searchParams);
		if (history === "push") pushState(url, page.state);
		else replaceState(url, page.state);
	}
	function setSearch(next: string) {
		updateUrl((sp) => {
			if (next.trim()) sp.set("q", next.trim().slice(0, 200));
			else sp.delete("q");
			sp.delete("page");
		});
	}
	function setPage(next: number) {
		updateUrl((sp) => {
			if (next <= 1) sp.delete("page");
			else sp.set("page", String(next));
		});
	}
	function turnPage(next: number) {
		setPage(next);
		document.getElementById("workspace-main")?.scrollTo({ top: 0 });
	}
	function setPageSize(next: number) {
		updateUrl((sp) => {
			if (next === 25) sp.delete("pageSize");
			else sp.set("pageSize", String(next));
			sp.delete("page");
		});
	}
	function setSort(id: SortId) {
		const dir = params.sort === id && params.sortDir === "asc" ? "desc" : "asc";
		updateUrl((sp) => {
			sp.set("sort", id);
			sp.set("sortDir", dir);
			sp.delete("page");
		});
	}
	function toggleTag(tagId: string) {
		updateUrl((sp) => {
			const tags = sp.getAll("tag");
			sp.delete("tag");
			for (const tag of tags.includes(tagId) ? tags.filter((tag) => tag !== tagId) : [...tags, tagId]) sp.append("tag", tag);
			sp.delete("page");
		}, "push");
	}
	function setLeadSource(next: string) {
		updateUrl((sp) => {
			if (next === "__any__") sp.delete("leadSource");
			else sp.set("leadSource", next);
			sp.delete("page");
		}, "push");
	}
	function toggleArchived() {
		updateUrl((sp) => {
			if (params.archived) sp.delete("archived");
			else sp.set("archived", "true");
			sp.delete("page");
		}, "push");
	}
	function clearFilters() {
		updateUrl((sp) => {
			for (const key of ["q", "tag", "leadSource", "page"]) sp.delete(key);
		}, "push");
	}

	const tagsByName = $derived(new Map(workspace.tags.map((tag) => [tag.name, tag])));
	const tagFilters = $derived(workspace.tags.filter((tag) => !tag.retiredAt || params.tags.includes(tag.id)).sort((a, b) => a.name.localeCompare(b.name)));
	const leadSourceOptions = $derived([
		{ value: "__any__", label: "Any lead source" },
		{ value: "", label: "No lead source" },
		...[...new Set([...leadSources, ...workspace.clients.map((client) => client.leadSource).filter((source): source is string => !!source)])].sort().map((source) => ({ value: source, label: source })),
	]);

	// --- TanStack Table, server-backed --------------------------------------
	// Data is one server page: the server sorts and paginates, and the table tracks sorting for the header indicators plus column visibility.
	const table = createTable({
		features: tableFeatures({ columnVisibilityFeature, rowSortingFeature }),
		columns,
		get data() {
			return clients.clients;
		},
		getRowId: (row: ClientRow) => row.id,
		state: {
			get sorting() {
				return [{ id: params.sort, desc: params.sortDir === "desc" }];
			},
			get columnVisibility() {
				return columnVisibility;
			},
		},
	});
	let rows = $derived(table.getRowModel().rows);
	let visibleColumns = $derived(table.getVisibleLeafColumns());
	const tableFade = overflowFade({ axis: "x", fadePercent: 6 });

	/** North American numbers read as (503) 555-0123; anything else shows as entered. */
	function formatPhone(value: string) {
		const digits = value.replace(/\D/g, "");
		const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
		return local.length === 10 ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}` : value;
	}

	/** People to show under the client's name: everyone unless the client is exactly one person of the same name. */
	function otherPeople(row: ClientRow) {
		return row.peopleNames.length === 1 && row.peopleNames[0] === row.name ? "" : row.peopleNames.join(" · ");
	}

	// --- Side panel ----------------------------------------------------------
	let dialog: HTMLDialogElement | undefined = $state();
	let opener: HTMLElement | null = null;
	let creating = $state(false);
	let clientId = $state("");
	let requestId = $state("");
	let newName = $state("");
	let draft = $state<ClientDraft | null>(null);
	let fresh = $state(false);
	let pending = $state(false);
	let failure = $state("");
	let saved = $state("");
	let ready = $state(false);
	const person = (id: string) => ({ "business-realtor": "Realtor", "business-assistant": "Assistant", "support-admin": "Support admin" })[id] ?? id;
	let lastHandledClientId = $state<string | null>(null);
	onMount(() => {
		columnVisibility = loadColumnVisibility();
		ready = true;
	});
	// Svelte may not remount the page when only ?client changes, so open the panel whenever the requested client differs from the last one handled.
	$effect(() => {
		const clientIdFromUrl = page.url.searchParams.get("client");
		if (!clientIdFromUrl) {
			lastHandledClientId = null;
			return;
		}
		if (clientIdFromUrl === lastHandledClientId || !ready) return;
		const record = workspace.clients.find((client) => client.id === clientIdFromUrl);
		if (!record) return;
		lastHandledClientId = clientIdFromUrl;
		creating = false;
		draft = clientDraft(record);
		openPanel();
	});
	let record = $derived(draft ? workspace.clients.find((client) => client.id === draft?.id) : undefined);
	let linked = $derived(draft ? workspace.links.filter((link) => link.clientId === draft?.id) : []);
	let changes = $derived(draft ? workspace.history.filter((change) => change.recordKind === "client" && change.recordId === draft?.id) : []);
	async function openPanel() {
		opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		failure = "";
		saved = "";
		dialog?.showModal();
		// Start on the panel's close button, or the name field when creating, rather than whatever showModal picks first.
		await tick();
		dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
	}
	function newClient() {
		clientId = crypto.randomUUID();
		requestId = crypto.randomUUID();
		newName = "";
		draft = null;
		creating = true;
		openPanel();
	}
	function editClient(id: string) {
		const found = workspace.clients.find((client) => client.id === id);
		if (!found) return;
		creating = false;
		draft = clientDraft(found);
		openPanel();
	}
	function onclose() {
		creating = false;
		fresh = false;
		draft = null;
		saved = "";
		opener?.focus();
		opener = null;
	}
	const timeFormat = $derived(new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: workspace.settings?.timezone ?? "America/Los_Angeles" }));
</script>

<svelte:head><title>Registry · Meadow Lane</title></svelte:head>

{#snippet tagChips(names: string[])}
	{#each names as name (name)}
		{@const tag = tagsByName.get(name)}
		<span class="chip" data-dot style:--dot={tag?.color}>{name}</span>
	{/each}
{/snippet}

{#snippet empty()}
	<span class="text-muted/60" aria-hidden="true">—</span><span class="sr-only">None</span>
{/snippet}

<div class="surface-content @container/registry" data-tight>
	<div class="flex flex-wrap items-center gap-2">
		<DebounceInput id="registry-search" label="Search clients" class="grow basis-48" value={params.q} onChange={setSearch} debounce={200} placeholder="Search clients" />
		<div class="ml-auto flex shrink-0 items-center gap-2">
			<button type="button" class="control @max-[48rem]/registry:hidden" data-icon popovertarget="registry-columns" style:anchor-name="--registry-columns" aria-label="Columns" title="Columns"><Columns3Cog size={18} aria-hidden="true" /></button>
			<div id="registry-columns" popover="auto" role="group" aria-label="Columns" class="surface surface-floating menu" style:position-anchor="--registry-columns">
				<p class="text-muted px-2.5 pt-1 pb-1.5 text-xs font-medium">Show columns</p>
				{#each optionalColumns as id (id)}
					<label class="menu-item cursor-pointer">
						<input class="check" type="checkbox" checked={columnVisibility[id] !== false} onchange={(event) => setColumnVisible(id, event.currentTarget.checked)} />
						{headers[id]}
					</label>
				{/each}
			</div>
			<button type="button" class="control" data-reveal aria-pressed={params.archived} aria-label="Archived clients" disabled={!ready} onclick={toggleArchived}><Archive size={16} aria-hidden="true" /><span class="control-label" aria-hidden="true"><span><span>Archived</span></span></span></button>
			<button type="button" class="control" data-variant="primary" disabled={!ready} onclick={newClient}><Plus size={16} aria-hidden="true" /><span class="@max-[30rem]/registry:sr-only">New client</span></button>
		</div>
	</div>

	<div role="group" aria-label="Filter clients" class="mt-3 flex flex-wrap items-center gap-2">
		{#each tagFilters as tag (tag.id)}
			<button type="button" class="control" data-size="sm" aria-pressed={params.tags.includes(tag.id)} disabled={!ready} onclick={() => toggleTag(tag.id)}>
				<span class="size-1.5 shrink-0 rounded-full" style:background={tag.color} aria-hidden="true"></span>{tag.name}
			</button>
		{/each}
		{#if tagFilters.length}<span class="bg-hairline mx-0.5 h-5 w-px" aria-hidden="true"></span>{/if}
		<Select appearance="pill" label="Lead source" active={params.leadSource !== null} value={params.leadSource ?? "__any__"} options={leadSourceOptions} disabled={!ready} onchange={setLeadSource} />
		{#if filtered}
			<button type="button" class="text-action ml-1" onclick={clearFilters}><X size={14} aria-hidden="true" />Clear</button>
		{/if}
	</div>

	{#if params.archived}
		<p class="bg-tour-soft text-tour mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-2.5 text-sm [--action-color:var(--color-tour)]">
			<Archive size={15} class="shrink-0" aria-hidden="true" />
			<span class="min-w-0 flex-1">Showing archived clients. Open one to restore it.</span>
			<button type="button" class="text-action" onclick={toggleArchived}>Back to current clients</button>
		</p>
	{/if}

	<div class={["mt-5 transition-opacity duration-150 motion-reduce:transition-none", loading && "opacity-60"]} aria-busy={loading}>
		{#if rows.length === 0}
			<EmptyState
				title={filtered ? "No clients match" : params.archived ? "No archived clients" : "No clients yet"}
				description={filtered ? (params.q ? `Nothing matches “${params.q}” with these filters.` : "Try removing a filter.") : params.archived ? "Archived clients appear here." : "Add the first client to get started."}>
				{#snippet icon()}<ContactRound size={20} strokeWidth={1.4} />{/snippet}
				{#snippet actions()}
					{#if filtered}<button type="button" class="control" onclick={clearFilters}>Clear filters</button>
					{:else if !params.archived}<button type="button" class="control" data-variant="primary" disabled={!ready} onclick={newClient}><Plus size={16} aria-hidden="true" />New client</button>{/if}
				{/snippet}
			</EmptyState>
		{:else}
			<div class="surface overflow-hidden">
				<!-- Wide workspaces get the dense, sortable table. -->
				<div class="overflow-x-auto @max-[48rem]/registry:hidden" {@attach tableFade}>
					<table class="w-full text-left text-sm">
						<thead class="border-hairline border-b">
							<tr>
								{#each visibleColumns as column (column.id)}
									{@const id = column.id}
									{@const sortable = sortIds.includes(id as SortId)}
									{@const active = params.sort === id}
									<th scope="col" aria-sort={active ? (params.sortDir === "asc" ? "ascending" : "descending") : undefined} class={["px-4 py-2 text-xs font-medium whitespace-nowrap first:pl-5 last:pr-5", active ? "text-ink" : "text-muted", id === "opportunities" && "text-right"]}>
										{#if sortable}
											<button type="button" class="group/sort hover:text-ink -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium" onclick={() => setSort(id as SortId)}>
												{headers[id]}
												{#if active && params.sortDir === "asc"}<ArrowUp size={13} aria-hidden="true" />
												{:else if active}<ArrowDown size={13} aria-hidden="true" />
												{:else}<ChevronsUpDown size={13} class="opacity-0 transition-opacity group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60" aria-hidden="true" />{/if}
											</button>
										{:else}
											<span class="py-1">{headers[id]}</span>
										{/if}
									</th>
								{/each}
							</tr>
						</thead>
						<tbody class="divide-hairline divide-y">
							{#each rows as row (row.id)}
								{@const c = row.original}
								<tr class="hover:bg-highlight has-[:focus-visible]:bg-highlight relative transition-colors duration-120">
									{#each visibleColumns as column (column.id)}
										<td class={["px-4 py-3 first:pl-5 last:pr-5", column.id === "opportunities" && "text-right"]}>
											{#if column.id === "name"}
												{@const others = otherPeople(c)}
												<div class="max-w-72 min-w-44">
													<button type="button" class="item-title block max-w-full truncate text-left after:absolute after:inset-0" disabled={!ready} onclick={() => editClient(c.id)}>{c.name}</button>
													{#if others}<p class="text-muted mt-0.5 truncate text-xs">{others}</p>{/if}
												</div>
											{:else if column.id === "contact"}
												{#if c.phone || c.email}
													<div class="flex max-w-60 flex-col items-start">
														{#if c.phone}<a class="relative z-1 tabular-nums hover:underline" href={`tel:${c.phone}`}>{formatPhone(c.phone)}</a>{/if}
														{#if c.email}<a class="text-muted relative z-1 max-w-full truncate text-xs hover:underline" href={`mailto:${c.email}`}>{c.email}</a>{/if}
													</div>
												{:else}{@render empty()}{/if}
											{:else if column.id === "address"}
												{#if c.addresses.length}
													<p class="flex max-w-72 min-w-40 items-baseline gap-1.5">
														<span class="truncate" title={c.addresses[0]}>{c.addresses[0]}</span>
														{#if c.addresses.length > 1}<span class="text-muted shrink-0 text-xs">+{c.addresses.length - 1}</span>{/if}
													</p>
												{:else}{@render empty()}{/if}
											{:else if column.id === "leadSource"}
												{#if c.leadSource}<span class="whitespace-nowrap">{c.leadSource}</span>{:else}{@render empty()}{/if}
											{:else if column.id === "tags"}
												{#if c.tagNames.length}<div class="flex flex-wrap gap-1">{@render tagChips(c.tagNames)}</div>{:else}{@render empty()}{/if}
											{:else if column.id === "opportunities"}
												{#if c.opportunityCount}<span class="tabular-nums">{c.opportunityCount}</span>{:else}{@render empty()}{/if}
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Narrow workspaces get a stacked list with the same rows. -->
				<ul class="divide-hairline divide-y @min-[48rem]/registry:hidden">
					{#each rows as row (row.id)}
						{@const c = row.original}
						{@const others = otherPeople(c)}
						<li class="hover:bg-highlight has-[:focus-visible]:bg-highlight relative px-4 py-3 transition-colors duration-120">
							<div class="flex items-start gap-3">
								<div class="min-w-0 flex-1">
									<button type="button" class="item-title block max-w-full truncate text-left after:absolute after:inset-0" disabled={!ready} onclick={() => editClient(c.id)}>{c.name}</button>
									{#if others}<p class="text-muted mt-0.5 truncate text-xs">{others}</p>{/if}
									{#if c.phone || c.email}
										<p class="text-muted mt-1 flex min-w-0 items-baseline gap-x-3 text-xs">
											{#if c.phone}<a class="relative z-1 shrink-0 tabular-nums" href={`tel:${c.phone}`}>{formatPhone(c.phone)}</a>{/if}
											{#if c.email}<a class="relative z-1 truncate" href={`mailto:${c.email}`}>{c.email}</a>{/if}
										</p>
									{/if}
								</div>
								{#if c.tagNames.length}<div class="flex shrink-0 flex-wrap justify-end gap-1">{@render tagChips(c.tagNames)}</div>{/if}
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if total > 0}
			<div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
				<p class="text-muted tabular-nums" role="status">{total <= params.pageSize && params.page === 1 ? `${total} ${total === 1 ? "client" : "clients"}` : `${firstShown}–${lastShown} of ${total} clients`}</p>
				<div class="ml-auto flex flex-wrap items-center gap-2">
					{#if total > pageSizes[0]}
						<Select appearance="pill" label="Clients per page" value={String(params.pageSize)} options={pageSizes.map((size) => ({ value: String(size), label: `${size} per page` }))} disabled={!ready} onchange={(size) => setPageSize(Number(size))} />
					{/if}
					{#if totalPages > 1}
						<nav aria-label="Pages" class="flex items-center gap-1">
							<button type="button" class="control" data-size="sm" data-icon aria-label="Previous page" disabled={params.page <= 1 || !ready} onclick={() => turnPage(params.page - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
							<span class="px-1.5 whitespace-nowrap tabular-nums">Page {params.page} of {totalPages}</span>
							<button type="button" class="control" data-size="sm" data-icon aria-label="Next page" disabled={params.page >= totalPages || !ready} onclick={() => turnPage(params.page + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
						</nav>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<dialog
	bind:this={dialog}
	{onclose}
	oncancel={(event) => {
		if (pending) event.preventDefault();
	}}
	aria-labelledby="client-panel-heading"
	class="dialog"
	data-placement="side">
	<header class="bg-canvas/95 border-hairline sticky top-0 z-20 flex items-center gap-2 border-b px-4 py-2.5 sm:px-6">
		<span class="text-muted flex min-w-0 items-center gap-1.5 text-sm">
			<ContactRound size={14} class="shrink-0" aria-hidden="true" />Registry<span aria-hidden="true">/</span>
			<span class="text-ink truncate font-medium">{creating ? "New client" : record?.archivedAt ? "Archived client" : "Client"}</span>
		</span>
		<button type="button" class="control ml-auto" data-variant="ghost" data-size="sm" data-icon data-autofocus={!creating || undefined} aria-label="Close" disabled={pending} onclick={() => dialog?.close()}><X size={17} aria-hidden="true" /></button>
	</header>
	<div class="px-4 pt-5 pb-6 sm:px-6">
		{#if saved}<p role="status" class="bg-success-soft text-success mb-4 rounded-xl px-3.5 py-2 text-sm">{saved}</p>{/if}
		{#if creating}
			<h2 id="client-panel-heading" class="font-display mb-5 text-3xl tracking-tight">New client</h2>
			<form
				class="space-y-4"
				{...createClient.enhance(async (form) => {
					failure = "";
					try {
						if (await form.submit().updates(remote)) {
							draft = newClientDraft(clientId, newName.trim());
							creating = false;
							fresh = true;
							saved = "Client created. Add how to reach them.";
						}
					} catch {
						failure = "Client could not be created. Your name is retained; try again.";
					}
				})}>
				<input {...createClient.fields.id.as("hidden", clientId)} />
				<input {...createClient.fields.requestId.as("hidden", requestId)} />
				<label class="block space-y-1.5"
					><span class="text-muted text-xs font-medium">Client name</span><input class="field" {...createClient.fields.name.as("text")} oninput={(event) => (newName = event.currentTarget.value)} data-autofocus required maxlength="200" autocomplete="off" placeholder="A person, or a couple such as The Millers" /></label>
				{#each createClient.fields.allIssues() ?? [] as issue (issue)}<p class="text-urgent" role="alert">{issue.message}</p>{/each}
				{#if failure}<p class="text-urgent" role="alert">{failure}</p>{/if}
				<div class="flex flex-wrap gap-2">
					<button class="control" data-variant="primary" disabled={!!createClient.pending} aria-busy={!!createClient.pending}>{createClient.pending ? "Saving…" : "Create client"}</button>
					<button type="button" class="control" data-variant="ghost" onclick={() => dialog?.close()}>Cancel</button>
				</div>
			</form>
		{:else if draft}
			{#key draft.id}
				<ClientEditor bind:draft bind:pending {workspace} {remote} {fresh} saved={() => (saved = "Client saved.")}>
					{#snippet opportunities()}
						<div class="mb-2 flex min-h-8 items-center justify-between gap-3">
							<h3 class="font-display text-lg">Opportunities</h3>
							<a class="text-action" href={`/pipeline?client=${draft?.id}`}><Plus size={14} aria-hidden="true" />New</a>
						</div>
						<ul class="space-y-1">
							{#each linked as link (link.opportunityId)}
								{@const opportunity = workspace.opportunities.find((row) => row.id === link.opportunityId)}
								{#if opportunity}
									<li>
										<a class="work-row hover:bg-highlight flex min-h-10 items-center gap-3 px-3 py-1.5 transition-colors" href={`/pipeline?opportunity=${opportunity.id}`}>
											<span class="item-title min-w-0 flex-1 truncate">{opportunity.title}</span>
											<span class="chip shrink-0" data-tone={stageTones[opportunity.stage]}>{stageLabels[opportunity.stage]}</span>
										</a>
									</li>
								{/if}
							{:else}
								<li class="text-muted">None yet.</li>
							{/each}
						</ul>
					{/snippet}
				</ClientEditor>
			{/key}
			<details class="border-hairline mt-1 border-t pt-4 text-sm">
				<summary class="text-muted cursor-pointer">History <span>· {changes.length} {changes.length === 1 ? "change" : "changes"}</span></summary>
				<ol class="mt-3 space-y-2.5">
					{#each changes as change (change.id)}
						<li class="min-w-0">
							<details>
								<summary class="cursor-pointer"
									><span class="font-medium capitalize">{change.action}</span>
									<span class="text-muted text-xs"><time datetime={change.createdAt}>{timeFormat.format(new Date(change.createdAt))}</time> · {change.actorUserId !== change.effectiveUserId ? `${person(change.actorUserId)} as ${person(change.effectiveUserId)}` : person(change.effectiveUserId)}</span></summary>
								<pre class="bg-paper text-muted mt-1.5 rounded-lg p-3 text-xs wrap-anywhere whitespace-pre-wrap">{JSON.stringify(change.data, null, 2)}</pre>
							</details>
						</li>
					{:else}<li class="text-muted">No changes recorded.</li>{/each}
				</ol>
			</details>
		{/if}
	</div>
</dialog>
