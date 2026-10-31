# Dashboard four scorecards

## Status

Implementation complete: **yes**. Four scorecards ship using only settled metrics: Clients, Today's Tasks, Overdue tasks, Upcoming. Opportunity counts are intentionally not implemented; that business counting decision is left to the user.

## Accepted scope

- Four real scorecards on the shared dashboard route (`src/routes/+page.svelte`): Clients, Today's Tasks, Overdue tasks, Upcoming.
- Own `src/lib/dashboard/Scorecards.svelte`, `src/lib/dashboard/Scorecard.svelte`, and the dashboard route only. No edits to `src/lib/server/data.ts`, `crm.remote.ts`, `schema.ts`, registry/login, shared layout, or global CSS.
- Reuse existing `Scorecard.svelte` and `DashboardCard.svelte` styling; existing color tokens; no redesign; no invented percentage deltas; detail line shows scope text.
- All counts come from the existing authenticated `getWorkspace` snapshot; derived on snapshot refresh only, not recomputed at business midnight. No new backend query, mutation, or schema change needed. No missing backend need.
- Counts are workspace-wide (both business users see every record); dates and overdue use `America/Los_Angeles` via `businessToday`.

## Metrics: calculations and evidence

| Card | Label | Count rule | Evidence |
| --- | --- | --- | --- |
| Clients | Clients | Non-archived clients (`archivedAt === null`) | `schema.ts:74` `clients.archivedAt`; `data.ts:262` filters `archivedAt IS NULL` |
| Today's Tasks | Today's Tasks | Incomplete tasks whose date has arrived (`!completedAt && date <= businessToday`) | SPEC Dashboard; `src/lib/tasks/TaskManager.svelte:35` today filter |
| Overdue tasks | Overdue tasks | Incomplete tasks due before today (`!completedAt && dueDate && dueDate < businessToday`) | SPEC Tasks overdue definition; `src/lib/pipeline/due.ts:6` |
| Upcoming | Upcoming | Incomplete tasks whose date or due date falls after today within the next 14 days | Reuses existing Upcoming widget: `src/lib/tasks/TaskManager.svelte:19,33` |

Detail lines use scope text: `Non-archived clients`, `Date has arrived`, `Past due date`, `Next 14 days`.

## Opportunity metric not chosen

SPEC defines stages (New lead, Active lead, Under contract, Closed) and archiving, but does not settle an "active opportunities" aggregate — whether it means non-archived non-Closed or Active lead only is an open business counting decision. Not implemented; deferred to the user if desired, not a blocker on these four cards.

## Checkboxes

- [x] Accepted scope recorded (dashboard route + scorecard components only; no backend/schema/layout edits)
- [x] Clients calculation settled + evidence cited
- [x] Today's Tasks calculation settled + evidence cited
- [x] Overdue tasks calculation settled + evidence cited
- [x] Upcoming calculation reuses existing widget's exact inclusion + horizon; evidence cited
- [x] Opportunity metric intentionally not chosen; open decision recorded, not silently resolved
- [x] Confirmed no missing backend need: all four metrics use existing `getWorkspace` snapshot fields
- [x] Implementation complete: `Scorecards.svelte` rewritten, `+page.svelte` renders Scorecards at top
- [ ] `vp run check` orchestrator pending after all implementation edits finish

## Remaining

Visual human review of the four rendered scorecards under normal motion; counts derive from the real authenticated snapshot.
