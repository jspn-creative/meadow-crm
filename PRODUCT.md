# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile web counts as `web`, not a native platform. Nothing here is a native app or a native wrapper around a site.

## Users

One business, two users, and the product does not privilege either of them.

**The business** is Meadow Lane Realty & Development: a solo realtor working with one assistant. Both are real users of the CRM and both hold full access to every part of it.

**The realtor** does the client-facing work — consultations, showings, offers, negotiation, and the personal construction jobs they take on as a side line. Their job in the app is to move work forward and not lose track of it: which deals are live, what is overdue, and who to call back.

**The assistant** is, in practice, the realtor's project manager. Their primary function is keeping him on track by making sure he always has an actionable todo list in front of him. On top of that they record the work, assign it to him, and keep the records true — tags current, checklists accurate, notes written down at the time rather than reconstructed later. Assistants do not have clients of their own.

Neither role is primary. The two users do genuinely different jobs in one place, and surfaces should serve both without treating one as the main case and the other as an afterthought. What the assistant opens the app to do is still an open question in `docs/SPEC.md` (open question 9) — the product has not yet decided whether the two users get the same dashboard.

The realtor is regularly away from a desk, and every surface of the product has to work on a phone. This is not a phone-only feature and not a later milestone; it is a condition of the whole product.

## Product Purpose

A working CRM, not a visual prototype. Every feature ships as real, usable behavior, because the business runs its client and deal work in it.

The client registry and the pipeline are the core. Everything else — the dashboard, the inbox, checklists, tasks, calendar — is a view over that same data rather than a second copy of it, so there is exactly one place a record lives and every surface that shows it points back at it.

Success means the realtor and the assistant stopped keeping their client and deal information somewhere else. Attention comes from real dates and real overdue work surfacing on its own, not from someone updating a status field.

## Positioning

Most CRMs are built for a team with roles, a permission model, and a pipeline an administrator configures. This one is built for two people in one small business who need the work to be legible, not governed.

The mechanism: a small fixed record model with modules the business switches off, and a rule that every extra surface is a projection of the records rather than a new place data is entered. What makes that work is a set of specific refusals — no lead temperature, no probability, no health score, no stage editor, no workflow builder, no role gating, no per-user configuration, and archive as the only exit from the board other than Closed. A neighboring product could adopt the kanban; it could not adopt these refusals without becoming a different product.

Two structural choices carry most of the weight. Checklists are the deal's own steps, are core, and are independent of the optional Tasks module, so the pipeline never depends on an optional module being switched on — and a template is copied onto an opportunity rather than linked, so editing settings can never rewrite work already in progress. And an opportunity inherits the union of its clients' tags instead of owning them, so there is exactly one place to change a relationship label and the board reflects it immediately.

## Operating Context

A solo real estate practice that runs a second kind of work alongside it. The realtor personally takes construction jobs for clients as a side line rather than through a brokerage, and wants that work visible on the same board as everything else rather than tracked separately.

The business works with a local company that coordinates and runs estate sales. Estate Sale opportunities are the referral relationship with that company, not the sale itself — which is why most of them sit in one stage for their whole life, and why that is fine.

Two people share one set of clients, opportunities, and tasks. They are not a team with separate territories or separate clients, and the app has no concept of one user owning a record.

The realtor is often at a listing, a showing, or a meeting rather than at a desk, so the CRM has to be usable in that position and on a phone.

The calendar module is expected to integrate with Google Calendar, but nothing about it is decided — what it does, how it treats connected calendars, and whether it replaces or defers to Google all need discovery before it is specified. There is no research doc for it yet.

References link to documents; the CRM does not store documents. There is no website and no ad spend, so there is nothing to attribute.

The phone module is a later milestone with its own research agenda (`docs/research/phone-module.md`) and has no chosen provider, number, or feature. It exists as a scope boundary, not as a plan.

## Capabilities and Constraints

**Records.** A **Client** is a person recorded independently of any engagement: name, contact details, address, lead source, notes, tags, and timestamps. An **Opportunity** is a prospective engagement and the unit the pipeline tracks: title, type, stage, optional timeline, optional property address, optional budget, associated clients, notes, references, checklist, archived flag. A client can be in many opportunities and an opportunity can involve many clients. Tasks, events, and references are supporting records defined in `docs/CONTEXT.md`.

