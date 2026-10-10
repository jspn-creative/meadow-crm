# Tasks

Implement in order, with visual/interactive delivery before real authentication. Quiet Cream is the signed-off visual starting point, not a feature list. Development uses explicitly fictional data and guarded local identity until group 8; no real client information or public hosting before authentication. Deployment/provisioning is outside this change. Contracts are in `specs/`, approach in `design.md`.

## 1. Animated shell, demo login, and only the primitives needed now

- [ ] 1.1 Reconcile superseded checklist/account/optimism/primitives/gallery assumptions in `docs/SPEC.md`, `docs/CONTEXT.md`, `PRODUCT.md`, checklist guidance, and applicable project instructions with this approved change; verify no contradictory copied-template/two-account/deployment requirements remain and seed actions are preserved.
- [ ] 1.2 Define Quiet Cream-inspired tokens with DM Sans/Newsreader and CSS-first native control classes in `src/routes/layout.css`; verify the shell's actual normal/focus/press/disabled/pending states use compiled Tailwind 4 without prototype CDN dependencies or unused component scaffolding.
- [ ] 1.3 Implement the Svelte 5 main view/sidebar with Dashboard/Pipeline/Registry/Inbox/Settings and optional Tasks destinations plus dashboard-owned card components and labeled fictional previews; verify route highlighting, honest placeholders, and usable 375px/desktop layouts without implementing Active Clients/Calendar.
- [ ] 1.4 Add the non-authenticating `/login` composition and named-surface morph to the requested workspace route on demo submission; verify cream/white continuity, no password persistence/transmission, and a usable reduced-motion/unsupported-API path.
- [ ] 1.5 Implement smooth expanded/collapsed sidebar transitions and accessible icon-rail labels/actions; verify route/draft retention, focus/touch access, interruptions, and coordinated main-panel geometry.
- [ ] 1.6 Verify native route transitions/CSS starting styles and trial Humanspeak motion for the signature layout/enter-exit interactions; add repeatable browser tests for navigation readiness, Back/Forward, bounded waits, and reduced motion, capture phone/desktop shell previews for fidelity review, and run the Svelte autofixer plus `vp run check`.

## 2. Local runtime, fictional records, and safe data foundations

- [ ] 2.1 Add adapter-cloudflare/local D1 support using its existing required Wrangler configuration, remove global dynamic-route prerendering and gallery-only routes/modules/links, and retain static HTML/user changes; verify a local runtime/binding smoke test and `vp build` without a `cf` migration, deploy, or competing config.
- [ ] 2.2 Add Drizzle domain schemas/migrations with stage-linked checklist identity/progress/overrides, stable IDs, revision/idempotency fields, and dual-identity history; verify isolated fresh/repeat migration and relationship/enum constraints, deferring auth tables to group 8.
- [ ] 2.3 Seed the 16 templates, three starting tags, and separate fictional client/opportunity/task/progress scenarios with controllable relative dates and an explicit local reset; verify useful mixed-stage/multi-client/overdue/archived data, idempotency, edit retention, stable default-step IDs, and no implicit CSV import or development records in production seeds.
- [ ] 2.4 Implement request-scoped identity/data services, Standard Schema validation, and remote query/form/command entry points with single-flight query updates; verify direct requests cannot forge identities/links, local demo identity cannot work in a production build, and no mutable server-shared state leaks across sessions.
- [ ] 2.5 Before expanding CRUD, implement and prove the D1 mutation boundary with revision guards, conditioned related writes, history, and idempotency; verify a zero-row stale update cannot change links or append success history, a bulk operation with one stale record changes nothing, and retrying a successful request does not duplicate work.
- [ ] 2.6 Timebox one implementation-session TanStack DB experiment using stage movement and registry/dashboard projections; verify Svelte/SSR hydration, remote-function integration, optimism/rollback, identity-scoped caches, and no duplicate cache ownership, then record an adopt/defer decision and implement only the verified narrow data interface, not full offline sync.
- [ ] 2.7 Document the verified local migration/seed/reset/identity commands in this design's delivery notes and package-script help; verify those commands run through `vp` and reset is explicitly scoped to fictional local data.
- [ ] 2.8 Run a focused Better Auth/Drizzle/D1 compatibility smoke test using isolated auth tables in the local Workers runtime; verify password hashing, session creation/lookup, and disabled interactive transactions, recording the result in the design before expanding CRM workflows while leaving product authentication to group 8.

