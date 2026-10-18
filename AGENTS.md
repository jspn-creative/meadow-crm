
# AGENTS

## Implementation scope

Build from [docs/BACKLOG.md](docs/BACKLOG.md), one item at a time, against [docs/SPEC.md](docs/SPEC.md). The `openspec/` folder is superseded and kept only as history; do not follow its tasks or treat its decisions as current. Static HTML files in `static/` are visual references and stay unchanged unless explicitly requested.

## Git

Never commit unless explicitly asked. Leave changes in the working tree so the human can review them first. This covers `git commit`, `git commit -a`, and anything that commits implicitly (`git stash pop` after a conflict is fine, but do not resolve-and-commit). `git add`, `git status`, `git diff`, `git log`, and `git stash` are fine to use freely.

When the user does ask for a commit, ask what to include if the tree has unrelated changes — do not sweep up work you did not make. Do not push, create branches, amend, or rewrite history unless that request was explicit too.

Commit messages use a simplified Conventional Commits form: a type, a colon, and a single lowercase imperative sentence describing the change. No scope parentheses, no `!` markers, no trailing period, no body unless the user asks for one. `chore: drop the unused pipeline options doc`, `fix: stop the timeline overlapping on mobile`, `docs: explain how the archive rules work`. Stick to the obvious types — `feat`, `fix`, `chore`, `docs`, `refactor`, `test` — and do not invent new ones. So not `fix(ui): ...`, not `Fixed the thing.`, not a bulleted changelog.

## Commands

This project uses Vite+ (`vp`). Run everything through `vp`, and follow whatever Vite+ guidance is already loaded in your context.

## Final verification

Finish implementation edits and any fixes suggested by analysers before running final checks. Choose checks for the changed content: app changes require Svelte checks, relevant automated tests, and a production build; documentation-only changes require a final diff review, not an app build. Inspect the final diff for unintended changes before reporting completion.

A later edit invalidates any check whose inputs it changes. Rerun affected checks on the final file state; do not carry forward an earlier passing result as evidence for edited files. Final replies must distinguish checks that passed on the final state from checks run only on an earlier state, and disclose failures or checks that could not run. Automated checks passing does not establish visual or interaction acceptance.

## UI acceptance

For responsive or motion-related changes, inspect the affected surface and actual interactions at phone, tablet, and desktop widths with normal motion enabled. Exercise the relevant scrolling, resizing across breakpoints, and collapse/expand controls; check reduced motion separately. Batch these into the bounded inspection and confirmation passes required by the design workflow rather than adding an open-ended polishing loop.

When matching a visual reference, verify responsive placement, cropping, and behavior as well as the asset itself. Add focused regression coverage for the behavior being changed, but do not substitute dimensions, static screenshots, or reduced-motion tests for observing the normal-motion experience. Report any acceptance limitation instead of claiming broader verification.

## Context loading

For design work using Impeccable, run its context loader once per session with the named source file or route as the target. Treat complete documents emitted by the loader as already read: do not separately reload `PRODUCT.md`, `DESIGN.md`, the resolved surface brief, or any emitted platform reference unless it changed or the earlier output was incomplete. Use the loader's resolved paths to identify what was actually loaded; linked documents are not implicitly loaded.

Load only the applicable command playbook and references required by the active task or instructions. Keep all mandatory framework, styling, tooling, and product guidance; context efficiency is not permission to omit required reads. If the target changes, read the newly relevant surface brief directly rather than rerunning the entire loader. Reuse unchanged guidance already present in the session instead of gathering it again for each follow-up.

## Cloudflare

Cloudflare work goes through `cf`, Cloudflare's CLI, which is installed globally (currently v1.0.0-beta.5). It covers the entire Cloudflare API — 3,000+ operations across Workers, D1, R2, KV, DNS, Access, Tunnels, and the rest. Use it instead of `wrangler`; Wrangler is in maintenance-only support and Cloudflare is steering agents to `cf`.

**This app targets Cloudflare.** It uses `@sveltejs/adapter-cloudflare`. Use `cf` for Cloudflare provisioning, bindings, deployment, and inspection, and verify the actual adapter/config path before deploying.

