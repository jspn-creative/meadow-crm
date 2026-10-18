# Meadow CRM — MVP

A working CRM for Meadow Lane Realty & Development: one realtor and one assistant sharing every record, plus a support admin. It must work on desktop and on phones, because the realtor works away from a desk. Business language is defined in the Vocabulary section of [AGENTS.md](../AGENTS.md#vocabulary), which the app also shows as its Glossary. Default checklist content is in [checklists.md](./checklists.md).

Everything outside [Open questions](#open-questions) has been confirmed by the developer. Anything this document does not cover is undecided: ask before building on it, and add the answer here only once the developer confirms it.

## People

- The realtor and the assistant are the two business users. Both can see and change every record.
- The assistant usually creates tasks for the realtor; the realtor can create tasks too. The assistant has no tasks of their own.
- The developer has a support admin account that signs in and impersonates either business user to give support. History records both who acted and who they acted as.
- Login is managed by the app itself.

## Look

The business chose [Quiet Cream](../static/dashboards/04-quiet-cream.html) as the visual starting point. Example screens and prototypes are design references only: they never imply a feature.

## Modules

The modules are Dashboard, Pipeline, and Registry, each with its own sidebar item. Settings and the Glossary are views that belong to no module, opened from the account menu.

### Dashboard

- There are two fixed versions for now: one for the realtor and one for the assistant.
- The realtor's dashboard has a Today's Tasks widget: incomplete tasks whose date has arrived.
- The assistant's dashboard has the Inbox widget: things the assistant should do or check, each linking to its source record.
- Widgets show existing records rather than keeping copies, and link to them.

### Pipeline

- One board holds every opportunity, whatever its type. Type distinguishes the cards and selects checklist templates; it never splits the board.
- The stages are fixed, in order: New lead, Active lead, Under contract, Closed.
- Stages describe progress; they are not gates. An opportunity is created at its real stage, can skip stages, and can move backwards. A stage changes only when a person moves it.
- A contract that falls through with the client still engaged returns the opportunity to Active lead. When the client is gone, the opportunity is archived. Closed means the engagement was completed; outstanding checklist items can remain.
- The types are Buyer, Seller, Estate Sale, and Construction, with no "other". An engagement that fits none is recorded against the closest type with a note. Types are fixed for now, but implemented so another type can be added later without a redesign.
- An Estate Sale opportunity is a referral relationship and may sit in one stage its whole life. Construction work stays on the same board so the realtor's side work is visible alongside everything else.
- An opportunity has a title, type, stage, optional timeline, optional property address, optional budget or target price in USD, its clients, notes, references, checklists, and an archive state.
- The title is what the business calls the work: "Miller home search" until a property is picked, then the address.
- A client is not required.
- The timeline (1-3 mo, 3-6 mo, 6+ mo) is shown on the card and used to filter and sort. It never blocks a stage change or judges an opportunity.
- An opportunity shows the combined tags of its clients, read-only. Tags are edited on the client.
- The board can be filtered by type and timeline, and sorted by timeline.
- Opening an opportunity shows its details, with its checklist in a sidebar beside them.

### Checklists

Checklists belong to the Pipeline. They are rough guidelines for each stage, not a separate module.

- Each stage of an opportunity has its own checklist, which starts from that type and stage's checklist template. Returning to a stage shows its checklist as it was left.
- Template changes made in Settings reach every opportunity's checklist at that type and stage. Items that were added, renamed, removed, or reordered on one opportunity keep their local version.
- Anyone can add, remove, rename, and reorder items on one opportunity's checklist without touching the template.
- There is no "Reset to template" action for now.
- Changing an opportunity's type is treated as correcting a mistake, so its checklists are replaced with the new type's templates.
- Giving a checklist item a date or a due date promotes it to a task on the realtor's task list. Behind the scenes this creates a task linked to the item.
- Completing, reopening, or deleting a promoted task does the same to its checklist item, and the other way around.
- A promoted task references its opportunity. Its reference can also show the checklist item.
- Moving an opportunity to another stage while tasks promoted from its current checklist are still open asks what to do with each one: complete it, delete it, or ignore it.

### Registry

- The Registry lists every client in a dense, sortable table. A client opens in a side panel.
- Keyword search is instant and covers name, contact details, address, notes, and tags.
- Filters cover tags, lead source, opportunity count, and archived state, with a visible toggle to include or exclude archived clients.
- Search and filters live in the URL so a view can be shared or bookmarked.
- Several clients can be selected to apply tags or archive them at once. The header checkbox selects the clients currently shown; a "Select all matching clients" link then extends the selection to every match.
- Each client shows their opportunities inline, so the Registry is also a way into the Pipeline.
- A client has a name, contact details, address, lead source, notes, tags, created and updated timestamps, and an archive state.
- Lead source is a field set when the client is created, and it can be filtered.
- Tags describe relationships. The starting tags are sphere, nurture, and referral. Referral means the client was referred to the business, not that they refer others. Nurture is a label; the follow-up behavior built on it is an open question.

## Tasks

- Tasks are work on the realtor's task list. A task can stand alone or link to a client or an opportunity.
- A task's date is when it starts appearing on the task list. If it is not completed, it rolls over to the next day.
- A task's due date is its deadline. An incomplete task whose due date is before today, in the business's timezone, is overdue. That is a problem for the realtor who missed it and for the assistant who may need to fix it.
- A task can carry a time, a location, and a repeat, so scheduled things such as showings are tasks. There are no separate events.
- Tasks and checklists are separate; a checklist item becomes a task only when promoted.

## Records

- Clients, opportunities, and tasks are records. Each opens in its own detail view with a references section and a history section.
- A reference is a linked record, a web link, or an uploaded file. Its kind sets how it looks. Web links and files can be given a friendly name; a linked record shows its own name. Related records and uploads live in the references section rather than in sections of their own.
- History records what changed, when, by whom, and as whom when impersonating.
- Clients and opportunities can be archived independently. Archiving keeps every field, note, link, and its history, and can be undone from an explicit archived view. Archived opportunities never appear on the board, and archived clients do not appear in the Registry by default.
- Archiving is how dead work leaves the board; Closed is reserved for engagements that were completed.
- Some delete options will exist in the MVP. A delete may look permanent to users while being kept briefly behind the scenes.

## Settings

- Settings are opened from the account menu. Both business users can see and change every business setting, and checklist templates are shared by everyone.
- Business settings include the business name, timezone, and date format. Currency is always USD.
- Pipeline settings hold the 16 checklist templates.
- Registry settings hold the tag vocabulary: add, rename, recolor, and retire tags. A tag in use cannot be deleted outright; retiring it stops future use and offers to strip it from existing clients.

## Getting data in

The business's real client data will be imported once, with a script the developer runs. There is no in-app import screen.

## Not in the MVP

- Pipeline, stage, or type editors, and workflow builders.
- Temperature, health, or probability fields on opportunities; what needs doing comes from real due dates.
- An outcome for dead work other than archiving.
- Multi-tenancy, self-serve onboarding, and billing.
- Executive reporting, revenue tracking, and marketing attribution.
- Automatic stage changes.
- A calendar view, and calendar integration such as Google Calendar.
- Phone, which is a later milestone with its own research in [research/phone-module.md](./research/phone-module.md).

## Open questions

Do not resolve these without the developer.

### Checklists and tasks

- How the checklist template editor in Settings works. It needs deliberate design and is the biggest piece of the checklist work.
- Whether someone can look at an earlier stage's checklist from the opportunity without moving it.
- What happens to tasks promoted from checklist items that a type change replaces.
- Whether a promoted task and its checklist item always share one title. The working assumption is yes.
- Whether Tasks can be switched off.

### Dashboards and the Inbox

- What the Inbox lists. Overdue tasks are a likely start.
- What else each dashboard shows. The realtor's dashboard has also had a pipeline summary, Recent activity, and Upcoming events; Upcoming events needs rethinking now that events are tasks.
- Letting users customize their own dashboards later.

### Pipeline and Registry

- What an opportunity card shows beyond its title, type, and timeline, such as checklist progress, and whether the board can be filtered by tag.
- Nurture follow-ups: part of the MVP, but not specified yet.
- Timeline follow-ups, such as a prompt when a 1-3 mo opportunity sits in New lead: deferred and not specified.
- What happens when a bulk change in the Registry cannot apply to some selected clients: change nothing, or change the rest.
- Whether a change should appear immediately and roll back with a message if saving fails or someone else changed the record first. This is how saving works today.
- Whether "Registry" stays the module's name.

### Settings and records

- How Settings is organized. The working assumption is panels for User preferences, Business settings, and one per module.
- Whether modules can be switched off.
- Which records can be deleted, and how.
- Whether file uploads are in the MVP.

### Later discovery

- Whether waiting on a lender, appraisal, or repair needs a pause with a follow-up date, or whether the timeline and checklist cover it.
- Whether the party who referred a client should be recorded.
- Whether anything should happen automatically after closing, such as a review request or a retention reminder.
- What Phone covers: calling, logging, recording, transcription, routing, and whether the realtor brings an existing number and provider.