**Pipeline.** One shared board for every opportunity regardless of type. Exactly four stages, fixed and in order: New lead, Active lead, Under contract, Closed. Stages are labels for progress, not gates — opportunities are created at their real stage, skip stages they are already past, and move backwards when reality changes. A stage change records a decision; it never creates or enforces an agreement and never applies, resets, or duplicates checklist items. Closed means the engagement completed, not that post-close work is finished.

**Opportunity types.** Exactly four, fixed at launch: Buyer, Seller, Estate Sale, Construction. A type drives card color and which default checklist template is offered. It is a filter and a visual distinction, never a separate pipeline, and there is no generic "other" — an engagement that fits none of the four is recorded against the closest fit with a note. Adding a fifth type is a settings change, not a schema redesign.

**Timeline.** Every opportunity carries an optional three-value timeline — 1-3 mo, 3-6 mo, 6+ mo — recording the client's stated horizon. It is shown on the card, used as a board filter and sort, and used to prompt follow-up. It never blocks a stage change and never implies a health judgment.

**Tags.** Clients are tagged; opportunities inherit the union of their clients' tags and show them read-only. The starting vocabulary is sphere, nurture, and referral, extensible in settings. The referral tag records that the client came to the business through a referral — it does not mark a client as a source of referrals. The nurture tag is purely a label; nothing follows from it automatically.

**Archive.** Clients and opportunities can be archived, which hides a record from default views without touching its data: every field, note, link, and history is kept. Archived records are reachable through an explicit filter, can be restored, and never appear on the pipeline board or the default client list. Archiving a client does not archive their opportunities and vice versa. Closed stays reserved for engagements that actually completed.

**Client registry.** A dense, sortable table opening a client in a side panel rather than a modal. Instant keyword search across name, contact details, address, notes, and tags. Filters for tags, lead source, opportunity count, and archived state, with a visible archived toggle. Bulk select to apply tags or archive several clients at once. Each client shows its opportunities inline, so the registry doubles as a way into the pipeline.

**Checklists.** A checklist is the deal's own steps, copied from a checklist template when the user asks for it. Items can be completed, given a due date, renamed, and removed. A dated item past its date is what the card shows as overdue — nothing about that is manual. An opportunity with no checklist is normal. Templates are reset from the defaults in settings, which replaces template content only and never touches live checklists. The 16 default templates (4 types × 4 stages) are seeded in `docs/checklists.md`.

**Modules.** Core and always on: Pipeline, Client registry, Inbox, Dashboard. Optional and switchable: Tasks, Calendar. Later milestones: Phone, Review queue. "Who a user may do" is a separate concern from "which modules exist".

**Inbox.** One flat list of what needs a decision or a reply, drawn from every enabled module — overdue checklist items and tasks, nurture clients gone quiet, opportunities whose timeline has run out, anything in the review queue. It is a view over existing records, never a queue of its own, and each entry opens the record that produced it. Any inbox item converts to a task in one click, prefilled from what the item knows, without leaving the inbox.

**Dashboard.** The landing view, leading with assigned and overdue tasks, today's events, and a short pipeline summary. Every widget is a view over existing records.

**Settings.** One business-wide page, a General section plus one section per module. General holds business name, timezone, currency, date format, and which modules are enabled. Pipeline holds the checklist templates, editable inline with add, rename, reorder, and delete. Client registry holds the tag vocabulary — add, rename, recolor, retire; a tag in use cannot be deleted outright. No feature is ever configured in two places. Anyone can see and edit every section, checklist templates are global, and there are no per-user overrides. Anything needing a migration, a permission model, or a workflow builder is out of settings and needs its own spec.

**Out of scope for the MVP.** A pipeline or stage editor and any workflow builder. A lead temperature, health, or probability field. A second outcome for dead deals beyond archive. Multi-tenancy, self-serve onboarding for other businesses, and billing. Executive reporting, revenue tracking, and marketing attribution. Document upload. Automated stage transitions — a stage changes because a person moved it.

**Explicitly undecided.** Whether an opportunity can be paused with a follow-up date (open question 1). Whether a hard delete ever exists and who may do it (open question 6). Whether anything is automatic after closing (open question 7). Which of calling, logging, recording, transcription, and routing actually matter, and whether the business has a number worth keeping (open question 8). What the assistant's dashboard is (open question 9). Whether the referring party behind a referral tag is itself recorded. Everything about the calendar module, which needs discovery before it is specified.

