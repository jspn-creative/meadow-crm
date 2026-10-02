# Meadow CRM — Product Spec

The MVP specification for the CRM used by Meadow Lane Realty & Development: a solo realtor working with an assistant. It describes what the app is, what it does, and what it deliberately does not do. The seed checklist content lives in [checklists.md](./checklists.md); domain vocabulary lives in [CONTEXT.md](./CONTEXT.md).

This document is requirements. The vocabulary it uses is defined in [CONTEXT.md](./CONTEXT.md), which is the single source for terms like `Client`, `Stage`, and `Archive`. When the two disagree on a definition, CONTEXT wins and this document is wrong.

## Product direction

- A working CRM, not a visual prototype. Every feature described here ships as real, usable behavior.
- One business, two users — the realtor and the assistant — sharing a single set of clients, opportunities, and tasks.
- The client registry and the pipeline are the core of the app. Everything else presents that same data rather than owning a copy.
- Modularity means built-in modules that the business can switch off. Who a user may do is a separate concern from which modules exist.
- Scope is settled. Where something is genuinely unknown it appears in [Open questions](#open-questions) rather than being designed around.

## Records

### Client

A person recorded in the CRM, independent of any engagement. Fields: name, contact details, address, lead source, notes, tags, and a created/updated timestamp. A client can take part in many opportunities, and one opportunity can involve many clients.

### Opportunity

A prospective engagement, and the unit the pipeline tracks. Fields: title, type, stage, timeline, property address (optional — a buyer may have no home selected yet), budget or target price (optional), associated clients, notes, references, checklist, and an archived flag.

The title is what the business calls the work: `Miller home search` until a property is picked, then the address. A property is not required.

### Supporting records

Tasks, events, references, and checklist items are defined in [CONTEXT.md](./CONTEXT.md) and described in the module sections below.

## Pipeline

One shared board. Every opportunity is on it, regardless of type; type is a filter and a visual distinction, not a separate pipeline.

The stages, types, timeline values, and tags are defined in [CONTEXT.md](./CONTEXT.md). This section is how they behave.

### Stages

- Stages are labels for progress, not gates. Opportunities are created at their real stage, skip stages when they are already past them, and move backwards when reality changes.
- A contract that falls through with the client still engaged returns the same opportunity to Active lead. When the client is gone, archive the opportunity and keep the history.
- A stage change records a decision. It does not create, enforce, or end a legal agreement, and it never applies, resets, or duplicates checklist items.
- Closed means the engagement completed, not that post-close work is finished. Outstanding items can remain on a closed opportunity.

### Opportunity types

Four types, fixed at launch: **Buyer**, **Seller**, **Estate Sale**, and **Construction**. The type drives the card color and which default checklist template is offered; it does not change the stages or create separate boards.

An engagement that does not fit cleanly is recorded against the closest of the four, with a note. Adding a fifth type is a settings change, not a schema redesign.

The four types do not weigh the same. An Estate Sale opportunity is a referral relationship, and gets little benefit from the kanban stages; most of them will sit in one stage for their whole life, which is fine. A Construction opportunity stays on the same board as everything else, because the owner wants his side work visible alongside the rest.

### Timeline

Every opportunity carries an optional timeline. It records the client's stated horizon and is shown on the card, used as a board filter and sort, and used to prompt follow-up when a 1-3 mo opportunity sits in New lead. It never blocks a stage change and never implies a health judgment.

### Tags

Clients are tagged. An opportunity **inherits** the union of the tags of its associated clients and shows them read-only; tags are edited on the client, not on the opportunity. Removing a tag from a client updates every opportunity that inherited it.

The vocabulary starts with sphere, nurture, and referral, and is extensible in settings. Their meanings are in [CONTEXT.md](./CONTEXT.md).

### Archive

Clients and opportunities can be archived. Archiving hides a record from the default views without touching its data: it keeps every field, every note, every link to the other record type, and its full history. Archived records are reachable through an explicit archived filter, can be restored, and are never shown on the pipeline board or in the default client list.

Archiving is how dead work leaves the board. A seller who withdraws, a buyer who goes elsewhere, a project that dies: archive the opportunity with a closing note, keep the clients, and start a new opportunity later if the client comes back. Closed stays reserved for engagements that actually completed.

## Client registry

The searchable, comprehensive list of every client the business knows.

- A dense table view with sortable columns, opening a client in a side panel rather than a modal.
- Instant keyword search across name, contact details, address, notes, and tags.
- Filters for tags, lead source, opportunity count, and archived state; a visible toggle that includes or excludes archived clients.
- Bulk select to apply tags or archive several clients at once.
- Each client shows its opportunities inline, so the registry doubles as a way into the pipeline.
- Archiving a client does not archive their opportunities, and archiving an opportunity does not archive the client. Both are independent, reversible actions.

## Modules

### Pipeline (core, always on)

The kanban board, opportunity records, checklists, tags, and the timeline. This is the app. Its settings hold the checklist templates.

### Client registry (core, always on)

The registry described above.

### Tasks (optional)

Work the assistant records and assigns to the realtor. A task can reference a client, opportunity, or event, or stand on its own. The realtor sees their assigned and overdue tasks on the dashboard next to upcoming events. Assistants do not hold tasks of their own in the MVP. Checklists are not tasks and remain available when this module is off.

### Inbox (core, always on)

One flat list of what needs a decision or a reply, drawn from every enabled module: overdue checklist items and tasks, clients tagged nurture that have gone quiet, opportunities whose timeline has run out, and anything waiting in the review queue. It is a view over existing records, never a queue of its own, and each entry opens the record that produced it.

Any inbox item converts to a task in one click: a single action turns the item into a small task form for the realtor, prefilled from what the item knows, without leaving the inbox.

### Calendar (optional, needs discovery)

A module for appointments and events, expected to integrate with Google Calendar. Nothing about its scope is decided — what the module does, how it treats connected calendars, and whether it replaces or defers to Google all need discovery before it is specified. There is no research doc for it yet.

### Dashboard (core, always on)

The landing view. The realtor's dashboard leads with assigned and overdue tasks, today's events, and a short pipeline summary. What the assistant opens the app to do is undecided; see open question 9. Every widget is a view over existing records, not a copy of them.

### Phone (later milestone)

Call logging and outbound calling, on its own milestone with its own research. See [research/phone-module.md](./research/phone-module.md).

### Review queue (later milestone)

A human decision point for incoming and automatically suggested records, arriving with the phone module or any other automated intake. Until something automated produces records, there is nothing for it to hold.

## Settings

One settings page, business-wide, structured into a **General** section and one section per module. No feature is ever configured in two places.

- **General:** business name, timezone, currency, date format, and which modules are enabled or disabled.
- **Pipeline module:** the default checklist template for every combination of opportunity type and stage, editable inline with add, rename, reorder, and delete. See [checklists.md](./checklists.md).
- **Client registry module:** the tag vocabulary, which lives here because clients own the tags — add, rename, recolor, and retire. A tag in use cannot be deleted outright; retiring it stops future use and offers to strip it from existing records.
- **Per-module configuration:** each optional module owns its own settings section.

Anyone can see and edit settings, and checklist template changes are global — a template edited by one user changes it for everyone.

Anything that would need a migration, a permission model, or a workflow builder is out of settings and needs its own spec.

## Milestones

1. **Core CRM** — clients, opportunities, pipeline, checklists, tags, tasks, inbox, dashboard, settings. This spec.
2. **Phone** — call logging and calling, preceded by its own research.
3. **Later candidates** — the calendar module once it has had its own discovery, review requests and reputation workflows, Google Business Profile, nurture campaigns, reporting. None are committed; each needs its own research and spec.

## Out of scope for the MVP

- A pipeline or stage editor, and any workflow builder. Stages and types are fixed; templates and configuration live in settings.
- A lead temperature, health, or probability field. Attention comes from real dates and real overdue work, not from a maintained status.
- A second outcome for dead deals beyond archive.
- Multi-tenancy, self-serve onboarding for other businesses, and a billing model.
- Executive reporting, revenue tracking, and marketing attribution. The app has no website or ad spend to attribute.
- Document upload. References link to documents; they do not store them.
- Automated stage transitions. A stage changes because a person moved it.

## Settled decisions

Short record of choices already made, so they are not relitigated while implementing.

- **One shared board with four fixed stages**, rather than separate buyer and seller pipelines or six descriptive stages. Four stages cover the real work; anything more precise is a checklist, not a column.
- **Archiving is the only exit from the board** other than Closed, replacing a separate "ended without completion" status. One mechanism instead of three overlapping ones.
- **Types are a dimension, not a pipeline.** Four types color the cards and select a checklist; they never fork the board.
- **Checklists are core and separate from tasks.** A checklist is the deal's own steps, copied from a template; a task is work the assistant assigns to the realtor. Keeping them apart means the pipeline never depends on the Tasks module being on.
- **Templates are copied, not linked.** Editing a template in settings never rewrites the checklist of an opportunity already in progress.
- **Opportunities inherit client tags rather than owning them.** There is one place to change a relationship label, and the board reflects it immediately.
- **Urgency is a three-value timeline, not a date or a probability.** Enough structure to sort and prompt, not enough to be maintained wrongly.

## Open questions

Gaps to resolve with the business before or during the work they touch. Answered items keep their question and record the current direction beneath it; those answers are already reflected in the body of this spec.

1. **Pause.** Waiting on a lender, an appraisal, or a repair agreement is normal and should not move an opportunity backwards. Should an opportunity be pausable with a follow-up date, or is the timeline plus checklist enough to cover waiting? — *Unanswered.*
2. **Lead source.** Should where a client came from (referral partner, open house, sign, website, walk-in) be a field, a tag, or free text on the client? — *Answered: a field on the client.* Lead source is a metadata field in the client record, not a tag and not free text in notes. It is set when the client is created and is filterable in the registry.
3. **Referral direction.** Does the referral tag mean "this client was referred to us", "this client refers others", or both? If the second, a referral link between two clients may be needed. — *Answered: referred to us.* The referral tag records that the client came to the business through a referral. It does not mark a client as a source of referrals, and no referral link between clients is needed. Whether the referring party is itself recorded is still undecided.
4. **Nurture cadence.** Does the nurture tag imply an expected follow-up rhythm the CRM should prompt, or is it purely a label for now? — *Answered: purely a label for now.* Nothing follows from the nurture tag automatically; the inbox surfaces quiet nurture clients, and that is all.
5. **Settings access.** Both users can see settings, or only the realtor can change them? And are checklist templates global or editable per user? — *Answered: anyone can see and edit, and templates are global.* Both users have full access to every settings section, and a checklist template edited by either user changes for everyone. There are no per-user template overrides.
6. **Archive versus delete.** Is there any case for a hard delete (a duplicate, a test record, a data-import error), and who may do it? — *Unanswered.*
7. **Closed and post-close work.** Should anything be automatic after closing — a review request, a retention reminder — or is that left to the checklist and the assistant entirely? — *Unanswered.*
8. **Phone boundary.** Which of calling, logging, recording, transcription, and routing actually matters, and does the realtor bring an existing number and provider? See the research brief. — *Unanswered.*
9. **The assistant's dashboard.** Assistants assign tasks and keep records tidy, but nothing is specified for what the assistant opens the app to do. Is it the same set of widgets, a different set, or no dashboard at all? — *Unanswered.*