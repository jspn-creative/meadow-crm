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

The modules are Dashboard, Pipeline, and Registry, each with its own sidebar item. None of them can be switched off; later modules may be optional. Tasks cannot be switched off either. Settings and the Glossary are views that belong to no module, opened from the account menu.

### Dashboard

- There are two fixed versions for now: one for the realtor and one for the assistant.
- The realtor's dashboard has Today's Tasks (incomplete tasks whose date has arrived), Upcoming, and Key dates.
- The assistant's dashboard has the Inbox, Realtor's day, Upcoming, Pipeline summary, and Recent activity.
- The Inbox lists things the assistant should do or check, each linking to its record: overdue tasks, and clients, opportunities, and tasks the realtor created. An overdue task leaves the Inbox once it is no longer overdue; a record the realtor created stays until the assistant marks it done.
- Realtor's day shows the realtor's Today's Tasks on the assistant's dashboard. The assistant can edit them there, but the widget is locked against accidental edits until deliberately unlocked.
- Upcoming shows the realtor's tasks whose date or due date falls in the next several days.
- Key dates shows clients' birthdays and key dates coming up in the next few weeks.
- Pipeline summary counts opportunities per stage and links to the board.
- Recent activity lists the latest changes across records, drawn from their history.
- Widgets show existing records rather than keeping copies, and link to them.

### Pipeline

- One board holds every opportunity, whatever its type. Type distinguishes the cards and selects checklist templates; it never splits the board.
- The stages are fixed, in order: New lead, Active lead, Under contract, Closed.
- Stages describe progress; they are not gates. An opportunity is created at its real stage, can skip stages, and can move backwards. A stage changes only when a person moves it.
- A contract that falls through with the client still engaged returns the opportunity to Active lead. When the client is gone, the opportunity is archived. Closed means the engagement was completed; outstanding checklist items can remain.
- The types are Buyer, Seller, Estate Sale, and Construction, with no "other". An engagement that fits none is recorded against the closest type with a note. Types are fixed for now, but implemented so another type can be added later without a redesign.
- An opportunity's type is chosen when it is created and never changes. An opportunity created with the wrong type is deleted and created again.
- An Estate Sale opportunity is a referral relationship and may sit in one stage its whole life. Construction work stays on the same board so the realtor's side work is visible alongside everything else.
- An opportunity has a title, type, stage, optional timeline, optional property address, optional budget or target price in USD, its clients, notes, references, checklists, and an archive state.
- The title is what the business calls the work: "Miller home search" until a property is picked, then the address.
- A client is not required.
- The timeline (1-3 mo, 3-6 mo, 6+ mo) is shown on the card and used to filter and sort. It never blocks a stage change or judges an opportunity.
- An opportunity shows the combined tags of its clients, read-only. Tags are edited on the client.
- The board can be filtered by type, timeline, and tag, and sorted by timeline. Type filters are buttons, one per type; selecting several shows opportunities of any selected type, combined with the timeline and tag filters.
- Each stage's column can be collapsed. The choice lasts for the browser session; a new session starts with just enough columns collapsed, rightmost first, to keep every column visible. When expanded columns overflow the board, its scrolling edges fade.
- A pinned opportunity stays at the top of its stage's column for both users until someone unpins it.
- An opportunity can be bookmarked from its detail view. Bookmarks are a stack in the sidebar, kept per user in the browser and removed only by that user; clicking the stack fans it out, choosing one opens that opportunity, and clicking elsewhere closes the fan.
- A card always shows its title, type, and timeline. It can also show client names, checklist progress for the current stage, an overdue marker when a task linked to the opportunity is overdue, and the budget or target price. Which of these appear is chosen in the board's view options, a discreet panel saved in the user's browser; losing that choice is acceptable. The card design and its options settle over several rounds of review with the developer.
- Opening an opportunity shows its details, with its checklist in a sidebar beside them. Each detail and the references can be added or changed in place, and the full editor stays available as a second way to edit.

### Checklists

Checklists belong to the Pipeline. They are rough guidelines for each stage, not a separate module.

- Each stage of an opportunity has its own checklist, which starts from that type and stage's checklist template. Returning to a stage shows its checklist as it was left.
- Template changes made in Settings reach every opportunity's checklist at that type and stage. Items that were added, renamed, removed, or reordered on one opportunity keep their local version.
- Anyone can add, remove, rename, and reorder items on one opportunity's checklist without touching the template.
- There is no "Reset to template" action for now.
- Giving a checklist item a date or a due date promotes it to a task on the realtor's task list. Behind the scenes this creates a task linked to the item. The task and the item always share one title; renaming either renames both.
- Completing, reopening, or deleting a promoted task does the same to its checklist item, and the other way around.
- A promoted task references its opportunity. Its reference can also show the checklist item.
- Moving an opportunity to another stage while tasks promoted from its current checklist are still open asks what to do with each one: complete it, delete it, or ignore it.

### Registry

