# Registry usability / SV Table plan

## Goal

Replace the Registry's simple all-matching-rows client list with a bounded, responsive TanStack Table (v9.3.1, already installed): instant name search, tag/lead-source/opportunity-count/archived filters, sorting, pagination, page size, and column controls. Search, filters, archived toggle, sorting, page, and page size live in the URL so the view can be shared, bookmarked, and restored via Back/Forward/Reload. No client shows a tag twice. ClientEditor side-panel behavior is preserved.

## Files changed

- `docs/plans/registry-usability.md` — this plan (my ownership)
- `src/routes/registry/+page.svelte` — rewritten as TanStack Table; New client button, side panel (ClientEditor), per-client "New opportunity" link, and `?client=` open-panel behavior preserved
- `src/lib/registry/ClientEditor.svelte` — not edited
- `src/lib/registry/client-draft.ts` — not edited
- `src/lib/server/validation.ts` — added lenient `clientsQueryInput` (read-side only)
- `src/lib/server/data.ts` — added `clients(input)` method: server-side SQL filter/search/sort/count/paginate over `clients`
- `src/lib/crm.remote.ts` — added `getClients` query; refreshed in shared `save` helper

## Out of scope

- `schema.ts` (no migration changes)
- Selection/bulk tag/archive (backlog item 10), client delete (item 11), export, spreadsheet editing, reporting
- Dashboard, Pipeline, login, shell, global CSS (`layout.css`, `themes.css`, `components.css`), Settings
- New tests, commits, push, deploy, production data changes

## TanStack Table v9.3.1 compatibility decisions