**Terminology.** `docs/CONTEXT.md` is the glossary and the single source for domain language. When it and `docs/SPEC.md` disagree, CONTEXT is right and SPEC is wrong. A new domain term is introduced per `docs/agents/domain.md`.

**Deployment.** Targets Cloudflare, deploying through the SvelteKit Cloudflare adapter. The adapter is not settled in `package.json` today — it declares `adapter-auto` while `AGENTS.md` describes `@sveltejs/adapter-cloudflare` and a `cf`-based deploy path. Unresolved; resolve it before any deploy, not as a design question. Build, check, and install run through `vp` (Vite+), never `bun`/`npm`/`npx` directly.

**Working state.** The repo is early: a SvelteKit app whose only real route is a gallery of standalone HTML dashboard prototypes under `static/`, plus `static/example.html`. The CRM itself is specified but not built. Treat the prototypes as design exploration, never as product truth or a locked interface.

**Prototype carve-out.** A dashboard developed as a prototype in the `static/` folder does not need to be mobile friendly. Those files are desktop-only comparison artifacts for choosing a direction, and the every-surface-works-on-a-phone requirement does not apply to them. The phone requirement applies to the product as it actually ships, and a prototype only has to earn its place on desktop.

## Brand Commitments

No brand commitments exist yet, and none were made. The business name — Meadow Lane Realty & Development, shortened to Meadow CRM — is the only asset in play; there is no logo, site, print, or signage to match, and the product is free to establish its own visual identity. The favicon in `src/lib/assets/favicon.svg` exists but carries no commitment.

The repo's own writing sets the house voice to imitate: `docs/SPEC.md` and `docs/CONTEXT.md` are plain, specific, and definitive, with no marketing gloss and no superlatives. Product copy should sound like those documents.

## Evidence on Hand

Everything in the repo is invented fixture data. There are no real clients, no real deals, no transaction history, no testimonials, no case studies, no press, no benchmarks, and no usage or analytics data. None of it may be invented to make a surface look more convincing — a surface that needs proof of scale does not get a fake logo wall.

What does exist:

- `docs/SPEC.md` — the MVP requirements, settled decisions, and open questions.
- `docs/CONTEXT.md` — the glossary.
- `docs/checklists.md` — the 16 seed checklist templates, explicitly a starting point meant to be cut down.
- `docs/research/phone-module.md` — a research agenda for the phone module, containing no decisions.
- `docs/examples/` — screenshots kept as visual inspiration, explicitly not requirements.
- `static/example.html`, `static/dashboard-2.html`, and `static/dashboards/*.html` — standalone HTML prototypes being compared. One is titled "User-Provided Example", meaning it came from outside this repo.

## Product Principles

1. **Views, not copies.** Every module, widget, and inbox entry is a projection of existing records, and each links to the record that produced it. Nothing in the app owns a second copy of a client, opportunity, or task, and no two places can disagree about the same work.

2. **Nothing to maintain by hand.** No field exists that a person has to keep current for the app to be useful. No health score, no probability, no lead temperature, no manual "status". Attention comes from real dates and real overdue work, and each relationship label is changed in exactly one place.

3. **Fixed structure, detail in the checklist.** Four stages, four types, three timelines, and no stage or workflow editor. Anything more precise than that is a checklist item, not a column or a schema change.

4. **Reversible by default.** Archive rather than delete, keep every field and every note, make restoration ordinary. No irreversible action, and nothing that would need a permission model.

5. **One shared app, two equal users, and it works in the field.** No role-gated surfaces, no per-user configuration, settings are global, and every surface — not only the future phone module — has to function one-handed on a phone away from a desk.

## Accessibility & Inclusion

No formal conformance standard was set, and none should be invented as a requirement. The confirmed bar is practical: optimize for one-handed phone use in the field, for two people who are not computer specialists. Reachability of primary actions under one thumb, tap-target size, and legibility in outdoor light are the operating assumptions for every shipped surface, desktop included. Desktop-only prototypes under `static/` are exempt — see the prototype carve-out in Capabilities and Constraints.

No other audience need has been established for this product.
