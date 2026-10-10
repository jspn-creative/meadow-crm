# Meadow CRM — MVP

One U.S. business, Meadow Lane Realty & Development, with a realtor and an assistant sharing all records and full access, plus a support admin who acts through either business identity. Currency is USD only. Build a straightforward one-off CRM that works on desktop and phones. Domain terms live in [CONTEXT.md](./CONTEXT.md); checklist seed content lives in [checklists.md](./checklists.md). OpenSpec changes hold implementation plans and testable acceptance criteria, not a second product brief.

## Design boundary

Start with the main view, sidebar, and reusable primitives in Svelte 5. [Quiet Cream](../static/dashboards/04-quiet-cream.html) is the chosen visual starting point: warm neutrals, restrained accents, serif display headings, and a quiet sidebar/main-panel composition. Its widgets, charts, controls, sample data, and role switcher are not requirements. Neither it nor any other example defines current or future functionality. Specific screen layouts and interactions remain open to iteration with the user.

## Core records and behavior

| Record | Content and rules |
| --- | --- |
| Client | Name, contact details, address, lead source, notes, tags, created/updated timestamps, archive state. Exists independently of opportunities. |
| Opportunity | Title, one of four types, one of four stages, optional timeline/property address/budget, one or more clients, notes, references, checklist, archive state. Clients and opportunities have a many-to-many relationship. |
| Checklist item | A step in an opportunity's per-stage checklist, independent of Tasks. Visited stages inherit type/stage defaults automatically; completion/dates retain linkage, while one structural edit detaches the whole stage's structure. Each stage retains its own work. |
| Task | Work assigned to the realtor, created/managed by either user; title, optional due date, completion state, optional client or opportunity reference. Can stand alone. Assistants do not hold assigned tasks in this MVP. |
| Reference | A labeled link to a CRM record or external URL/document; no document upload or dependency behavior. |

- One board for all types: **Buyer**, **Seller**, **Estate Sale**, **Construction**. Types select card accents and offered checklist templates, not separate pipelines. Estate Sale tracks a referral relationship; Construction includes the realtor's personal side work.
- Fixed stages in order: **New lead**, **Active lead**, **Under contract**, **Closed**. Create at the actual stage, skip stages, or move backwards. Closed means completed engagement; outstanding checklist work may remain. First entry inherits the current type/stage defaults; returning restores that stage's retained work. Stage changes record history without completion gates.
- Resetting an opportunity checklist clears all customization, completion, and dates for that stage and relinks fresh defaults; former work remains only in history. Use a secondary action with explicit stage/loss confirmation. Type changes preserve visited stages and their template sources until individually rebased through the same reset behavior; unvisited stages automatically use the new type.
- Optional timeline: **1-3 mo**, **3-6 mo**, **6+ mo**. Show, filter, and sort it; no implied expiration date, automated prompt, or health judgment.
- Clients own tags; opportunities display the read-only union of their clients' tags. Start with **sphere**, **nurture**, **referral**. Nurture is only a label; referral means referred to the business, not a source of referrals.
- Archive clients and opportunities independently, retain fields, notes, links, and history, and allow restoration through explicit archived views. Never show archived opportunities on the board or archived clients in the default registry. No hard delete in this MVP.
- Incomplete checklist items/tasks with a due date before today in the business timezone are overdue. Undated, due-today, completed, removed, and archived-opportunity checklist items are not overdue. Checklist attention defaults to all visited stages, with a business setting for current-stage-only; unvisited stages contribute nothing.

## MVP surfaces

| Surface | Required behavior |
| --- | --- |
| Dashboard | One shared landing view for both users: assigned/open and overdue realtor tasks when Tasks is enabled, overdue checklist work, and a short pipeline summary. Everything links to the underlying records. No separate assistant dashboard or calendar widget. |
| Pipeline | Four-stage board; type, timeline, and inherited-tag filters; timeline sorting; opportunity create/edit/detail; explicit stage movement; checklist progress and derived overdue indicators. Provide a touch/keyboard alternative to drag-and-drop. |
| Client registry | Sortable table, instant keyword search across name/contact/address/notes/tags; tag, lead source, opportunity-count, and archive filters; bulk tag/archive; client detail side panel and linked opportunities. URL-backed views restore search/filter/sort/page state. Selection is current-page-only and clears on view changes; bulk changes succeed for all selected clients or none. Adapt to phone use. |
| Tasks | Optional business-wide module, enabled for initial delivery. Create/edit, assign to realtor, date, complete/reopen, and link to client/opportunity. Disabling hides surfaces and task projections without deleting tasks or affecting checklists. |
| Inbox | Core flat projection of overdue checklist items and, when enabled, overdue tasks. Open the source record. Checklist entries offer a prefilled task form without leaving the inbox; existing task entries open that task instead of creating duplicates. No independently maintained queue. |
| Settings | Business-wide General (name, timezone, date format, Tasks enabled; fixed USD), Pipeline (16 checklist templates and checklist attention scope), Client registry (tags: add/rename/recolor/retire). Both users can edit. No per-user settings. |

Retired tags are unavailable for new application but remain on existing clients unless explicitly stripped. Tags in use cannot be deleted outright. Template edits update linked stage structures while preserving matching progress; customized lists stay independent. Reset this template restores the selected seed structure; Reset all templates is a separately labeled secondary action. Both require impact confirmation, preserve progress for still-present linked items, and leave customized lists untouched; restored removed steps start incomplete and undated. Opportunity checklist reset is the separate full-stage progress-clearing action described above. Every surface reflects the same persisted records; safe small edits provide optimistic pending feedback, and failed or stale saves preserve confirmed data and recoverable drafts.

## Delivery and exclusions

Deliver the visual Svelte shell and only the controls needed for review, using clearly labeled fictional fixtures or empty states. Then prove local persistence/auth compatibility and a client → opportunity → checklist → dashboard slice before expanding workflows. Cloudflare D1 is the shared storage target. Add real app-managed login late for two separately provisioned equal business users plus a support admin with server-verified impersonation and actual/effective-user history; protect access before storing real client information. Production changes require separate approval.

Not in this MVP: Calendar/Google integration, Phone, review queue, nurture reminders, timeline-expiry prompts, pause/follow-up automation, automatic post-close actions, hard delete, import tooling, document storage, reporting/revenue/commission tracking, marketing attribution, role gating, multi-tenancy, onboarding/billing, stage/type editors, workflow builders, health/probability/temperature fields, or automatic stage transitions. Example screens do not add these to the roadmap.

Future discovery is uncommitted: whether waiting needs a pause mechanism; whether deletion is ever appropriate; whether referring parties should be recorded; whether any follow-up or post-close automation is wanted; and whether Calendar or Phone earns a milestone. Phone questions are kept in [research/phone-module.md](./research/phone-module.md). Resolve new scope with the business before specifying it.