## 3. First persisted end-to-end slice

- [ ] 3.1 Build a minimal persisted client → linked opportunity → inherited current-stage checklist flow using the shell's controls; verify creation, reload, dating/completing a step, and a stage move, then reuse this implementation as groups 4–6 expand the workflows.
- [ ] 3.2 Implement shared business-date/overdue/visited-stage-scope queries and wire the slice's pipeline counts and checklist attention into dashboard cards; verify yesterday/today/tomorrow/timezone cases, saved edits updating the dashboard, and a source link reopening the correct checklist stage. Complete remaining dashboard sections in group 7 after their source workflows exist.

## 4. Functioning pipeline and opportunity modal

- [ ] 4.1 Implement opportunity create/edit/modal with type/stage, multiple clients, optional timeline/address/budget, notes/references/history, and space for the checklist sidebar; create behavioral modal primitives only as needed and verify focus entry/return, Escape, draft retention, optional fields, safe links, and phone use.
- [ ] 4.2 Implement the four-stage mixed-type board, inherited tags, type/timeline/tag filters, timeline ordering, and current-stage progress with distinct other-stage attention; verify union tags update from clients, unset timelines sort last, and archived opportunities never appear.
- [ ] 4.3 Implement explicit keyboard/touch stage moves with immediate pending feedback and automatic destination checklist selection; verify direct/backward moves retain other visited-stage work, no completion gate, stale-move rollback, and attributable history.
- [ ] 4.4 Implement opportunity archive/restore in a separate view; verify preserved references/relationships/stage checklists/history, exclusion from checklist attention, and no cascade to clients or independent tasks.

## 5. Functioning registry with URL-backed views

- [ ] 5.1 Implement persisted client create/edit/side-panel detail and history with linked opportunities; verify independent clients, reload persistence, invalid-save draft retention, modal navigation, and phone/keyboard panel behavior.
- [ ] 5.2 Integrate TanStack Table v9 with selected SV Table controls for search/filter/sort/page size/pagination/columns/selection; verify combined retrieval scenarios, current-page-only select-all with a visible count, cleared selection on search/filter/archive/sort/page/page-size changes and Back/Forward, responsive Meadow styling, and no unrequested demo/export features.
- [ ] 5.3 Implement validated URL-owned search/filter/archive/sort/page/page-size state with debounced text replacement, deliberate history entries, and pagination reset/clamping; verify reload/bookmarks/Back/Forward/invalid parameters and no full-page transition on every keystroke, keeping named-view persistence out of scope.
- [ ] 5.4 Implement client-owned tag edits, all-or-nothing bulk tag/archive, archived search/restore, and opportunity-count semantics; verify one stale/invalid selected client prevents all record/history changes, conflict feedback requests refresh/reselection, no duplicate tags, unselected clients unchanged, all retained links counted visibly, and no opportunity cascade.

## 6. Pipeline checklist widget and intentional settings

- [ ] 6.1 Implement automatic inherited stage defaults and per-stage completion/date state in the opportunity modal sidebar; verify first-entry/return behavior, empty defaults, Tasks-off independence, stable progress through template rename/reorder/add/remove, and no attention from unvisited stages.
- [ ] 6.2 Implement whole-stage structural overrides, secondary-menu Reset checklist with explicit loss confirmation, and per-stage type-change rebasing; verify reset/rebase clears all customization/completion/dates even for matching IDs, cancel preserves work, other visited stages retain their sources/state, unvisited stages use the new type automatically, and discarded work remains only in history.
- [ ] 6.3 Implement the visited-stage status strip, hover/focus preview, tap/click inspection, smooth checklist slide, and return-to-current control; verify inspecting/completing prior-stage work never moves the deal or discards drafts and that touch/keyboard users have full access.
- [ ] 6.4 Implement Pipeline settings with a type selector/four stage tabs/one editor, inline item changes, reorder controls, impact counts, confirmed Reset this template, and separately labeled secondary Reset all templates; verify single-template isolation, explicit all-16 impact, retained progress for still-present linked items, no revived historical progress for restored steps, customized-list protection, failed-save drafts, and phone use.
- [ ] 6.5 Implement business-wide All visited stages/Current stage only attention preference and apply it to aggregate cards/dashboard/inbox; verify default includes prior visited work, scope switches preserve per-stage previews/progress, and source links inspect the correct stage.
- [ ] 6.6 Implement General preferences/Tasks enabled and tag vocabulary add/rename/recolor/retire/confirmed stripping; verify shared persistence/validation, fixed USD budgets stored as cents with no currency selector, in-use deletion rejection, retained retired tags, and updated inherited labels.