`@tanstack/svelte-table@9.3.1` (https://tanstack.com/table, docs at https://tanstack.com/table/v9) has no `createServerRowModel`. Server-side behavior uses:
- `tableFeatures({ columnVisibilityFeature, rowSortingFeature })` + `createTable` (installed API, same pattern as `src/routes/glossary/+page.svelte`)
- Plain column defs with `accessorFn` (not `createColumnHelper`, which had type inference issues in v9.3.1)
- Data is one server page; `get data()` getter returns `clients.clients` reactively so the table re-renders when results arrive
- `table.getRowModel().rows` and `table.getVisibleLeafColumns()` drive the actual render — TanStack is genuinely used, not a passthrough
- `rowPaginationFeature` is NOT used; pagination is server-side (`LIMIT/OFFSET`), table renders the full page
- External state (sorting, column visibility) read through `state` getters, written to URL via `on*` callbacks, matching the glossary pattern
- Column visibility persisted to `localStorage`, not the URL (SPEC's URL list does not include it)

Source: `@tanstack/svelte-table` v9.3.1 (`node_modules/@tanstack/svelte-table/dist/index.js`, `package.json` version `9.3.1`); `@tanstack/table-core` v9 re-exported via `export * from '@tanstack/table-core'`. Key compatibility findings from inspecting the installed `dist/`:
- `createServerRowModel` does NOT exist in v9 (confirmed absent from `table-core/dist/index.d.ts` exports).
- Installed features: `columnVisibilityFeature`, `rowSortingFeature`, `tableFeatures()` helper, `createTable`.
- Render APIs used: `table.getRowModel().rows`, `table.getVisibleLeafColumns()`.
- `createColumnHelper` exists but caused type inference issues with v9.3.1; plain column defs with `accessorFn` used instead.
- No new SV Table component files added. Existing `src/lib/table/DebounceInput.svelte` and `src/lib/table/EmptyState.svelte` (adapted from SV Table patterns, restyled with Meadow tokens) are reused. The table is a native `<table>` driven by TanStack Table v9.3.1 headless state (column visibility, sorting), restyled with Tailwind tokens matching `layout.css`/`components.css`.

## URL state (per SPEC Registry)

| Param | Kind | Change type | Default | Notes |
|---|---|---|---|---|
| `q` | search | replaceState (debounced 200ms, no entry per keystroke) | `""` | Sliced to 200 chars before server |
| `archived` | filter | pushState | `false` | `false`=current clients only, `true`=archived only |
| `tag` | filter | pushState (repeatable) | none | Any matching tag (OR) |
| `leadSource` | filter | pushState | `null` | `null`=any, `""`=not set, actual value=filter |
| `minOpportunities` | filter | — | deferred | SPEC.md:210 open question — filter not shipped; UI dropdown removed, server HAVING not applied |
| `sort` | sort | replaceState | `name` | One of column ids |
| `sortDir` | sort | replaceState | `asc` | `asc` / `desc` |
| `page` | page | replaceState | `1` | Integer, clamped to last page after results arrive |
| `pageSize` | page size | replaceState | `25` | Integer 1-100, resets page to 1 when changed |

Frontend normalizes integers/enums before sending to the server so malformed URL values never reach the validator. Invalid values fall back to defaults. Selections and record content never go in the URL. "Clear filters" deletes only known filter keys, preserving `?client` and unrelated params.

## Server query (`getClients` / `data.clients`)

Input: `{ archived, q, tags, leadSource, minOpportunities, sort, sortDir, page, pageSize }`.
Output: `{ clients: ClientRow[], total: number }`.

`ClientRow`: `{ id, name, archivedAt, leadSource, peopleNames, addresses, tagNames: string[], opportunityCount }`.

SQL: one query over `clients` LEFT JOINed to `opportunity_clients`, with correlated subqueries for people/addresses/tags aggregates (so search never trims aggregate display). `WHERE` applies archived state, search (`EXISTS` across name/notes/people.name/phones.value/emails.value/addresses.address/tags.name — case-insensitive `COLLATE NOCASE`), tag filter (`EXISTS` any selected tag, OR), lead-source filter. `HAVING` applies opportunity-count filter. `ORDER BY` applies sort with `c.id` tiebreaker for stable pagination. `LIMIT/OFFSET` paginates. A matching wrapped `COUNT(*)` query returns `total`. Tag names via `json_group_array(DISTINCT ...)` then JSON.parse — tags containing commas are not corrupted and no client shows a tag twice. Page/pageSize clamped to safe bounds; `q` sliced to 200 chars.

## ClientRow aggregation

- `peopleNames`: distinct person names joined with ", "
- `addresses`: distinct addresses joined with ", "
- `tagNames`: distinct tag names including retired tags (applied labels preserved on clients) via `json_group_array`
- `opportunityCount`: distinct linked opportunity count (including archived) — displayed with explicit note "linked (incl. archived)"; no filter applied on it per SPEC.md:210 deferral

## Acceptance checkboxes

- [x] Table renders a dense row per client with Name, People, Address, Lead source, Tags, Opportunities columns; row/name click opens the existing ClientEditor side panel unchanged
- [x] Name search is instant and covers name, contact details, address, notes, tags; typing replaces the current history entry (replaceState), debounced 200ms, no entry per keystroke
- [x] Filters (tags multi, lead source, archived toggle) combine with search; each filter change adds one history entry (pushState)
- [ ] Opportunity-count filter deferred per SPEC.md:210 (open question: whether it counts archived opportunities) — dropdown removed, server HAVING not applied, not shipped until decision
- [x] Sorting works on all sortable columns and is reflected in the URL; sort indicator + `aria-sort` shown
- [x] Pagination + page size are bounded (server LIMIT/OFFSET), reflect in the URL, and clamp/reset when results change; bounded "Page X of Y" control (no runaway page buttons)
- [x] Column controls (show/hide) work and persist visibility to localStorage; name column always visible; storage sanitized on read; no client shows a tag twice
- [x] Reload, bookmark, Back, Forward restore the view; invalid URL values fall back to defaults
- [ ] Layout works at 375px phone width (table scrolls inside itself via `overflow-x-auto`, negative margins restore gutters) — design only, not browser-observed
- [x] Existing `?client=` panel-open behavior preserved: reactive effect keyed on `page.url.searchParams.get('client')` opens the panel when the requested client id changes while already mounted (not just onMount); `lastHandledClientId` avoids reopening/discarding an unsaved draft on unrelated refreshes; removing `?client` resets the marker without closing a manually opened panel
- [x] New client/New opportunity links preserved
- [x] Header cells are native `<button>` elements (keyboard accessible) with `aria-sort`; no `role="grid"` (native table semantics)
- [x] `vp run check` passes with 0 errors and 0 warnings in all touched files

## Assumptions

- Tag filter is OR (any selected tag)
- Archived default excludes archived clients; toggle shows archived only (matches original behavior)
- Lead source filter choices derived from actual stored `clients.lead_source` values
- Search is case-insensitive for ASCII (`COLLATE NOCASE`)
- Auto-refreshing the table after a client save (via `getClients.refreshAll` in the shared save helper) matches existing `getWorkspace` treatment
- Broad `getWorkspace` still loads full data (used by side panel); reactive to `archived` param so side panel works after archive toggle

## Verification status

- `vp run check`: 0 errors and 0 warnings in all touched files (`+page.svelte`, `data.ts`, `validation.ts`, `crm.remote.ts`).
- Browser inspection not performed: no production session available without landing on `/login`; no real client values emitted. The 375px layout claim is design intent, not observed acceptance.
- No claim of SV Table component source files being added — existing `src/lib/table/DebounceInput.svelte` and `src/lib/table/EmptyState.svelte` are reused. The table is a native `<table>` driven by TanStack Table v9.3.1 headless state (column visibility, sorting), restyled with Tailwind tokens matching `layout.css`/`components.css`.

## Notes

- The final combined `vp run check` reports zero errors and warnings. Earlier integration failures in Registry syntax/types and the login transition's unsupported Svelte window event were introduced during this batch and corrected before completion.
- No production data changes, no tests added, no commits/pushes.
