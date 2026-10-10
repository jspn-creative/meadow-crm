# Design

## Context

See [proposal.md](./proposal.md) for the revised scope. The repo currently has Svelte 5.57, SvelteKit 3, Tailwind 4, Vite+ 1.0 with a pinned core override, a minimal layout/placeholder homepage, and a build-time gallery. `layout.css` contains only the Tailwind import. `vite.config.ts` uses `adapter-static`; `+layout.ts` globally prerenders. Async Svelte and remote functions are already enabled, and the installed Kit includes `query.live`. Preserve unrelated working-tree changes. The approved revisions here deliberately supersede earlier product-doc assumptions about copied checklists, two total accounts, gallery retention, up-front component scaffolding, and rejection of optimism; reconcile those documents before implementing the affected behavior.

## Goals / Non-Goals

**Goals:** Deliver a rich, usable visual shell and fictional data first, then functioning Dashboard/Pipeline/Registry workflows. Prefer remote functions, immediate optimistic feedback, stage-linked checklists, and intentional motion. Implement real authentication near the end while preparing an identity-aware data boundary from the start.

**Non-Goals:** A generic component framework, gallery preservation as a route, deployment/provisioning, a `cf` compatibility migration, or a separate sync service. Full offline writes, named saved views, and realtime collaboration are not promised. Product exclusions remain in the proposal.

## Decisions

### 1. Motion-rich shell and as-needed primitives first

Implement the main view/sidebar/dashboard in Svelte 5 runes mode. Use Quiet Cream's paper/canvas neutrals, muted accents, hairlines, and composition with Newsreader display headings and DM Sans UI text. Add `/login` immediately: a roughly half-cream/half-white desktop composition whose white panel morphs into the requested workspace's main panel on demo submission. The expanded sidebar and collapsed icon rail transition smoothly without making labels/actions inaccessible. Adapt the composition to phones instead of preserving desktop proportions mechanically. Fixtures and demo authentication are clearly identified as development-only.

Define tokens and shared control styles in `src/routes/layout.css` using Tailwind 4's CSS-first theme/base layers. Ordinary buttons, icon buttons, and fields begin as native elements with shared CSS classes; promote a component when behavior warrants it, such as pending state, focus management, menus, or repeated composition. Build only what the current surface needs. Dashboard cards are dashboard-owned components, not the mandatory container for every record/settings surface. Use markup utilities, snippets/reactive props, and `$derived`, with installed Lucide icons instead of prototype CDN dependencies. Defer table/panel components until their actual workflows need them.

Keep named cream/white surfaces in the shared root layout so login-to-workspace and sidebar geometry have continuity. Native same-document View Transitions own route morphs, integrated with SvelteKit navigation readiness; do not hold the DOM update callback until navigation completes and deadlock it. Await a bounded transition phase even if navigation is slightly slower, prefetch destination data, and handle interruptions, Back/Forward, errors, and reduced motion. CSS owns simple hover/focus/press and entrance feedback, using `@starting-style` and discrete transitions where supported. Humanspeak motion provisionally owns springs, list reordering, and complex enter/exit behavior; no competing engines animate the same property. Verify SSR/hydration and the two signature transitions before relying on the package. Target current 2026 evergreen browsers with feature detection; an unsupported API or reduced-motion preference must not block navigation.

Alternative: database-first delivery, a full component kit, or prototype copying. Rejected because visual feedback and actual needs should lead. Native/CSS motion avoids unnecessary wrappers; Humanspeak's documented layout/presence support fits better than `motion-sv`'s more manual layout tracking. The shell review confirms implementation fidelity, not a new round of design-direction selection or invented features.

### 2. SvelteKit server runtime, not a static-only app

Use `@sveltejs/adapter-cloudflare` for local product runtime and remove global prerendering from dynamic routes. Accept the adapter's existing Wrangler-config requirements; do not introduce `cloudflare.config.ts`, a parallel `cf` config, provisioning, or deployment work. Vite+ continues to own build/dev/check. Remove `/dashboards`, its route-only server module, and homepage gallery links; leave HTML artifacts in `static/` unchanged as references. Use a workspace route group and public `/login` with a server hook supplying request-scoped identity now and authenticated locals later.

Prefer validated remote `query` for reads, remote `form` for forms, and remote `command` for non-form mutations, including checklist toggles/stage moves. Retain loads only where route/session bootstrapping needs them; auth-library handlers are an appropriate endpoint exception. Use Standard Schema validation and the request event's database/identity services for every remote entry point, including auth checks once real login is enabled. Do not introduce a generic form framework, duplicate REST API, or server-shared mutable client state. Remote mutation responses refresh/set affected queries in one flight, including active filtered instances.