What `cf` must not do is silently take over the build. `vp` owns dev, build, and check, and `cf` is Vite-based, so a plain `cf deploy` would build through its own pipeline and pull in the Cloudflare Vite plugin, fighting `vp` and the `vite-plus-core` pin in `package.json` `overrides`. Avoid `cf init`, `cf migrate`, and `cf dev` for the same reason — they restructure project config, and the adapter stays wired in `vite.config.ts`. For a separately approved deployment, verify the prebuilt output/config path before using `cf deploy --prebuilt`; do not make a `cf` config migration a prerequisite for local MVP implementation.

The backlog covers local implementation only. Use the Cloudflare adapter's required Wrangler configuration for its local D1 runtime; this config dependency does not authorize switching deployment tooling to the Wrangler CLI. Do not introduce `cloudflare.config.ts`, a competing config, provisioning, deployment, live migrations, or git integration as part of backlog work. The operational guidance below applies only to separately requested Cloudflare work.

**Deployment sequence: manual first, git integration second.** The first deploy is done by hand via `cf`, and git integration is attached to the already-deployed site afterwards. This is deliberate — a pipeline that builds on every push surfaces requirements as a run of failed builds, and the first several almost always fail while bindings, routes, and compatibility dates get settled. A manual deploy surfaces the same requirements immediately, with the error in front of you. Do not propose wiring up git integration as the first step, and do not treat early deploy failures as a reason to reach for CI.

Once integration exists, prefer pushing over deploying by hand: a manual `cf deploy` on top of it cuts a duplicate release. Combined with the Git rule above, production only moves when the human pushes.

On the config file: `cf` expects `cloudflare.config.ts`, while the SvelteKit adapter has historically read Wrangler's config. Confirm which one this setup actually consumes before creating either, and do not add both by default — a stale Wrangler config the adapter reads while you edit the `cf` one is a silent failure. `cf schema <command>` and `--help` on the relevant command are the reliable sources here.

To share the static prototype in `static/`, deploy it directly — `cf pages deploy static` — as a one-off, not a repo script.

Within `cf` itself:

- **Output is JSON by default.** Do not pass `--json` and do not reflexively pipe to `jq` — plain `cf <command>` already returns parseable JSON. Use `-q`/`--quiet` to drop non-essential output when you only care about the data.
- **Find commands with search, not from memory.** `cf cli search "purge everything at the edge"` takes plain-language intent and returns candidate commands. With this many routes, guessing a path and reading `--help` at every level burns far more context than one search.
- **Get exact parameters from the schema.** `cf schema dns records create` returns the real request shape, so you are not inventing flags. Use it whenever you are about to call a command you have not run before.
- **Useful globals:** `-z/--zone` (zone ID or domain; overrides `CLOUDFLARE_ZONE_ID`), `--profile` (auth profile), `-m/--mode`, and `--local` (simulated resources). `--local` coverage is partial — read-only calls like `cf --local zones list` still fail against the real API — so fall back to a live read rather than assuming the simulation is authoritative.
- **Check auth before the first call.** `cf auth whoami` returns `{"authenticated": false, "error": "Not logged in"}` when there are no credentials — if you see that, stop and ask the user to run `cf auth login` rather than trying workarounds. On success it also returns the account list, which is what you actually need: read it and confirm you are pointed at the intended account before any write, since a wrong account means wrong data. Do not create or switch profiles (`cf auth create`, `cf auth activate`) unprompted.
- **Treat anything that changes production as requiring approval.** Deploys, cache purges, DNS edits, access policy changes, and deletions are outward-facing and hard to undo. Confirm the target account and zone, then ask. Read-only calls (`list`, `get`, `describe`) are fine to run freely.
- **Dry-run first.** `cf deploy --dry-run` builds and validates without uploading. Worth doing before any real deploy here, particularly while the adapter/config work is still in flight.
- **It is a beta.** Check `cf --version` and confirm behavior against `--help` or `cf schema` if a command errors in a way that does not match the docs.

When a request is ambiguous between "change the app" and "change something on Cloudflare", stop and ask which is meant. Provisioning a database and binding it in code are different tasks with different blast radii.

## Styling

Tailwind CSS v4, wired via `@tailwindcss/vite` and `@import "tailwindcss"` in `src/routes/layout.css`. Follow whatever Tailwind guidance is already loaded in your context, in full, before editing any styling.