## 7. Tasks, inbox, and shared refresh

- [ ] 7.1 Implement standalone/linked realtor task create/edit/date/complete/reopen; verify both business identities manage tasks, assistant assignment fails, and task completion never changes checklists/stages.
- [ ] 7.2 Wire Tasks toggling through navigation/projections/creation and server guards; verify off/on preserves task data, direct disabled-module mutations fail, and core checklist behavior remains available.
- [ ] 7.3 Implement scoped overdue inbox/source navigation/prefilled checklist-to-task forms with stage context; verify previous-stage links, no nurture/timeline/calendar/review entries, unchanged checklist source, cancellation, and idempotent save retry.
- [ ] 7.4 Integrate dashboard/task/inbox mutations and remote-query single-flight updates with focus/navigation refresh, visible-view polling, and business-midnight recomputation; verify cross-view consistency, second-session changes, hidden-tab pause, and unsaved-draft retention.
- [ ] 7.5 Complete the dashboard's open/overdue task sections, stage/checklist counts, source/filtered-view navigation, loading/error/empty states, and coordinated motion using the finished source workflows; verify Tasks-off behavior, prior-stage links, matching persisted counts, and no Calendar/Active Clients/reporting widgets.

## 8. Real login and admin impersonation near the end

- [ ] 8.1 Add compatible Better Auth/Drizzle auth schemas and SvelteKit handler/locals with secure sessions, trusted origins, and persisted rate limits; verify password hashing/session lookup in the local Workers runtime, keeping unsupported interactive D1 transactions disabled.
- [ ] 8.2 Add secret-input provisioning/recovery for realtor/assistant/admin with public signup disabled; verify three independent accounts, absent tracked/logged credentials, rejected public signup, and tested operator instructions in this design's delivery notes.
- [ ] 8.3 Replace demo submission with real login/logout/password change while retaining the animated requested-page transition; verify invalid credentials, session expiry/revocation, reduced motion, and production rejection of every development-identity shortcut.
- [ ] 8.4 Add server-verified admin impersonation limited to either business user, a persistent acting-as indicator, and switch/exit controls; verify ordinary-user/forged-ID rejection, no admin CRM action without impersonation, dual history attribution, expiry, and identity-scoped cache refresh/cleanup.
- [ ] 8.5 Enforce authenticated identity on every workspace load/remote function/data endpoint and prevent shared caching; verify direct unauthenticated/cross-origin/forged-actor requests fail while both business users retain equal CRM access.
- [ ] 8.6 Timebox one implementation-session `query.live` experiment in the local adapter runtime; verify authentication, disconnect/cancellation/reconnect, and resource behavior, then document adopt/defer against the polling fallback without adding a sync server, push infrastructure, or claiming durable offline support.

## 9. Integrated local acceptance

- [ ] 9.1 Exercise authenticated client → opportunity → linked checklist → stage/return → template edit/customize → scoped attention → task → archive/restore workflows across two sessions and the impersonating admin; verify persistence, equal business access, dual attribution, tag inheritance, URL views, optimistic rollback, and conflict feedback.
- [ ] 9.2 Exercise phone/desktop/keyboard/reduced-motion flows and network/error/interrupted-navigation cases; verify signature login/sidebar/stage-inspection transitions, focus recovery, no hover-only actions or silent draft loss, production seed isolation, and functioning Dashboard/Pipeline/Registry with Active Clients/Calendar unimplemented.
- [ ] 9.3 Run `vp run check`, `vp check`, `vp build`, and the test suite through `vp`; verify documented local migration/seed/auth/recovery commands and the bounded data/live-query experiment reports, then deliver acceptance evidence without deployment or live migrations.

## Workflow follow-up

- Deployment, live Cloudflare changes, named saved views, durable offline writes, and additional realtime infrastructure require separately approved follow-up scope.
- Review completed acceptance evidence before explicitly requesting archive of this change.
