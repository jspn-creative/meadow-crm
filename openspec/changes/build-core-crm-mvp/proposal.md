# Proposal

## Why

Meadow has an approved visual starting point but no working CRM. Build an interactive, motion-rich workspace early so the user can evaluate real workflows with fictional development data before authentication and operational concerns consume the timeline.

## What Changes

- Start with the Svelte 5 shell/dashboard, animated expanded/collapsed sidebar, and a demo `/login` that morphs its cream/white split into the workspace. Use DM Sans with Newsreader and create CSS-first primitives/components only as needed; dashboard cards remain surface-specific.
- Deliver functioning Dashboard, Pipeline, and Registry modules, with fictional clients/opportunities seeded early. Remove the gallery route and supporting code, retaining static HTML references. Examples supply visual direction, never features.
- Build the fixed shared pipeline, opportunity modal, client relationships, references, and reversible archive/restore. Checklists are a Pipeline widget inside the opportunity modal, not a standalone module.
- Automatically inherit checklist defaults per opportunity and visited stage; retain each stage's progress separately. Completion/dates remain linked; structural customization stops inheritance for that stage. Add previous-stage preview/navigation and intentional template settings.
- Make opportunity checklist reset/rebase a deliberate full-stage fresh start, clearing customization, completion, and dates. Rebase visited stages individually after a type change; unvisited stages use the new type automatically. Settings reset one template by default with a separate reset-all action.
- Keep the one-off U.S. business on USD only. Registry selection covers the current page and clears on view changes; bulk changes succeed completely or change nothing.
- Add optional realtor Tasks, a shared overdue inbox/dashboard, and business-wide settings. Checklist attention includes all visited stages by default, configurable to current-stage-only.
- Prefer remote functions and responsive optimistic updates with safe server validation. Investigate TanStack DB/offline support and native remote live queries without committing to a separate sync service or promising offline/realtime delivery.
- After the visual shell, prove the local auth compatibility and stale-write boundaries, then deliver one persisted client-to-opportunity-to-checklist-to-dashboard slice before expanding the remaining workflows and dashboard projections.
- Add app-managed authentication late: two equal business users plus the user's admin account, with secure impersonation and true-actor/effective-user history. Development identity/demo login is local-only and never protects real data.
- Exclude deployment/provisioning, Active Clients, Calendar, Phone, review queue, nurture/timeline reminders, post-close automation, import tooling, reporting/commission tools, hard delete, and example-derived functionality. Named saved views and full offline/realtime support are follow-ups, not acceptance requirements.

## Capabilities

### New Capabilities

- `workspace-shell`: Responsive shell, demo login, collapsed sidebar, consistent controls, and motion-led navigation.
- `shared-workspace`: Durable data, optimistic/conflict-safe writes, late app login, admin impersonation, and attributable history.
- `client-registry`: Searchable clients, URL-backed filter/sort/page state, tags, bulk actions, links, and archive/restore.
- `opportunity-pipeline`: Fixed board, opportunity modal, stage movement, inherited tags, references, and archive/restore.
- `opportunity-checklists`: Pipeline-owned stage checklists, linked defaults, customization, preserved progress, and previous-stage access.
- `tasks-attention`: Optional Tasks, stage-aware overdue projections, and the functioning shared dashboard.
- `business-settings`: Global preferences, attention scope, intentional template editing, and tag vocabulary.

### Modified Capabilities

None; no existing OpenSpec capability specs are present.

## Impact

Expected output includes functioning Dashboard, Pipeline, and Registry modules; Active Clients and Calendar are not implemented. Extend `src/routes/` and `src/lib/`, define theme/control styles in `src/routes/layout.css`, remove gallery-only code, and retain static HTML artifacts. Use the Cloudflare adapter and local D1/Drizzle runtime, accepting the adapter's existing Wrangler-config dependency without adding a `cf` migration or deployment task. Keep Vite+ and its core pin. Add Better Auth late, TanStack Table v9 with selected SV Table patterns, and provisionally Humanspeak motion; TanStack DB/live-query adoption depends on bounded feasibility experiments. These approved revisions supersede the earlier copied-checklist/two-account/no-optimism assumptions in product docs; reconcile those docs during implementation. This update changes planning artifacts only.