`src/routes/layout.css` owns the product's design tokens, base resets, and CSS-first shared native control and work-row classes. Start buttons and fields as native elements using the existing `control` and `field` patterns; create reusable Svelte components only when current behavior or repeated composition needs them, not as up-front scaffolding. Dashboard widgets share `src/lib/dashboard/DashboardCard.svelte` for their boundary, heading, optional action, and gutters; keep widget content and layout in its children rather than growing a universal card system. Reuse `TaskList` and `DueBadge` for their existing repeated composition and due-state semantics instead of cloning the dashboard widget onto other pages. Widget item titles use the shared `item-title` class: a title designed to sit on one line keeps tight leading so that wrapping never costs more vertical space than the row budgeted.

### Content responsiveness

Use named Tailwind container queries for content layouts that depend on the space left inside the workspace: dashboard grids and summaries, pipeline columns, and reusable widget interiors. Keep viewport breakpoints for the shell's desktop rail versus phone/tablet navigation. Choose thresholds from readable minimum content widths, not device names; make narrow layouts the default, use `min-w-0` on shrinking grid/flex children, and check both expanded and collapsed sidebar states plus resizing across the rail breakpoint. A reusable component should own its interior query container when it can appear in different layouts; name outer layout containers explicitly when descendants must respond to them. Prefer CSS queries to JavaScript size observers for purely visual layout.

## Documentation

Product requirements live under `docs/`; `PRODUCT.md` is a short design-context summary. Read before building:

- `docs/SPEC.md`: what the MVP is, the record model, the pipeline, modules, settings, out of scope, settled decisions, and open questions. The primary document.
- `docs/BACKLOG.md`: what to build next, one item per session, and which work waits on an open question.
- `docs/checklists.md`: the 16 default checklist templates (4 opportunity types × 4 stages).
- `docs/research/`: research briefs for later milestones, currently the phone module.
- `docs/examples/`: visual inspiration screenshots, not requirements.