Alternative: static/browser-local-only records, a separate API service, or defaulting all CRUD to route actions. Rejected because shared persistence is needed and the user explicitly prefers the already-enabled remote-function boundary.

### 3. D1 with a relational model

Use Drizzle's D1 driver for typed SQLite schemas/migrations in an isolated local D1 database. Tables: business settings; clients; tags/client-tags; opportunities/opportunity-clients; type/stage templates/template items; opportunity-stage checklist overrides/progress; tasks; references; history; mutation idempotency. Add Better Auth tables during the late authentication phase. History supports actual actor and effective user from the start. No tenancy model, event table, review queue, phone tables, opportunity-owned tags, or persisted inbox/dashboard rows.

Use stable IDs, UTC timestamps, date-only due dates, revision numbers, and indexed relationship/due-date/archive fields. Store budgets as integer USD cents and format them as USD; this U.S.-only business needs no currency selector or conversion system. Client/opportunity notes can be plain text in this MVP. Tasks have an assigned user ID constrained to the provisioned realtor; both users can manage them. The opportunity-count filter counts all retained links, including archived opportunities, with that meaning visible in the UI.

Seed idempotent, explicitly fictional clients/opportunities early, covering all types/stages, multi-client relationships, unset timelines, archive cases, completed/open steps, and dated/overdue work. Use dates relative to a controllable development clock so demonstrations remain useful. Keep development record seeds separate from the real checklist/tag defaults; offer an explicit local fixture reset, never automatic overwrite. Do not assume `docs/client-data.csv` is fictional or import it without specific approval. Fixtures are safe development content, not records to deploy.

References use explicit target kinds and validated CRM targets/HTTP(S) URLs. Archive retains associations and history; archived opportunities are excluded from checklist attention, while independent tasks remain actionable. Keep archived links reachable in details.

Alternative: document blobs or JSON arrays for all records. Rejected because relationships, filters, tag inheritance, bulk operations, and history need consistent joins and constraints.

### 4. Checklists belong to Pipeline, with separate stage state

The opportunity modal contains a compact checklist sidebar, not a standalone module. On creation or first entry to a stage, show that type/stage's current defaults automatically and mark the stage visited. Track progress by opportunity, stage, and stable template-item ID. Returning to a visited stage restores its completion/dates/customizations; moving stages never clears another stage or requires completion. Viewing another stage in the modal does not move the opportunity. Unvisited future stages contribute no checklist attention.

Completion and due dates remain an overlay on linked defaults. Template rename/reorder retains stable item IDs and thus progress; new steps appear with no progress. One structural edit (add/remove/rename/reorder) detaches the entire stage checklist, not just that item; later template edits do not rewrite it. Removed steps stop creating attention and their displaced work remains in history, never automatically restored when a step is reintroduced.

Resetting an opportunity's stage checklist is all-or-nothing: remove its structural override and every completion/date, then relink to fresh defaults with every item incomplete and undated, even when item IDs match. Retain the former state in history only. Put Reset checklist in a secondary menu, then require a confirmation naming the stage and explaining the loss of customization and progress; cancel changes nothing. Other stages are untouched. Changing type preserves visited stages and their identifiable template sources; offer the same deliberate reset/rebase separately for each visited stage to adopt the new type's defaults. Unvisited stages automatically use the opportunity's current type on first entry.

Show a small visited-stage status strip in the widget: completion counts and overdue indicators reveal a compact preview on hover/focus, with tap/click access on phones. Selecting a stage slides the checklist content into view and provides an obvious return-to-current action. Keep opportunity stage and inspected checklist stage visually distinct. This is temporary inspection, not a second stage-change control. Use one motion owner for the slide and no hover-only interaction.

Pipeline settings use a type selector and four stage tabs with one focused inline editor and add/rename/reorder/remove actions. Reset this template restores only the selected type/stage's seed structure; a separate secondary Reset all templates action explicitly names all 16 in its confirmation. Display inherited/affected counts before removal/reset. Template resets change defaults, not opportunity-level progress: retain progress for still-present linked items, introduce restored removed items incomplete and undated, and leave customized lists untouched. Stable seed IDs do not resurrect historical progress. The separate opportunity checklist reset above clears all stage progress. Do not introduce 16 simultaneous editors.

Alternative: one accumulating copied list or reset-on-every-stage-move. Rejected because the user chose linked defaults with separately retained state for each stage. Stable identities prevent progress loss when a template changes.

### 5. Registry table with URL-owned state