- The Registry lists every client in a dense, sortable table. A client opens in a side panel.
- Keyword search is instant and covers name, contact details, address, notes, and tags.
- Filters cover tags, lead source, opportunity count, and archived state, with a visible toggle to include or exclude archived clients.
- Search and filters live in the URL so a view can be shared or bookmarked.
- Several clients can be selected to apply tags or archive them at once. The header checkbox selects the clients currently shown; a "Select all matching clients" link then extends the selection to every match.
- A bulk change applies to every selected client it can, then says which clients were skipped and why. An Undo action shown right after the change reverses the whole change at once. Each client's history records both the change and its undo.
- A client can be deleted, and only from the Registry. Before deleting, a notice lists the client's opportunities, each with a choice to delete it, archive it, or leave it alone, and the tasks linked directly to the client, each with a choice to delete it or leave it alone. Whatever is left alone loses its link to the client.
- Each client shows their opportunities inline, so the Registry is also a way into the Pipeline.
- A client is a person, or several people such as a married couple, whom the business treats as one relationship. Each person has a name, a birthday, and any number of labeled phone numbers and email addresses.
- A client has its people, any number of addresses, a lead source, Referred by, relationships, key dates, preferences, consent, a preferred contact method, notes, tags, created and updated timestamps, and an archive state. These fields are meant to give later features, such as nurture follow-ups, referral tracking, and Phone, the data they need.
- An address can be of any kind, whether or not the client owns it. Each has a label and a marker for whether the client owns it.
- Referred by is either an existing client, linked, or a typed name when the referrer is not a client, such as a lender or another agent.
- A relationship is a labeled link between two clients, such as parent, sibling, or colleague.
- A key date is a named custom date, such as a wedding anniversary or a home purchase.
- Preferences is free text on how to treat the client, including how to address them. Later it may give AI features context, and AI may suggest additions to it.
- Consent records, for the whole client, whether they may be contacted by call, text, email, and mail. It is on for every client by default, because there are no promotional automations; the assistant turns channels off where needed, and turning all of them off marks the client as not to be contacted. It is shaped so it can later hold preferences for different kinds of communication on each channel.
- Lead source is a field set when the client is created, and it can be filtered.
- Tags say where a client stands with the business. The starting tags are sphere and nurture. How a client came to the business is recorded by lead source and Referred by, not a tag. Nurture is a label; follow-up behavior built on it is not part of the MVP and will be decided once the MVP has been tested.

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
- A saved change appears immediately and rolls back with a message if saving fails. If someone else changed the record first, the later save is refused and the screen shows their version so the edit can be redone.
- Clients and opportunities can be archived independently. Archiving keeps every field, note, link, and its history, and can be undone from an explicit archived view. Archived opportunities never appear on the board, and archived clients do not appear in the Registry by default.
- Archiving is how dead work leaves the board; Closed is reserved for engagements that were completed.
- A record created by mistake is deleted rather than archived. Clients can be deleted, only from the Registry. Opportunities can be deleted, along with the tasks promoted from their checklists. Tasks can be deleted, and deleting a promoted task deletes its checklist item. Delete options for anything else are settled when that work is built.
- A delete may look permanent to users while being kept briefly behind the scenes.
- Uploaded files are part of the MVP, as references.

## Settings

- Settings are opened from the account menu and have a panel for User preferences, one for Business settings, and one per module.
- Both business users can see and change every business setting, and checklist templates are shared by everyone.
- Business settings include the business name, timezone, and date format. Currency is always USD.
- Pipeline settings hold the 16 checklist templates. Template edits are drafted and then saved together, with a note of how many opportunities they reach. When a template item is removed, opportunities where it is checked off or promoted keep it; elsewhere it is removed. The editor's layout will be chosen from prototypes reviewed with the developer.
- Registry settings hold the tag vocabulary: add, rename, recolor, and retire tags. A tag in use cannot be deleted outright; retiring it stops future use and offers to strip it from existing clients.
- Registry settings also hold the relationship labels and the address labels, each starting from a provided set.

## Getting data in

The business's real client data will be imported once, with a script the developer runs. There is no in-app import screen. A record for a couple becomes one client holding both people, and a referral tag in the data becomes the client's lead source.

## Not in the MVP

- Pipeline, stage, or type editors, and workflow builders.
- Temperature, health, or probability fields on opportunities; what needs doing comes from real due dates.
- An outcome for dead work other than archiving.
- Multi-tenancy, self-serve onboarding, and billing.
- Executive reporting, revenue tracking, and marketing attribution.
- Automatic stage changes.
- Dashboards that users customize themselves. They may come later.
- Nurture follow-ups and timeline follow-ups, until the MVP has been tested.
- Automatic steps after closing, such as review requests or retention reminders. The Closed checklists can hold those steps.
- Pausing an opportunity until a follow-up date. A dated task covers waiting on a lender, appraisal, or repair.
- A help view with tips and FAQs; the Glossary stays the vocabulary.
- A calendar view, and calendar integration such as Google Calendar.
- Phone, which is a later milestone with its own research in [research/phone-module.md](./research/phone-module.md).

## Open questions

Do not resolve these without the developer.

### Checklists

- The checklist template editor's layout, to be chosen from prototypes reviewed with the developer.

### Dashboards and the Inbox

- Whether the assistant's dashboard combines Realtor's day and Upcoming into a full-width planner, where open work from opportunities can be dragged onto the realtor's schedule, possibly with recommendations. This is a design exploration that needs several rounds with the developer.

### Pipeline

- The opportunity card's design and the options in the board's view options, settled over several rounds of review with the developer.

### Later discovery

- Nurture follow-ups, decided once the MVP has been tested. The developer leans toward an interval set per tag.
- Timeline follow-ups, such as a prompt when a 1-3 mo opportunity sits in New lead, decided with nurture follow-ups.
- Whether anything should happen automatically after closing, decided with nurture follow-ups.
- Whether waiting on a lender, appraisal, or repair needs a pause after all, revisited once the MVP has been tested.
- Whether the Glossary grows into a help view with tips and FAQs.
- What Phone covers: calling, logging, recording, transcription, routing, and whether the realtor brings an existing number and provider.
