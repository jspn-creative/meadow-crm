<script lang="ts">
	import { lightDismiss } from "#lib/ui/light-dismiss.js";
	import { onMount, tick } from "svelte";
	import { page } from "$app/state";
	import { afterNavigate, goto } from "$app/navigation";
	import { Archive, ArchiveRestore, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Ban, Check, Columns3Cog, ContactRound, EyeOff, ListFilter, LoaderCircle, Mail, MailOpen, MessageSquare, Phone, Plus, Tag, Undo2, X } from "@lucide/svelte";
	import { columnOrderingFeature, columnVisibilityFeature, createTable, rowSortingFeature, tableFeatures } from "@tanstack/svelte-table";
	import { bulkUpdateClients, createClient, getClientFacets, getClientIds, getClients, getWorkspace } from "#lib/crm.remote.js";
	import ClientEditor from "#lib/registry/ClientEditor.svelte";
	import { clientDraft, leadSources, newClientDraft, type ClientDraft } from "#lib/registry/client-draft.js";
	import { formatPhone } from "#lib/registry/format.js";
	import { builderField, builderFields, channelLabels, channels, filterSummary, needsValue, newFilter, parseFilter, serializeFilter, serverFilter, type BuilderField, type BuilderFilter, type Channel } from "#lib/registry/filters.js";
	import BulkActionsBar from "#lib/table/BulkActionsBar.svelte";
	import DebounceInput from "#lib/table/DebounceInput.svelte";
	import EmptyState from "#lib/table/EmptyState.svelte";
	import FacetedFilter from "#lib/table/FacetedFilter.svelte";
	import FilterChip from "#lib/table/FilterChip.svelte";
	import ContextMenu from "#lib/ui/ContextMenu.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";
	import { stageLabels, stageTones } from "#lib/pipeline/labels.js";

	type ClientRow = Awaited<ReturnType<typeof getClients>>["clients"][number];
	type SortId = "name" | "address" | "leadSource" | "tags" | "opportunities" | "referredBy" | "created";
	type ColumnId = "name" | "contact" | "address" | "leadSource" | "tags" | "opportunities" | "consent" | "referredBy" | "created";

	// --- Columns -------------------------------------------------------------
	// Name is the row's anchor: it stays first and visible. The rest can be hidden or moved, per browser.
	const columnMeta: Record<ColumnId, { header: string; sort?: [asc: string, desc: string]; end?: boolean }> = {
		name: { header: "Client", sort: ["Sort A to Z", "Sort Z to A"] },
		contact: { header: "Contact" },
		address: { header: "Address", sort: ["Sort A to Z", "Sort Z to A"] },
		leadSource: { header: "Lead source", sort: ["Sort A to Z", "Sort Z to A"] },
		tags: { header: "Tags", sort: ["Sort A to Z", "Sort Z to A"] },
		opportunities: { header: "Opportunities", sort: ["Fewest first", "Most first"], end: true },
		consent: { header: "Consent" },
		referredBy: { header: "Referred by", sort: ["Sort A to Z", "Sort Z to A"] },
		created: { header: "Created", sort: ["Oldest first", "Newest first"] },
	};
	const columnIds = Object.keys(columnMeta) as ColumnId[];
	const movableIds = columnIds.filter((id) => id !== "name");
	const defaultHidden: Partial<Record<ColumnId, boolean>> = { referredBy: false, created: false };
	const columns = columnIds.map((id) => ({ id, header: columnMeta[id].header, accessorFn: (row: ClientRow) => row.id, enableHiding: id !== "name" }));

	// Column visibility and order are per-browser view options, so they live in localStorage rather than the URL.
	const COLUMNS_STORAGE_KEY = "meadow:registry:columns";
	let columnVisibility = $state<Record<string, boolean>>({ ...defaultHidden });
	let columnOrder = $state<string[]>([...columnIds]);
	function loadColumns() {
		try {
			const saved: unknown = JSON.parse(localStorage.getItem(COLUMNS_STORAGE_KEY) ?? "{}");
			if (typeof saved !== "object" || saved === null) return;
			const { visibility, order } = saved as { visibility?: unknown; order?: unknown };
			if (typeof visibility === "object" && visibility !== null)
				for (const id of movableIds) {
					const value = (visibility as Record<string, unknown>)[id];
					if (typeof value === "boolean") columnVisibility[id] = value;
				}
			if (Array.isArray(order)) {
				const known = order.filter((id): id is ColumnId => movableIds.includes(id));
				columnOrder = ["name", ...new Set([...known, ...movableIds])];
			}
		} catch {
			// Unreadable settings fall back to the defaults.
		}
	}
	function saveColumns() {
		try {
			localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify({ visibility: columnVisibility, order: columnOrder }));
		} catch {
			// Storage unavailable; the layout resets on reload.
		}
	}
	function setColumnVisible(id: string, visible: boolean) {
		columnVisibility = { ...columnVisibility, [id]: visible };
		saveColumns();
	}
	function moveColumn(id: string, offset: -1 | 1) {
		const visible = visibleColumns.map((column) => column.id).filter((item) => item !== "name");
		const sibling = visible[visible.indexOf(id) + offset];
		if (!sibling) return;
		const order = [...columnOrder];
		const from = order.indexOf(id);
		const to = order.indexOf(sibling);
		[order[from], order[to]] = [order[to]!, order[from]!];
		columnOrder = order;
		saveColumns();
	}
	function resetColumns() {
		columnVisibility = { ...defaultHidden };
		columnOrder = [...columnIds];
		saveColumns();
	}

	// --- URL state -----------------------------------------------------------
	// Filters and sorting are shallow navigations: the URL and history change without rerunning loads, resetting scroll, or animating the shell. The shallow URL is the current one until a full navigation clears it.
	let url = $derived(page.shallow?.url ?? page.url);
	// Normalize before sending to the server so malformed URL values fall back to defaults instead of reaching the validator.
	const sortIds: SortId[] = ["name", "address", "leadSource", "tags", "opportunities", "referredBy", "created"];
	const idPattern = /^[a-zA-Z0-9_-]{1,120}$/;
	function readParams() {
		const sp = url.searchParams;
		const sortRaw = sp.get("sort");
		const tagMode = sp.get("tagMode");
		return {
			q: (sp.get("q") ?? "").slice(0, 200),
			archived: sp.get("archived") === "true",
			tags: [...new Set(sp.getAll("tag").filter((tag) => idPattern.test(tag)))].slice(0, 50),
			tagMode: (tagMode === "all" || tagMode === "none" ? tagMode : "any") as "any" | "all" | "none",
			leadSources: [...new Set(sp.getAll("source").map((source) => source.slice(0, 200)))].slice(0, 50),
			leadSourceMode: sp.get("sourceMode") === "not" ? ("not" as const) : ("is" as const),
			// Chips keep the order they were added in, which is their order in the URL.
			builder: [...new Set(sp.keys())].flatMap((key) => {
				const field = builderFields.find((item) => item.field === key)?.field;
				const filter = field ? parseFilter(field, sp.get(field)) : null;
				return filter ? [filter] : [];
			}),
			sort: sortIds.includes(sortRaw as SortId) ? (sortRaw as SortId) : "name",
			sortDir: sp.get("sortDir") === "desc" ? ("desc" as const) : ("asc" as const),
		};
	}
	let params = $derived(readParams());
	let filters = $derived({
		archived: params.archived,
		q: params.q,
		tags: params.tags,
		tagMode: params.tagMode,
		leadSources: params.leadSources,
		leadSourceMode: params.leadSourceMode,
		...Object.fromEntries(params.builder.flatMap((filter) => (serverFilter(filter) ? [[filter.field, serverFilter(filter)]] : []))),
	});
	let filtered = $derived(!!params.q || params.tags.length > 0 || params.leadSources.length > 0 || params.builder.length > 0);
	let filterKey = $derived(JSON.stringify(filters));

	function updateUrl(updater: (sp: URLSearchParams) => void, history: "push" | "replace" = "replace") {
		const next = new URL(url.href);
		updater(next.searchParams);
		if (next.href !== url.href) goto(next, { shallow: true, replace: history === "replace", state: page.state });
	}
	const setList = (sp: URLSearchParams, key: string, values: string[]) => {
		sp.delete(key);
		for (const value of values) sp.append(key, value);
	};
	function setSearch(next: string) {
		updateUrl((sp) => {
			if (next.trim()) sp.set("q", next.trim().slice(0, 200));
			else sp.delete("q");
		});
	}
	function setSort(id: SortId, dir?: "asc" | "desc") {
		const next = dir ?? (params.sort === id && params.sortDir === "asc" ? "desc" : "asc");
		updateUrl((sp) => {
			if (id === "name" && next === "asc") sp.delete("sort");
			else sp.set("sort", id);
			if (next === "asc") sp.delete("sortDir");
			else sp.set("sortDir", next);
		});
	}
	function setTags(values: string[]) {
		updateUrl((sp) => {
			setList(sp, "tag", values);
			if (!values.length) sp.delete("tagMode");
		}, "push");
	}
	function setTagMode(mode: string) {
		updateUrl((sp) => (mode === "any" ? sp.delete("tagMode") : sp.set("tagMode", mode)));
	}
	function setLeadSources(values: string[]) {
		updateUrl((sp) => {
			setList(sp, "source", values);
			if (!values.length) sp.delete("sourceMode");
		}, "push");
	}
	function setLeadSourceMode(mode: string) {
		updateUrl((sp) => (mode === "is" ? sp.delete("sourceMode") : sp.set("sourceMode", mode)));
	}
	let addedFilter = $state<BuilderField | null>(null);
	function addFilter(field: BuilderField) {
		addedFilter = field;
		updateUrl((sp) => sp.set(field, serializeFilter(newFilter(field))), "push");
	}
	function setFilter(filter: BuilderFilter) {
		updateUrl((sp) => sp.set(filter.field, serializeFilter(filter)));
	}
	function removeFilter(field: BuilderField) {
		if (addedFilter === field) addedFilter = null;
		updateUrl((sp) => sp.delete(field), "push");
	}
	function toggleArchived() {
		updateUrl((sp) => (params.archived ? sp.delete("archived") : sp.set("archived", "true")), "push");
	}
	function clearFilters() {
		updateUrl((sp) => {
			for (const key of ["q", "tag", "tagMode", "source", "sourceMode", ...builderFields.map((item) => item.field)]) sp.delete(key);
		}, "push");
	}

	// --- Data ----------------------------------------------------------------
	// Rows load 50 at a time as the list scrolls; each page is its own cached query, so loading more never refetches the earlier pages.
	const PAGE_SIZE = 50;
	let queryKey = $derived(`${filterKey}|${params.sort}|${params.sortDir}`);
	let lastScrollKey = "";
	afterNavigate(() => {
		if (lastScrollKey !== queryKey) {
			tableBox?.scrollTo({ top: 0, behavior: "instant" });
			document.getElementById("workspace-main")?.scrollTo({ top: 0, behavior: "instant" });
			anchor = null;
			lastScrollKey = queryKey;
		}
	});
	let loaded = $state({ key: "", pages: 1 });
	let pageCount = $derived(loaded.key === queryKey ? loaded.pages : 1);

	// Start every request before awaiting any, so they load in parallel.
	let remote = $derived(getWorkspace({ archived: params.archived }));
	let pageQueries = $derived(Array.from({ length: pageCount }, (_, index) => getClients({ ...filters, sort: params.sort, sortDir: params.sortDir, page: index + 1, pageSize: PAGE_SIZE })));
	let facetsQuery = $derived(getClientFacets(filters));
	// One await for all three, so a page that resolves first is not left waiting on the others.
	let [workspace, pages, facets] = $derived(await Promise.all([remote, Promise.all(pageQueries), facetsQuery]));

	let clients = $derived([...new Map(pages.flatMap((result) => result.clients).map((row) => [row.id, row])).values()]);
	let total = $derived(pages[0]?.total ?? 0);
	let loadingMore = $derived(pages.length < pageCount);
	let hasMore = $derived(clients.length < total && (pages.at(-1)?.clients.length ?? 0) === PAGE_SIZE);
	// Dim the rows only while a new filter or sort loads, not while more rows arrive at the bottom.
	let refreshing = $derived($effect.pending() > 0 && !loadingMore);

	function loadMore() {
		if (!hasMore || loadingMore) return;
		loaded = { key: queryKey, pages: pageCount + 1 };
	}
	/** Loads the next page when the end of the list comes within reach of `root`'s visible area. */
	function loadMoreNear(root: () => Element | null) {
		return (node: HTMLElement) => {
			// Observe again whenever rows arrive, so a short page that leaves the end in view keeps loading.
			void clients.length;
			void hasMore;
			const observer = new IntersectionObserver(
				(entries) => {
					if (node.getClientRects().length && entries.some((entry) => entry.isIntersecting)) loadMore();
				},
				{ root: root(), rootMargin: "0px 0px 480px 0px" },
			);
			observer.observe(node);
			return () => observer.disconnect();
		};
	}

	const tagsById = $derived(new Map(workspace.tags.map((tag) => [tag.id, tag])));
	const tagsByName = $derived(new Map(workspace.tags.map((tag) => [tag.name, tag])));
	const tagOptions = $derived(
		workspace.tags
			.filter((tag) => !tag.retiredAt || params.tags.includes(tag.id))
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((tag) => ({ value: tag.id, label: tag.name, color: tag.color })),
	);
	const leadSourceOptions = $derived([...[...new Set([...leadSources, ...Object.keys(facets.leadSources).filter(Boolean), ...params.leadSources.filter(Boolean)])].sort((a, b) => a.localeCompare(b)).map((source) => ({ value: source, label: source })), { value: "", label: "No lead source" }]);
	const availableFields = $derived(builderFields.filter((item) => !params.builder.some((filter) => filter.field === item.field)));

	// --- TanStack Table, server-backed --------------------------------------
	// Data is the loaded rows: the server filters and sorts, and the table tracks sorting for the header indicators plus column visibility and order.
	const table = createTable({
		features: tableFeatures({ columnOrderingFeature, columnVisibilityFeature, rowSortingFeature }),
		columns,
		get data() {
			return clients;
		},
		getRowId: (row: ClientRow) => row.id,
		state: {
			get sorting() {
				return [{ id: params.sort, desc: params.sortDir === "desc" }];
			},
			get columnVisibility() {
				return columnVisibility;
			},
			get columnOrder() {
				return columnOrder;
			},
		},
	});
	let rows = $derived(table.getRowModel().rows);
	let visibleColumns = $derived(table.getVisibleLeafColumns());
	let orderedColumns = $derived(columnOrder.filter((id): id is ColumnId => id !== "name" && id in columnMeta));

	// --- Selection -----------------------------------------------------------
	// A selection belongs to one set of filters: changing them starts over, so a bulk action only ever touches clients the current view matches.
	let selection = $state.raw<{ key: string; ids: string[] }>({ key: "", ids: [] });
	let selected = $derived(new Set(selection.key === queryKey ? selection.ids : []));
	let anchor: number | null = null;
	function editSelection(change: (ids: Set<string>) => void) {
		const ids = new Set(selection.key === queryKey ? selection.ids : []);
		change(ids);
		selection = { key: queryKey, ids: [...ids] };
	}
	let allLoadedSelected = $derived(clients.length > 0 && clients.every((row) => selected.has(row.id)));
	function toggleRow(index: number, event: MouseEvent) {
		const id = clients[index]!.id;
		const on = !selected.has(id);
		// Shift-click selects or clears everything between the last clicked row and this one.
		const range = event.shiftKey && anchor !== null ? clients.slice(Math.min(anchor, index), Math.max(anchor, index) + 1) : [clients[index]!];
		editSelection((ids) => {
			for (const row of range) {
				if (!on) ids.delete(row.id);
				else if (ids.size < 2000) ids.add(row.id);
			}
		});
		anchor = index;
	}
	function toggleAllLoaded() {
		const on = !allLoadedSelected;
		editSelection((ids) => {
			for (const row of clients) {
				if (!on) ids.delete(row.id);
				else if (ids.size < 2000) ids.add(row.id);
			}
		});
	}
	let selectingAll = $state(false);
	async function selectAllMatching() {
		selectingAll = true;
		const key = queryKey;
		try {
			const { ids } = await getClientIds(filters);
			if (key !== queryKey) return;
			editSelection((set) => {
				for (const id of ids) set.add(id);
			});
		} catch {
			showNotice({ text: "Could not select matching clients. Try again.", skipped: [], error: true });
		} finally {
			selectingAll = false;
		}
	}
	const clearSelection = () => editSelection((ids) => ids.clear());

	// --- Bulk actions --------------------------------------------------------
	type BulkAction = { kind: "addTag" | "removeTag"; tagId: string } | { kind: "archive" | "restore" };
	type BulkResult = { changed: string[]; skipped: { id: string; name: string; reason: string }[] };
	let bulkPending = $state(false);
	let bulkTagMode = $state<"add" | "remove">("add");
	let notice = $state<{ text: string; skipped: BulkResult["skipped"]; undo?: { action: BulkAction; ids: string[]; requestId: string }; error?: boolean } | null>(null);
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	let tagMenu = $state<HTMLElement>();

	const plural = (count: number) => `${count} ${count === 1 ? "client" : "clients"}`;
	function describe(action: BulkAction, count: number) {
		const tag = "tagId" in action ? `“${tagsById.get(action.tagId)?.name ?? "tag"}”` : "";
		return {
			addTag: `Added ${tag} to ${plural(count)}`,
			removeTag: `Removed ${tag} from ${plural(count)}`,
			archive: `Archived ${plural(count)}`,
			restore: `Restored ${plural(count)}`,
		}[action.kind];
	}
	const inverse = (action: BulkAction): BulkAction => (action.kind === "addTag" ? { kind: "removeTag", tagId: action.tagId } : action.kind === "removeTag" ? { kind: "addTag", tagId: action.tagId } : { kind: action.kind === "archive" ? "restore" : "archive" });
	function showNotice(next: NonNullable<typeof notice>) {
		clearTimeout(noticeTimer);
		notice = next;
		noticeTimer = setTimeout(() => (notice = null), 12000);
	}
	async function runBulk(action: BulkAction, ids: string[], undoOf?: string) {
		if (!ids.length || bulkPending) return;
		bulkPending = true;
		tagMenu?.hidePopover();
		try {
			const requestId = crypto.randomUUID();
			const result = (await bulkUpdateClients({ requestId, clientIds: ids, action, undoOf }).updates(getClients, getClientFacets, remote)) as BulkResult;
			loaded = { key: queryKey, pages: 1 };
			tableBox?.scrollTo({ top: 0, behavior: "instant" });
			// Archived or restored clients leave this view, so they leave the selection too.
			if (action.kind === "archive" || action.kind === "restore") editSelection((set) => result.changed.forEach((id) => set.delete(id)));
			const done = result.changed.length ? describe(action, result.changed.length) : "Nothing changed";
			showNotice({
				text: undoOf ? `Undo: ${done}.` : `${done}.`,
				skipped: result.skipped,
				undo: !undoOf && result.changed.length ? { action: inverse(action), ids: result.changed, requestId } : undefined,
			});
		} catch {
			showNotice({ text: "Could not confirm this change. Refresh and review the clients before retrying.", skipped: [], error: true });
		} finally {
			bulkPending = false;
		}
	}

	// --- Presentation --------------------------------------------------------
	/** People to show under the client's name: everyone unless the client is exactly one person of the same name. */
	function otherPeople(row: ClientRow) {
		return row.peopleNames.length === 1 && row.peopleNames[0] === row.name ? "" : row.peopleNames.join(" · ");
	}
	const channelIcons = { call: Phone, text: MessageSquare, email: Mail, mail: MailOpen } satisfies Record<Channel, unknown>;
	const dateFormat = $derived(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: workspace.settings?.timezone ?? "America/Los_Angeles" }));
	let scrolledX = $state(false);
	let tableBox = $state<HTMLElement>();
	let columnMenu = $state<ReturnType<typeof ContextMenu>>();
	let menuColumn = $state<ColumnId>("name");
	const tableFade = overflowFade({ axis: "both", sides: "end", fadePercent: 6 });
	// Rows tint through --row-bg in opaque colours, since cells sit at fractional widths: each cell paints the tint and spills it one pixel right, so no light seam shows between cells and the sticky client cell hides the columns scrolling beneath it.
	const cell = "border-hairline border-b bg-(--row-bg) px-4 py-2.5 align-middle shadow-[1px_0_0_var(--row-bg)] transition-colors duration-120 group-last/row:border-b-0 motion-reduce:transition-none";
	const stickyName = $derived(["sticky left-0 pl-4", scrolledX && "shadow-[inset_-1px_0_0_var(--color-hairline),1px_0_0_var(--row-bg)]!"]);

	// A click anywhere on a row opens the client, except on its own controls, while selecting text, or beside the checkbox, where it toggles the checkbox instead.
	function openRow(event: MouseEvent, index: number) {
		const target = event.target as HTMLElement;
		if (target.closest("a, button, input, label") || getSelection()?.toString()) return;
		if (target.closest("[data-select-zone]")) toggleRow(index, event);
		else {
			// Return focus to the row's keyboard control instead of the workspace scroll surface.
			(event.currentTarget as HTMLTableRowElement).querySelector<HTMLButtonElement>("button.item-title")?.focus({ preventScroll: true });
			editClient(clients[index]!.id);
		}
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
		loadColumns();
		ready = true;
		const main = document.getElementById("workspace-main");
		const loadNearMobileEnd = () => {
			const sentinel = main?.querySelector<HTMLElement>("[data-mobile-sentinel]");
			if (sentinel?.getClientRects().length && sentinel.getBoundingClientRect().top < main!.getBoundingClientRect().bottom + 480) loadMore();
		};
		main?.addEventListener("scroll", loadNearMobileEnd, { passive: true });
		return () => {
			main?.removeEventListener("scroll", loadNearMobileEnd);
			clearTimeout(noticeTimer);
		};
	});
	// Svelte may not remount the page when only ?client changes, so open the panel whenever the requested client differs from the last one handled.
	$effect(() => {
		const clientIdFromUrl = url.searchParams.get("client");
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
	<span class="text-muted/50" aria-hidden="true">—</span><span class="sr-only">None</span>
{/snippet}

{#snippet consentIcons(consent: ClientRow["consent"])}
	{#if channels.every((channel) => !consent[channel])}
		<span class="chip whitespace-nowrap" data-tone="urgent"><Ban size={12} aria-hidden="true" />Do not contact</span>
	{:else if channels.every((channel) => consent[channel])}
		<span class="text-muted">All</span>
	{:else}
		<span
			class="flex items-center gap-1.5"
			aria-label={`Allows ${channels
				.filter((channel) => consent[channel])
				.map((channel) => channelLabels[channel].toLowerCase())
				.join(", ")}`}
			role="img">
			{#each channels as channel (channel)}
				{@const Icon = channelIcons[channel]}
				<span title={`${channelLabels[channel]}: ${consent[channel] ? "allowed" : "not allowed"}`} class={["relative", consent[channel] ? "text-muted" : "text-muted/30"]}>
					<Icon size={14} aria-hidden="true" />
					{#if !consent[channel]}<span class="bg-muted/50 absolute top-1/2 left-1/2 h-px w-4.5 -translate-1/2 -rotate-45 rounded-full" aria-hidden="true"></span>{/if}
				</span>
			{/each}
		</span>
	{/if}
{/snippet}

{#snippet countEditor(filter: Extract<BuilderFilter, { field: "opportunities" | "allOpportunities" }>, close: () => void)}
	{@const set = (key: "a" | "b", value: string) => setFilter({ ...filter, [key]: value === "" ? null : Math.max(0, Math.min(1000, Math.floor(Number(value)))) })}
	<form
		class="flex items-center gap-2"
		onsubmit={(event) => {
			event.preventDefault();
			close();
		}}>
		<label class="sr-only" for={`${filter.field}-a`}>{filter.op === "between" ? "From" : "Count"}</label>
		<input id={`${filter.field}-a`} class="field min-h-9 w-20 tabular-nums" type="number" min="0" max="1000" inputmode="numeric" value={filter.a ?? ""} oninput={(event) => set("a", event.currentTarget.value)} />
		{#if filter.op === "between"}
			<span class="text-muted">and</span>
			<label class="sr-only" for={`${filter.field}-b`}>To</label>
			<input id={`${filter.field}-b`} class="field min-h-9 w-20 tabular-nums" type="number" min="0" max="1000" inputmode="numeric" value={filter.b ?? ""} oninput={(event) => set("b", event.currentTarget.value)} />
		{/if}
		<button class="control" data-size="sm" data-variant="ghost" data-icon aria-label="Done"><Check size={16} aria-hidden="true" /></button>
	</form>
	<p class="text-muted mt-2 text-xs">{builderField(filter.field).hint}.</p>
{/snippet}

{#snippet consentEditor(filter: Extract<BuilderFilter, { field: "consent" }>)}
	<div class="-m-1.5 w-52" role="group" aria-label="Channels">
		{#each channels as channel (channel)}
			{@const Icon = channelIcons[channel]}
			<label class="menu-item has-[:focus-visible]:bg-highlight cursor-pointer gap-3 font-normal">
				<input type="checkbox" class="check" data-shape="box" checked={filter.channels.includes(channel)} onchange={(event) => setFilter({ ...filter, channels: channels.filter((item) => (item === channel ? event.currentTarget.checked : filter.channels.includes(item))) })} />
				<Icon size={15} class="text-muted" aria-hidden="true" />{channelLabels[channel]}
			</label>
		{/each}
	</div>
{/snippet}

{#snippet referredEditor(filter: Extract<BuilderFilter, { field: "referredBy" }>, close: () => void)}
	<form
		class="flex w-64 items-center gap-2"
		onsubmit={(event) => {
			event.preventDefault();
			close();
		}}>
		<DebounceInput id="referred-text" label="Name contains" class="flex-1 [&_.field]:min-h-9" value={filter.text} debounce={250} placeholder="Name" onChange={(text) => setFilter({ ...filter, text })} />
	</form>
{/snippet}

{#snippet createdEditor(filter: Extract<BuilderFilter, { field: "created" }>, close: () => void)}
	<form
		class="flex flex-wrap items-center gap-2"
		onsubmit={(event) => {
			event.preventDefault();
			close();
		}}>
		<label class="sr-only" for="created-a">{filter.op === "between" ? "From" : "Date"}</label>
		<input id="created-a" class="field min-h-9 w-auto" type="date" value={filter.a} onchange={(event) => setFilter({ ...filter, a: event.currentTarget.value })} />
		{#if filter.op === "between"}
			<span class="text-muted">and</span>
			<label class="sr-only" for="created-b">To</label>
			<input id="created-b" class="field min-h-9 w-auto" type="date" value={filter.b} onchange={(event) => setFilter({ ...filter, b: event.currentTarget.value })} />
		{/if}
		<button class="control" data-size="sm" data-variant="ghost" data-icon aria-label="Done"><Check size={16} aria-hidden="true" /></button>
	</form>
{/snippet}

<div class="@container/registry flex flex-col" data-fill>
	<div class="surface-content relative flex flex-col @min-[48rem]/registry:min-h-0 @min-[48rem]/registry:flex-1" data-tight>
		<div class="flex flex-wrap items-center gap-2">
			<DebounceInput id="registry-search" label="Search clients" class="grow basis-56 @min-[40rem]/registry:max-w-sm" value={params.q} onChange={setSearch} debounce={200} placeholder="Search clients" />
			<div class="ml-auto flex shrink-0 items-center gap-2">
				<button type="button" class="control @max-[48rem]/registry:hidden" data-icon popovertarget="registry-columns" style:anchor-name="--registry-columns" aria-label="Columns" title="Columns"><Columns3Cog size={18} aria-hidden="true" /></button>
				<div id="registry-columns" popover="auto" role="group" aria-label="Columns" class="surface surface-floating menu w-64" style:position-anchor="--registry-columns">
					<p class="text-muted px-2.5 pt-1 pb-1.5 text-xs leading-none font-medium">Show columns</p>
					{#each orderedColumns as id (id)}
						<label class="menu-item has-[:focus-visible]:bg-highlight cursor-pointer gap-3 font-normal">
							<input class="check" data-shape="box" type="checkbox" checked={columnVisibility[id] !== false} onchange={(event) => setColumnVisible(id, event.currentTarget.checked)} />
							{columnMeta[id].header}
						</label>
					{/each}
					<div class="border-hairline mt-1.5 border-t pt-1.5">
						<button type="button" class="menu-item text-muted" onclick={resetColumns}>Reset columns</button>
						<p class="text-muted px-2.5 pt-1 pb-1.5 text-xs text-pretty">Right-click a column heading to sort, move, or hide it.</p>
					</div>
				</div>
				<button type="button" class="control" data-reveal aria-pressed={params.archived} aria-label="Archived clients" disabled={!ready} onclick={toggleArchived}><Archive size={16} aria-hidden="true" /><span class="control-label" aria-hidden="true"><span><span>Archived</span></span></span></button>
				<button type="button" class="control" data-variant="primary" disabled={!ready} onclick={newClient}><Plus size={16} aria-hidden="true" /><span class="@max-[30rem]/registry:sr-only">New client</span></button>
			</div>
		</div>

		<div role="group" aria-label="Filter clients" class="mt-3 flex flex-wrap items-center gap-2">
			<Select
				class="max-w-full @min-[48rem]/registry:hidden"
				label="Sort clients"
				appearance="pill"
				value={`${params.sort}:${params.sortDir}`}
				options={sortIds.flatMap((id) => (["asc", "desc"] as const).map((dir, index) => ({ value: `${id}:${dir}`, label: `${columnMeta[id].header}: ${columnMeta[id].sort?.[index]}` })))}
				onchange={(value) => {
					const [id, dir] = value.split(":");
					setSort(id as SortId, dir as "asc" | "desc");
				}} />
			<FacetedFilter
				title="Tags"
				options={tagOptions}
				selected={params.tags}
				counts={facets.tags}
				modes={[
					{ value: "any", label: "Any of", summary: "any of" },
					{ value: "all", label: "All of", summary: "all of" },
					{ value: "none", label: "None of", summary: "none of" },
				]}
				mode={params.tagMode}
				onChange={setTags}
				onModeChange={setTagMode}
				disabled={!ready} />
			<FacetedFilter
				title="Lead source"
				options={leadSourceOptions}
				selected={params.leadSources}
				counts={facets.leadSources}
				modes={[
					{ value: "is", label: "Is", summary: "is" },
					{ value: "not", label: "Is not", summary: "not" },
				]}
				mode={params.leadSourceMode}
				onChange={setLeadSources}
				onModeChange={setLeadSourceMode}
				disabled={!ready} />
			{#each params.builder as filter (filter.field)}
				{@const definition = builderField(filter.field)}
				<FilterChip
					label={definition.short}
					icon={definition.icon}
					operators={definition.operators}
					operator={filter.op}
					summary={filterSummary(filter)}
					autofocus={addedFilter === filter.field && needsValue(filter)}
					onOperatorChange={(op) => setFilter({ ...filter, op } as BuilderFilter)}
					onRemove={() => removeFilter(filter.field)}
					editor={needsValue(filter) ? valueEditor : undefined} />
				{#snippet valueEditor(close: () => void)}
					{#if filter.field === "opportunities" || filter.field === "allOpportunities"}{@render countEditor(filter, close)}
					{:else if filter.field === "consent"}{@render consentEditor(filter)}
					{:else if filter.field === "referredBy"}{@render referredEditor(filter, close)}
					{:else if filter.field === "created"}{@render createdEditor(filter, close)}{/if}
				{/snippet}
			{/each}
			{#if availableFields.length}
				<button type="button" class="control text-muted gap-1.5" data-size="sm" data-variant="ghost" popovertarget="registry-add-filter" style:anchor-name="--registry-add-filter" aria-haspopup="menu" disabled={!ready}><ListFilter size={15} aria-hidden="true" />Filter</button>
				<div
					id="registry-add-filter"
					popover="auto"
					role="menu"
					tabindex="-1"
					aria-label="Add a filter"
					class="surface surface-floating menu w-72 [position-area:block-end_span-inline-end]"
					style:position-anchor="--registry-add-filter"
					ontoggle={(event) => {
						if (event.newState === "open") event.currentTarget.querySelector<HTMLElement>("[role=menuitem]")?.focus();
					}}
					onkeydown={(event) => {
						const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")];
						const index = items.indexOf(document.activeElement as HTMLElement);
						const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[event.key];
						if (next === undefined) return;
						event.preventDefault();
						items[(next + items.length) % items.length]?.focus();
					}}>
					{#each availableFields as item (item.field)}
						<button
							type="button"
							role="menuitem"
							class="menu-item items-start gap-3"
							onclick={(event) => {
								(event.currentTarget.closest("[popover]") as HTMLElement).hidePopover();
								addFilter(item.field);
							}}>
							<item.icon size={16} class="text-muted mt-0.5 shrink-0" aria-hidden="true" />
							<span class="min-w-0"><span class="block">{item.label}</span><span class="text-muted block text-xs font-normal">{item.hint}</span></span>
						</button>
					{/each}
				</div>
			{/if}
			{#if filtered}
				<button type="button" class="text-action ml-1" onclick={clearFilters}><X size={14} aria-hidden="true" />Clear all</button>
			{/if}
		</div>

		{#if params.archived}
			<p class="bg-tour-soft text-tour mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-2.5 text-sm [--action-color:var(--color-tour)]">
				<Archive size={15} class="shrink-0" aria-hidden="true" />
				<span class="min-w-0 flex-1">Showing archived clients. Select clients to restore them.</span>
				<button type="button" class="text-action" onclick={toggleArchived}>Back to current clients</button>
			</p>
		{/if}

		<div class={["mt-5 flex min-h-0 flex-col transition-opacity duration-150 motion-reduce:transition-none @min-[48rem]/registry:flex-1", refreshing && "opacity-60"]} aria-busy={refreshing}>
			{#if rows.length === 0}
				<EmptyState
					class="@min-[48rem]/registry:flex-1"
					title={filtered ? "No clients match" : params.archived ? "No archived clients" : "No clients yet"}
					description={filtered ? (params.q ? `Nothing matches “${params.q}” with these filters.` : "Try removing a filter.") : params.archived ? "Archived clients appear here." : "Add the first client to get started."}>
					{#snippet icon()}<ContactRound size={20} strokeWidth={1.4} />{/snippet}
					{#snippet actions()}
						{#if filtered}<button type="button" class="control" onclick={clearFilters}>Clear filters</button>
						{:else if !params.archived}<button type="button" class="control" data-variant="primary" disabled={!ready} onclick={newClient}><Plus size={16} aria-hidden="true" />New client</button>{/if}
					{/snippet}
				</EmptyState>
			{:else}
				<div class="surface relative flex min-h-0 flex-col overflow-clip @min-[48rem]/registry:flex-1">
					<!-- Wide workspaces get the dense, sortable table, scrolling inside the surface so its heading stays in view. -->
					<div
						bind:this={tableBox}
						class="hidden min-h-0 flex-1 overflow-auto overscroll-contain @min-[48rem]/registry:block"
						onscroll={(event) => {
							const box = event.currentTarget;
							scrolledX = box.scrollLeft > 0;
							if (box.scrollHeight - box.scrollTop - box.clientHeight < 480) loadMore();
						}}
						{@attach tableFade}>
						<table class="w-full border-separate border-spacing-0 text-left text-sm [--row-hover:color-mix(in_oklch,var(--theme-accent)_calc(var(--theme-selection)*0.33),var(--color-white))]">
							<thead class="group/head">
								<tr class="[--row-bg:var(--color-white)]">
									{#each visibleColumns as column (column.id)}
										{@const id = column.id as ColumnId}
										{@const meta = columnMeta[id]}
										{@const sortId = meta.sort ? (id as SortId) : null}
										{@const active = params.sort === id}
										<th
											scope="col"
											aria-sort={active ? (params.sortDir === "asc" ? "ascending" : "descending") : undefined}
											class={["border-hairline sticky top-0 z-20 h-10 border-b bg-white px-4 py-0 text-xs font-medium whitespace-nowrap last:pr-5", active ? "text-ink" : "text-muted", meta.end && "text-right", id === "name" && [stickyName, "z-30"]]}
											data-select-zone={id === "name" || undefined}
											oncontextmenu={(event) => {
												menuColumn = id;
												columnMenu?.show(event, event.currentTarget);
											}}
											onkeydown={(event) => {
												if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
												menuColumn = id;
												columnMenu?.show(event, event.currentTarget);
											}}>
											<div class="flex h-full items-center">
												{#if id === "name"}
													<input
														type="checkbox"
														class={["check mr-3 shrink-0 transition-opacity duration-120 pointer-coarse:opacity-100", selected.size || allLoadedSelected ? "opacity-100" : "opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100"]}
														data-shape="box"
														aria-label={allLoadedSelected ? "Clear selection" : "Select all loaded clients"}
														checked={allLoadedSelected}
														{@attach (node) => {
															node.indeterminate = !allLoadedSelected && clients.some((row) => selected.has(row.id));
														}}
														disabled={!ready}
														onchange={toggleAllLoaded} />
												{/if}
												{#if sortId}
													<button
														type="button"
														class={["group/sort hover:text-ink -mx-1.5 flex h-10 flex-1 cursor-pointer items-center gap-1 rounded-md px-1.5 text-left font-medium", meta.end && "flex-row-reverse"]}
														aria-label={`${meta.header}: ${meta.sort![active && params.sortDir === "asc" ? 1 : 0]}`}
														onclick={() => setSort(sortId)}>
														{meta.header}
														{#if active && params.sortDir === "asc"}<ArrowUp size={13} aria-hidden="true" />
														{:else if active}<ArrowDown size={13} aria-hidden="true" />
														{:else}<ArrowDown size={13} class="opacity-0 transition-opacity group-hover/sort:opacity-50 group-focus-visible/sort:opacity-50" aria-hidden="true" />{/if}
													</button>
												{:else}
													<button
														type="button"
														class="rounded-md py-1"
														aria-haspopup="menu"
														onclick={(event) => {
															menuColumn = id;
															columnMenu?.show(event, event.currentTarget);
														}}>{meta.header}</button>
												{/if}
											</div>
										</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each rows as row, index (row.id)}
									{@const c = row.original}
									{@const isSelected = selected.has(c.id)}
									<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -- the client name is the row's keyboard control; the row click only widens the mouse target. -->
									<tr
										class="group/row cursor-pointer [--row-bg:var(--color-white)] hover:not-data-selected:[--row-bg:var(--row-hover)] has-[:focus-visible]:not-data-selected:[--row-bg:var(--row-hover)] data-selected:[--row-bg:var(--color-selected)]"
										data-selected={isSelected || undefined}
										onclick={(event) => openRow(event, index)}>
										{#each visibleColumns as column (column.id)}
											<td class={[cell, column.id === "opportunities" && "text-right", column.id === "name" && [stickyName, "z-10 pr-6"]]}>
												{#if column.id === "name"}
													{@const others = otherPeople(c)}
													<div class="flex items-center">
														<!-- The zone around the checkbox toggles it too, so a near miss selects rather than opens the client. -->
														<span class="-my-2.5 -ml-4 flex shrink-0 cursor-default items-center self-stretch py-2.5 pr-3 pl-4" data-select-zone>
															<input
																type="checkbox"
																class={["check block transition-opacity duration-120 pointer-coarse:opacity-100", selected.size ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"]}
																data-shape="box"
																aria-label={`Select ${c.name}`}
																checked={isSelected}
																disabled={!ready}
																onclick={(event) => toggleRow(index, event)} />
														</span>
														<div class="max-w-72 min-w-44">
															<button type="button" class="item-title block max-w-full truncate text-left hover:underline hover:decoration-(--color-hairline) hover:underline-offset-4" disabled={!ready} onclick={() => editClient(c.id)}>{c.name}</button>
															{#if others}<p class="text-muted mt-0.5 truncate text-xs leading-none">{others}</p>{/if}
														</div>
													</div>
												{:else if column.id === "contact"}
													{#if c.phone || c.email}
														<div class="flex max-w-60 flex-col items-start">
															{#if c.phone}<a class="tabular-nums hover:underline" href={`tel:${c.phone}`}>{formatPhone(c.phone)}</a>{/if}
															{#if c.email}<a class="text-muted max-w-full truncate text-xs hover:underline" href={`mailto:${c.email}`}>{c.email}</a>{/if}
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
													{#if c.tagNames.length}
														<!-- Two chips keep every row one line tall; the rest are counted and named in the tooltip. -->
														<div class="flex items-center gap-1 whitespace-nowrap" title={c.tagNames.length > 2 ? c.tagNames.join(", ") : undefined}>
															{@render tagChips(c.tagNames.slice(0, 2))}
															{#if c.tagNames.length > 2}<span class="text-muted text-xs">+{c.tagNames.length - 2}</span>{/if}
														</div>
													{:else}{@render empty()}{/if}
												{:else if column.id === "opportunities"}
													{@const archivedCount = c.allOpportunityCount - c.opportunityCount}
													{#if c.allOpportunityCount}
														<span class="inline-flex items-baseline gap-1.5 tabular-nums" title={archivedCount ? `${c.opportunityCount} current, ${archivedCount} archived` : undefined}>
															{#if archivedCount}<span class="text-muted text-xs">+{archivedCount} archived</span>{/if}
															{#if c.opportunityCount}{c.opportunityCount}{:else}<span class="text-muted">0</span>{/if}
														</span>
													{:else}{@render empty()}{/if}
												{:else if column.id === "consent"}
													{@render consentIcons(c.consent)}
												{:else if column.id === "referredBy"}
													{#if c.referredBy?.clientId}<a class="whitespace-nowrap hover:underline" href={`/registry?client=${encodeURIComponent(c.referredBy.clientId)}`}>{c.referredBy.name}</a>
													{:else if c.referredBy}<span class="whitespace-nowrap">{c.referredBy.name}</span>
													{:else}{@render empty()}{/if}
												{:else if column.id === "created"}
													<time class="text-muted whitespace-nowrap tabular-nums" datetime={c.createdAt}>{dateFormat.format(new Date(c.createdAt))}</time>
												{/if}
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
						{#if hasMore}
							<div class="text-muted flex h-14 items-center justify-center gap-2 text-sm" {@attach loadMoreNear(() => tableBox ?? null)}>
								<button type="button" class="text-action" disabled={loadingMore} onclick={loadMore}
									>{#if loadingMore}<LoaderCircle size={15} class="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading…{:else}Load more clients{/if}</button>
							</div>
						{/if}
					</div>

					<!-- Narrow workspaces get a stacked list with the same rows, scrolling with the page. -->
					<ul class="divide-hairline divide-y @min-[48rem]/registry:hidden">
						<li class="flex items-center gap-3 px-4 py-3">
							<input type="checkbox" class="check" data-shape="box" aria-label="Select all loaded clients" checked={allLoadedSelected} onchange={toggleAllLoaded} />
							<span class="text-muted text-xs">Select loaded clients</span>
						</li>
						{#each rows as row, index (row.id)}
							{@const c = row.original}
							{@const others = otherPeople(c)}
							<li class="hover:bg-highlight has-[:focus-visible]:bg-highlight data-selected:bg-selected relative px-4 py-3 transition-colors duration-120" data-selected={selected.has(c.id) || undefined}>
								<div class="flex items-start gap-3">
									<input type="checkbox" class="check relative z-1 mt-1 shrink-0" data-shape="box" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onclick={(event) => toggleRow(index, event)} />
									<div class="min-w-0 flex-1">
										<button type="button" class="item-title block max-w-full truncate text-left after:absolute after:inset-0" disabled={!ready} onclick={() => editClient(c.id)}>{c.name}</button>
										{#if others}<p class="text-muted mt-0.5 truncate text-xs leading-none">{others}</p>{/if}
										{#if c.phone || c.email}
											<p class="text-muted mt-1 flex min-w-0 items-baseline gap-x-3 text-xs">
												{#if c.phone}<a class="relative z-1 shrink-0 tabular-nums" href={`tel:${c.phone}`}>{formatPhone(c.phone)}</a>{/if}
												{#if c.email}<a class="relative z-1 truncate" href={`mailto:${c.email}`}>{c.email}</a>{/if}
											</p>
										{/if}
									</div>
									{#if c.tagNames.length}<div class="flex max-w-28 shrink-0 flex-wrap justify-end gap-1">
											{@render tagChips(c.tagNames.slice(0, 2))}{#if c.tagNames.length > 2}<span class="text-muted text-xs">+{c.tagNames.length - 2}</span>{/if}
										</div>{/if}
								</div>
							</li>
						{/each}
						{#if hasMore}
							<li data-mobile-sentinel class="text-muted flex h-14 items-center justify-center gap-2 text-sm" {@attach loadMoreNear(() => document.getElementById("workspace-main"))}>
								<button type="button" class="text-action" disabled={loadingMore} onclick={loadMore}
									>{#if loadingMore}<LoaderCircle size={15} class="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading…{:else}Load more clients{/if}</button>
							</li>
						{/if}
					</ul>

					<div class="border-hairline text-muted flex min-h-10 shrink-0 items-center gap-3 border-t px-5 text-xs">
						<p class="leading-none tabular-nums" role="status">{hasMore ? `${clients.length} of ${plural(total)}` : plural(total)}</p>
					</div>
				</div>
			{/if}
		</div>
		<div class="pointer-events-none sticky inset-x-3 bottom-3 z-40 flex flex-col items-center gap-2 @min-[48rem]/registry:absolute @min-[48rem]/registry:bottom-13">
			{#if notice}
				<div class="toast pointer-events-auto max-w-full" role="status" data-tone={notice.error ? "urgent" : undefined}>
					<span class="min-w-0">{notice.text}</span>
					{#if notice.skipped.length}
						<button type="button" class="control" data-size="sm" popovertarget="registry-skipped" style:anchor-name="--registry-skipped">{notice.skipped.length} skipped</button>
						<div id="registry-skipped" popover="auto" class="surface surface-floating menu w-80 p-3 [position-area:block-start]" style:position-anchor="--registry-skipped">
							<p class="text-muted mb-2 text-xs leading-none font-medium">Skipped, with the reason</p>
							<ul class="max-h-64 space-y-1.5 overflow-y-auto overscroll-contain" {@attach overflowFade({ axis: "y" })}>
								{#each notice.skipped as item (item.id)}
									<li class="flex items-baseline justify-between gap-3"><span class="truncate font-medium">{item.name}</span><span class="text-muted shrink-0 text-xs">{item.reason}</span></li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if notice.undo}
						{@const undo = notice.undo}
						<button type="button" class="control" data-size="sm" disabled={bulkPending} onclick={() => runBulk(undo.action, undo.ids, undo.requestId)}><Undo2 size={15} aria-hidden="true" />Undo</button>
					{/if}
					<button type="button" class="control" data-size="sm" data-icon aria-label="Dismiss" onclick={() => (notice = null)}><X size={15} aria-hidden="true" /></button>
				</div>
			{/if}
			{#if selected.size}
				<BulkActionsBar label="Selected clients" onClear={clearSelection}>
					{#snippet summary()}
						<span class="tabular-nums">{selected.size} selected</span>
						{#if total > 2000}<span class="text-muted text-xs">2,000 per change</span>{/if}
						{#if selected.size < Math.min(total, 2000)}
							<button type="button" class="text-action" disabled={selectingAll || bulkPending} onclick={selectAllMatching}>{selectingAll ? "Selecting…" : total > 2000 ? "Select first 2,000 matches" : `Select all ${total}`}</button>
						{/if}
					{/snippet}
					<button type="button" class="control" data-size="sm" data-variant="ghost" popovertarget="registry-bulk-tags" style:anchor-name="--registry-bulk-tags" disabled={bulkPending}><Tag size={15} aria-hidden="true" />Tags</button>
					<div bind:this={tagMenu} id="registry-bulk-tags" popover="auto" class="surface surface-floating menu w-64 [position-area:block-start]" style:position-anchor="--registry-bulk-tags">
						<div class="segmented mb-1" role="group" aria-label="Tag change">
							<button type="button" class="text-xs" aria-pressed={bulkTagMode === "add"} onclick={() => (bulkTagMode = "add")}>Add tag</button>
							<button type="button" class="text-xs" aria-pressed={bulkTagMode === "remove"} onclick={() => (bulkTagMode = "remove")}>Remove tag</button>
						</div>
						<div class="max-h-64 overflow-y-auto overscroll-contain" {@attach overflowFade({ axis: "y" })}>
							{#each workspace.tags.filter((tag) => bulkTagMode === "remove" || !tag.retiredAt).sort((a, b) => a.name.localeCompare(b.name)) as tag (tag.id)}
								<button type="button" class="menu-item font-normal" disabled={bulkPending} onclick={() => runBulk({ kind: bulkTagMode === "add" ? "addTag" : "removeTag", tagId: tag.id }, [...selected])}>
									<span class="size-2 shrink-0 rounded-full" style:background={tag.color} aria-hidden="true"></span>{tag.name}
								</button>
							{:else}
								<p class="text-muted px-2.5 py-3">No tags yet.</p>
							{/each}
						</div>
					</div>
					{#if params.archived}
						<button type="button" class="control" data-size="sm" data-variant="ghost" disabled={bulkPending} onclick={() => runBulk({ kind: "restore" }, [...selected])}><ArchiveRestore size={15} aria-hidden="true" />Restore</button>
					{:else}
						<button type="button" class="control" data-size="sm" data-variant="ghost" disabled={bulkPending} onclick={() => runBulk({ kind: "archive" }, [...selected])}><Archive size={15} aria-hidden="true" />Archive</button>
					{/if}
				</BulkActionsBar>
			{/if}
		</div>
	</div>
</div>

<ContextMenu bind:this={columnMenu} label={`${columnMeta[menuColumn].header} column`}>
	{@const meta = columnMeta[menuColumn]}
	{@const movable = visibleColumns.map((column) => column.id).filter((id) => id !== "name")}
	{@const position = movable.indexOf(menuColumn)}
	{#if meta.sort}
		{#each ["asc", "desc"] as const as dir, index (dir)}
			<button type="button" role="menuitemradio" aria-checked={params.sort === menuColumn && params.sortDir === dir} class="menu-item" onclick={() => setSort(menuColumn as SortId, dir)}>
				{#if dir === "asc"}<ArrowUp size={15} aria-hidden="true" />{:else}<ArrowDown size={15} aria-hidden="true" />{/if}{meta.sort[index]}
			</button>
		{/each}
	{/if}
	{#if menuColumn !== "name"}
		{#if meta.sort}<div class="bg-hairline mx-1 my-1.5 h-px" role="separator"></div>{/if}
		<button type="button" role="menuitem" class="menu-item" disabled={position <= 0} onclick={() => moveColumn(menuColumn, -1)}><ArrowLeft size={15} aria-hidden="true" />Move left</button>
		<button type="button" role="menuitem" class="menu-item" disabled={position < 0 || position >= movable.length - 1} onclick={() => moveColumn(menuColumn, 1)}><ArrowRight size={15} aria-hidden="true" />Move right</button>
		<div class="bg-hairline mx-1 my-1.5 h-px" role="separator"></div>
		<button type="button" role="menuitem" class="menu-item" onclick={() => setColumnVisible(menuColumn, false)}><EyeOff size={15} aria-hidden="true" />Hide column</button>
	{/if}
</ContextMenu>

<dialog
	bind:this={dialog}
	{@attach lightDismiss}
	closedby="any"
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
						if (await form.submit().updates(remote, getClients, getClientFacets)) {
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
				<ClientEditor bind:draft bind:pending {workspace} {remote} updates={[getClients, getClientFacets]} {fresh} saved={() => (saved = "Client saved.")}>
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