Use TanStack Table v9's Svelte 5 adapter as the headless engine; select SV Table's copy-in filters, sorting, row selection, bulk actions, pagination, and column controls as needed. Restyle them to Meadow instead of importing a second visual system wholesale. Adopt supporting headless/shadcn dependencies only when an actual interaction needs them. Do not add every demo feature, CSV export, or an early generic table abstraction.

Use validated, canonical query parameters for search, filters, archive state, sorting, page, and page size. Reconstruct controlled table state from the URL on entry and Back/Forward. Debounce text-input updates with replacement history, push deliberate filter/view changes, and reset/clamp pagination when results change. Avoid putting notes/contact details or selections into URLs. Use shallow state changes where possible so every keystroke does not trigger a full route transition. Bookmark/share URLs initially; persisted named presets are a separately scoped follow-up, not a hidden Settings feature.

Alternative: a bespoke table engine or session-only filter state. Rejected because [TanStack v9](https://tanstack.com/table/v9/docs/overview) and [SV Table](https://sv-table.vercel.app/docs) cover the desired interactions while keeping markup under our control; URLs give useful saved filter sets without adding a view-management subsystem.

Selection is limited to the current page; select-all means the visible page, never all matching records. Clear selection on search/filter/archive/sort/page/page-size changes, including Back/Forward, and show the selected count. Bulk tag/archive commits all selected records or none: any stale or invalid selected record rejects the whole operation with no partial records or history. Keep feedback simple: explain the conflict and ask the user to refresh and reselect.

### 6. Optimistic writes, safe persistence, and bounded sync exploration

Domain services validate identity/input/module state and commit related writes/history using atomic D1 batches, not unsupported interactive transactions. Use revision checks, conditioned related writes, and idempotency keys. Stable client-generated record IDs make retry/optimistic insertion practical. Every operation must reject invalid links/stale revisions without partial writes. Preserve the last committed state independently of temporary optimistic presentation.

Before expanding CRUD, prove one stale-revision mutation cannot change relationships or append success history. A conditional update affecting zero rows is not itself a batch error; related writes must depend on a successful guard. Exercise the same all-or-nothing boundary for a bulk action containing one stale record. These are focused persistence checks, not a generalized transaction framework.

Checklist toggles, stage moves, and other safe small mutations update immediately with pending feedback. Confirm from the server response or roll back the optimistic overlay, keeping recoverable form drafts. Conflicts require explicit reload/reconcile rather than last-write-wins. Cross-view displays use the same normalized record identity and pending state rather than independent copies. Server history records actual actor/effective user, time, action, and retained change data. Until authentication, those are explicit local development identities.

Before client-state architecture spreads, timebox a TanStack DB feasibility experiment around stage movement plus registry/dashboard projections: Svelte 5 integration, remote-function handlers, SSR hydration, optimism/rollback, and identity-scoped caches. Document a concrete adopt/defer result. TanStack DB is not a sync server or automatic offline guarantee; its current Svelte package is pre-1.0. Adopt normalized collections only if the experiment avoids duplicate remote/collection caches and materially simplifies these workflows. Otherwise retain remote queries and small optimistic overlays behind a narrow data interface.

Default cross-user freshness is query refresh on navigation/focus plus visible-view polling, paused when hidden, with business-midnight recomputation. Separately timebox `query.live` in the local adapter runtime for authenticated streaming, cancellation/reconnection, and resource cost. D1 has no automatic change feed: a streaming poll is still polling, and true push notification could later need a Workers/Durable Object change channel. Do not add that infrastructure here. Durable offline writes require an outbox, idempotent replay, conflict UX, expired-session handling, and cache isolation across impersonation; reserve them for explicit follow-up rather than promising them in this MVP.

Alternative: rejecting all optimism, adopting a full sync platform immediately, or coupling every view to raw remote calls. Rejected in favor of responsive interaction now and a bounded, replaceable path to richer local-first/realtime behavior. Local durable caches must be isolated/cleared appropriately on logout or identity switches if later adopted.

### 7. Attention is a stage-aware query, not automation

Derive today using the business's IANA timezone and compare date-only due dates. Share calculations across cards/modal/widget previews/inbox/dashboard. Pipeline settings expose Checklist attention scope: **All visited stages** (default) or **Current stage only**. Apply the same scope to aggregate overdue indicators and attention views; show the source checklist stage on entries and open that stage inside the modal. Current-stage progress remains the primary card fraction, with other-stage attention distinguished. Stage previews show each stage's own status regardless of attention scope. Completed, due-today, undated, removed, and archived-opportunity steps do not qualify.

Checklist-to-task creation opens a prefilled form with source opportunity/stage context; it is not an automatic transfer or dismissal. Tasks-off checks apply on the server as well as in the UI. Dashboard stage summaries, open tasks, and checklist attention are projections of the shared records. Active Clients, Calendar, and follow-up sections are absent, not placeholder promises. Fictional data remains available in isolated development; production-shaped empty states stay honest.

Alternative: silently forgetting old-stage work or permanently forcing all stages into the inbox. Rejected in favor of a visible business-wide preference, defaulting to not losing unfinished dated work. No stored inbox state, inferred timeline expiry, or nurture rules.

### 8. Real authentication and admin impersonation late

Implement auth after the core workflows. During local runtime setup, first run a small Better Auth/Drizzle/D1 smoke test for password hashing, session creation, and session lookup in the Workers runtime with interactive transactions disabled; use isolated test auth tables and record the result here, leaving product login and provisioning until group 8. Early server calls resolve an explicit local development identity only in a guarded development/test environment; production builds must fail closed without real auth. Demo login neither collects/stores real passwords nor exposes client data. Do not host the unauthenticated development build publicly or use real client information. Identity-aware service boundaries and actor/effective-user history avoid retrofitting attribution later.

Use Better Auth's SvelteKit handler/Drizzle adapter for email/password, disabling public signup and provisioning the realtor, assistant, and admin account with secret input. The two business users retain equal CRM access. The admin enters CRM workflows only as one of those users; use the admin plugin for server-verified impersonation rather than accepting a client-supplied effective-user ID. Scope privileges to that support need, not broad account-management features. Show a persistent acting-as indicator, an explicit switch/exit, short-lived impersonation, and history that records both identities. Clear/revalidate identity-dependent query caches when switching. Ordinary users cannot impersonate.

Populate session/user locals explicitly against the request D1 binding and enforce authentication on every remote/read/action entry point. Use secure HTTP-only cookies, trusted origins/CSRF protection, persisted login rate limits, generic failures, no shared-cache CRM responses, and Workers-runtime hashing/session tests. Keep personal password change/logout separate from business Settings; operator-assisted forgotten-password recovery is the initial limitation. Do not enable interactive auth transactions on D1. Library references: [SvelteKit integration](https://www.better-auth.com/docs/integrations/svelte-kit), [Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle), [admin impersonation](https://www.better-auth.com/docs/plugins/admin).

Alternative: early password plumbing, Cloudflare Access, or a pretend browser-only user switcher. Rejected because the user wants UI-first delivery and app-managed, attributable support access.

## Risks / Trade-offs

- [Deferred auth risks accidentally exposing dev data] → local-only fictional records/identity; production fail-closed checks; authenticated endpoint verification before any real use.
- [D1 lacks interactive transactions] → use atomic batches and conditioned writes for CRM operations; test failure paths and document auth-library recovery limitations instead of pretending full transactional support.
- [Linked templates can change active work] → stable item identities, impact summaries, detached structural overrides, confirmed resets, and retained history for displaced progress.
- [Motion can block navigation or conflict across engines] → named-surface ownership, bounded waits, cancellation/fallback, reduced-motion handling, and explicit navigation tests.
- [Optimism/polling permit temporary disagreement] → pending-state feedback, revision checks, rollback/draft retention, and shared invalidation.
- [Local-first/realtime exploration could inflate scope] → two bounded experiments with adopt/defer reports; no sync-server or durable-offline promise.
- [Impersonation can conceal the actor or leak cached state] → server-verified sessions, dual attribution, persistent indicator, identity-isolated cache lifecycle, and direct endpoint tests.

## Local Delivery Plan

1. Reconcile superseded product documentation during implementation, then deliver the animated shell/demo login with fictional data and only the necessary controls. Preserve unrelated staged changes and static artifacts; remove gallery-only code.
2. Add the local adapter/D1 runtime and idempotent seed/reset path, prove the auth compatibility and stale-write checks, and run the bounded data-layer experiment. Deliver one persisted client → opportunity → checklist → dashboard update slice before expanding the pipeline/modal, registry, and checklist settings. USD is fixed; initial demo timezone/date-format values remain labeled development defaults.
3. Complete Tasks/Inbox and the dashboard's remaining projections/source links after their source workflows exist, then add three-account auth/impersonation, remove demo identity from production paths, and exercise authenticated cross-session workflows. Keep operator provisioning/recovery and local migrations documented in this change's delivery notes rather than scattering new planning docs.
4. Verify local builds, phone/desktop/keyboard/motion flows, no silent write loss, and no fixture leakage into production seeds. Deployment, live migrations, backup/rollback execution, and git integration are explicitly outside this change and require a later operational plan.