If the work contradicts `docs/SPEC.md`, say so before implementing it. If it contradicts the [Vocabulary](#vocabulary) below, fix the vocabulary first.

## Decisions and assumptions

`docs/SPEC.md` holds the product decisions the user has made. Anything it does not settle is still open, even when a plan, prototype, example screen, or earlier agent output implies an answer. When work depends on an open product or behavior decision, ask the user before building it rather than choosing an answer.

Ask one decision per question, and keep each option's description to that decision; never bundle further choices into a recommended option's fine print. Do not present a recommendation as a decision, and record a decision in `docs/SPEC.md` only after the user confirms it explicitly.

For small implementation choices that do not change what users see or how the product behaves, pick a sensible default and keep going, then list every such choice under an **Assumptions** heading in the final reply so the user can catch preference mismatches early.

## Vocabulary

This is the project's single source of business language. Use these terms exactly in code, docs, UI copy, plans, and conversation. Each concept has one name: never substitute a word from the **Not** column, even for variety. If a concept has no entry, propose one to the user before naming it in code or docs. If the user uses a term in a way that does not match its definition, ask which meaning they intend instead of assuming. If code or docs disagree with this vocabulary, the vocabulary wins until the user changes it. Entries marked *Open* are not settled; do not resolve them silently.

The tables below are generated from `src/lib/glossary/vocabulary.ts`, which also feeds the in-app Glossary view. Edit that file, never the tables, then run `vp run vocabulary`; `vp test src/lib/glossary` fails while they are out of sync. **Belongs to** shows where a term sits in the hierarchy.

<!-- vocabulary:start -->

### Kinds

| Kind | Meaning |
| --- | --- |
| Concept | An idea or rule that shapes the product; it is not stored or shown on its own. |
| Role | A kind of person who uses or supports the workspace. |
| Module | A main area of the app with its own sidebar item. |
| View | Something you navigate to that shows records or tools. |
| Widget | A self-contained block on a dashboard. |
| Record | Something the business stores that opens in its own detail view. |
| Field | A piece of information kept on a record. |
| Value | One of the allowed values of a field, or a part of one. |
| Status | A condition something can be in, such as overdue. |
| Action | Something a person does to a record. |

### Business

| Term | Kind | Belongs to | Meaning | Not |
| --- | --- | --- | --- | --- |
| Business | Concept |  | Meadow Lane Realty & Development: one realtor and one assistant sharing all data. | company, organization, tenant, account |
| User | Role | Business | A person with their own login. The realtor and the assistant are the two business users, and both can see and change every record. | member, seat |
| Realtor | Role | User | The business owner, and the person whose task list tasks land on. | agent (in this repo, an agent is an AI coding agent) |
| Assistant | Role | User | Keeps records organized and creates tasks for the realtor, often by promoting checklist items. | admin |
| Support admin | Role | Business | The developer's own account. It signs in and impersonates either business user to give support, and has no CRM role of its own. | admin user, superuser, owner |
| Impersonate | Action | Support admin | Act as a business user from the support admin account. History records both who acted and who they acted as. | log in as, switch user, sudo |

### Product structure

| Term | Kind | Belongs to | Meaning | Not |
| --- | --- | --- | --- | --- |
| Module | Concept |  | A feature with its own sidebar item. A module owns one or more views. The modules are Dashboard, Pipeline, and Registry. *Open:* Whether a module can be switched off. | section, area, app |
| View | Concept |  | Something a user navigates to that shows records or tools. Most views belong to a module, and a module can have several. A few views belong to no module, such as Settings and the Glossary. | page, screen |
| Integration | Concept |  | A connection to an outside service, such as Google Calendar, with its own authorization and configuration. It builds on an existing module rather than becoming one. Calendar integration is deferred. | plugin, connector, sync |
| Settings | View |  | Configuration, opened from the account menu. Working assumption: panels for User preferences, Business settings, and one per module. *Open:* How Settings is organized. | preferences (as the view's name), admin, config |
| Glossary | View |  | This vocabulary as a searchable, expandable table, opened from the account menu. *Open:* Whether it grows into a help view with tips and FAQs. | reference page (a reference is a link on a record) |

### Record

| Term | Kind | Belongs to | Meaning | Not |
| --- | --- | --- | --- | --- |
| Record | Concept |  | Something the business stores that opens in its own detail view to be read or edited: a client from the Registry, an opportunity from its Pipeline card, a task from Today's Tasks. A record's detail view has a references section and a history section. | entry, object |
| Reference | Field | Record | A link in a record's references section. Its kind sets how it looks: a linked record shown by that record's own name, such as a task's opportunity; a web link, such as a Zillow listing; or an uploaded file, such as a signed contract. Web links and files can be given a friendly name; linked records cannot. Uploads and related records do not get sections of their own; they are references. A promoted task's reference points to its opportunity, and its chip can also show the checklist item. | attachment, dependency, related record |
| History | Field | Record | The saved list of changes to a record: what changed, when, by whom, and as whom when impersonating. Shown in the record's detail view. | audit log, changelog |
| Archive | Action | Record | Hide a client or opportunity from default views while keeping every field, link, and its history; it can be restored. Archiving is how dead work leaves the board; Closed is reserved for completed engagements. | delete, remove, close |
| Delete | Action | Record | Remove a record permanently, as far as users can tell; behind the scenes it may be kept briefly. *Open:* Which records can be deleted, and how. Some delete options will exist in the MVP. | archive |

### Dashboard

| Term | Kind | Belongs to | Meaning | Not |
| --- | --- | --- | --- | --- |
| Dashboard | Module |  | The landing module. For now there are two fixed versions: one for the realtor and one for the assistant. *Open:* Letting users customize their own dashboards later. | home, overview |
| Widget | Concept | Dashboard | A self-contained block on a dashboard, built on `DashboardCard`. | panel, tile |
| Today's Tasks | Widget | Widget | On the realtor's dashboard: incomplete tasks whose date has arrived. An unfinished task rolls over to the next day until it is completed. |  |
| Inbox | Widget | Widget | On the assistant's dashboard: things the assistant should do or check, each linking to its source record. It replaces the earlier idea of a review queue. *Open:* What it lists; overdue tasks are a likely start. | review queue, queue, notifications, messages, attention |

### Pipeline

| Term | Kind | Belongs to | Meaning | Not |
| --- | --- | --- | --- | --- |
| Pipeline | Module |  | The module whose single board moves every opportunity through the stages, whatever its type. | funnel, workflow, kanban (as a name) |
| Opportunity | Record | Pipeline | A prospective engagement, usually with one or more clients; the unit the pipeline tracks. A client is not required. | deal, lead, listing, job, project, transaction |
| Opportunity type | Field | Opportunity | Exactly four, with no "other": Buyer (the client is buying a home), Seller (the client is selling a home), Estate Sale (a referral to the partner company that runs the sale), Construction (work the realtor takes on personally as a side line). Fixed for now but implemented so another type can be added later without a redesign. Changing an opportunity's type is treated as a correction and replaces its checklists with the new type's templates. | category, kind, deal type |
| Stage | Field | Opportunity | A fixed position in the pipeline, in order: New lead (an inquiry not yet worked in depth), Active lead (committed and underway: qualifying, searching, showing, negotiating), Under contract (a signed agreement in force, through due diligence and closing), Closed (the engagement completed). | status, column, phase, step |
| Lead | Value | Stage | Appears only inside the stage names New lead and Active lead. Never call a client or an opportunity "a lead". |  |
| Timeline | Field | Opportunity | The client's stated horizon: 1-3 mo, 3-6 mo, or 6+ mo. Optional; used to prioritize, filter, and sort, never to gate or judge. | urgency, priority, deadline, temperature |
| Checklist | Field | Opportunity | An opportunity's checklist items for one stage. Each stage keeps its own checklist, so returning to a stage shows it as it was left. A checklist starts from its checklist template and keeps following it: template changes reach every opportunity, except items that were added, renamed, removed, or reordered on that opportunity, which keep their local version. *Open:* What happens to tasks promoted from items that a type change replaces. | to-do list, task list |
| Checklist item | Value | Checklist | One line of a checklist. It can be checked off, and giving it a date or a due date promotes it to a task. | step, to-do |
| Promote | Action | Checklist item | Turn a checklist item into a task on the realtor's task list by giving it a date or a due date. Behind the scenes this creates a task linked to the item. The two share one title, and completing, reopening, or deleting either one does the same to the other. When the opportunity moves to another stage, each open task promoted from the current stage's checklist can be completed, deleted, or ignored. *Open:* Keeping the task and item titles in sync is a working assumption. | convert, escalate |
| Checklist template | Concept | Opportunity | The checklist for one opportunity type at one stage, 16 in all, edited in Settings. Editing a template changes the default checklists of every opportunity at that type and stage. | preset |

### Registry

| Term | Kind | Belongs to | Meaning | Not |
| --- | --- | --- | --- | --- |
| Registry | Module |  | The module listing every client. "Client registry" is fine where it reads more clearly. *Open:* The name may change. | client list, contacts, directory |
| Client | Record | Registry | A person the business has a relationship with. A client exists on its own and can take part in several opportunities. | contact, customer, lead, prospect |
| Lead source | Field | Client | Where a client came from: a referral, an open house, a sign, the website, a walk-in. | source tag, channel |
| Tag | Field | Client | A relationship label on a client. An opportunity shows the combined tags of its clients, read-only. | label, category |
| Sphere | Value | Tag | In the realtor's sphere of influence: past clients, friends and family, and their wider network. |  |
| Nurture | Value | Tag | Worth staying in touch with, but not looking to transact now. *Open:* The follow-up behavior built on it, which belongs in the MVP but is not specified yet. |  |
| Referral | Value | Tag | The client was referred to the business. It says how the relationship started, not that the client refers others. |  |
| Retired tag | Status | Tag | A tag that can no longer be applied but stays on existing clients until removed. | archived tag, deleted tag |

### Task

| Term | Kind | Belongs to | Meaning | Not |
| --- | --- | --- | --- | --- |
| Task | Record |  | Work on the realtor's task list. Usually created by the assistant, directly or by promoting a checklist item; the realtor can create tasks too. A task can carry a time, a location, and a repeat, so scheduled things such as showings are tasks. | to-do, reminder, action item, event, appointment |
| Date | Field | Task | When the task starts appearing on the task list. If it is not completed, it rolls over to the next day. |  |
| Due date | Field | Task | The deadline. A task not completed by its due date becomes overdue. | deadline |
| Overdue | Status | Task | A task that is not completed and whose due date is before today in the business's timezone; a promoted checklist item shares its task's status. It is a problem for the realtor who missed it and for the assistant who may need to fix it. | late, urgent, attention |

<!-- vocabulary:end -->
