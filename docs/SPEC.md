# Meadow CRM — MVP

A working CRM for Meadow Lane Realty & Development: one realtor and one assistant sharing every record, plus a support admin. It must work on desktop and on phones, because the realtor works away from a desk. Business language is defined in the Vocabulary section of [AGENTS.md](../AGENTS.md#vocabulary), which the app also shows as its Glossary. Default checklist content is in [checklists.md](./checklists.md).

Much of this document was drafted by agents from discussion with the developer, who approved its overall direction but not every detailed behavior. Treat details as the intended direction, not settled decisions: [First release](#first-release) is confirmed, and anything the release depends on that is not confirmed there, or is missing here, is asked about before it is built. Add an answer here only once the developer confirms it.

## First release

Confirmed by the developer on 2026-10-30. The first release ships as soon as possible so the business can use it and give feedback; the rest of this document stays the MVP direction for later work. Work order is in [BACKLOG.md](./BACKLOG.md).

- Tasks ship with title, date, due date, an optional client or opportunity link, create, edit, complete, reopen, delete, rollover, and overdue. Time, location, repeat, checklist promotion, and the stage-move dialog come after the release.
- The realtor, the assistant, and the support admin have logins. The support admin account and impersonation, as described in [People](#people), ship in the release so the developer can see the deployment without signing in as a business user (decided 2026-10-30).
- Uploaded files come after the release; web links and linked records remain.
- The business's real client data is imported as part of the release.
- The release has one shared dashboard of real data: Today's Tasks, Upcoming, and Recent activity. Role-specific dashboards come after the release.
- Advanced Registry features, Settings panels, the checklist template editor, board view options, and other refinements come after the release. Visual redesign is not part of it.
- Every task has a date, when it starts appearing on the realtor's list. A new task's date defaults to today and can be set to a future day; the due date is optional. The release builds this as a basic primitive to iterate on, not the final task shape.
- Checklist items show no date control in the release. Stored item dates and the date code are kept so promotion can build on them later.
- The business timezone is America/Los_Angeles; Settings cannot change it in the release.
- A forgotten password is reset by the developer by hand with a script; there is no reset email or link.
- The production Worker may take over the existing `meadow` Worker's name; it was a prototype.
- The release gate is the developer answering "lgtm ready to deploy?".

## People

- The realtor and the assistant are the two business users. Both can see and change every record.
- The assistant usually creates tasks for the realtor; the realtor can create tasks too. The assistant has no tasks of their own.
- The developer has a support admin account that signs in and impersonates either business user to give support. History records both who acted and who they acted as.
- Login is managed by the app itself.
- Login uses secure HTTP-only cookies, trusted origins, rate-limited attempts, and the same message for every failed login. Every response is private and never cached.
- Logout and password change live in the account menu, apart from business Settings.
- While impersonating, a persistent indicator shows who the support admin is acting as, with an explicit way to switch or exit. Impersonation expires after a short time. The support admin cannot change records without first choosing a business user, and exiting returns to that choice.
- Switching identity clears cached data and revokes the previous identity's access. Business users cannot impersonate, and a request that claims another identity without a valid impersonation is refused.

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
- Widgets show existing records rather than keeping copies, and link to them. Counts are real, and widgets link into filtered views as well as single records.
- Each widget has loading, error, and empty states, and an empty state says what to do next.
- Recent activity's empty state may be playful, such as four milestones from the birth of the universe to today, as long as it never looks like business history.

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
- The board can be filtered by type, timeline, and tag, and sorted by timeline: 1-3 mo, 3-6 mo, 6+ mo, then opportunities without one. A card's type is shown by its label, never by color alone. Type filters are buttons, one per type; selecting several shows opportunities of any selected type, combined with the timeline and tag filters.
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
- A template can be empty. Renaming or reordering a template item keeps the progress opportunities already have on it; a new template item starts unchecked and undated.
- An opportunity's detail view shows a compact strip of the stages it has visited, with each checklist's completion count. Hovering or focusing previews a stage's checklist, and clicking or tapping opens it for inspection with a clear way back to the current stage. Inspecting a stage never moves the opportunity, and the view always distinguishes the stage being inspected from the opportunity's actual stage. Unsaved edits survive moving between stages.
- Giving a checklist item a date or a due date promotes it to a task on the realtor's task list. Behind the scenes this creates a task linked to the item. The task and the item always share one title; renaming either renames both.
- Completing, reopening, or deleting a promoted task does the same to its checklist item, and the other way around.
- A promoted task references its opportunity. Its reference can also show the checklist item.
- Moving an opportunity to another stage while tasks promoted from its current checklist are still open asks what to do with each one: complete it, delete it, or ignore it.

### Registry

- The Registry lists every client in a dense, sortable table. A client opens in a side panel.
- Keyword search is instant and covers name, contact details, address, notes, and tags.
- Filters cover tags, lead source, opportunity count, and archived state, with a visible toggle to include or exclude archived clients.
- Search and filters live in the URL so a view can be shared or bookmarked, along with the archived toggle, sorting, page, and page size. Reloading, Back, and Forward restore the view; invalid values fall back to defaults, and the page resets or clamps when the results change. Typing in search replaces the current history entry rather than adding one per keystroke, and changing a filter adds one. Selections and record content never go in the URL.
- The table has pagination, page size, and the column controls the work actually needs. No export, spreadsheet-style editing, or reporting.
- Several clients can be selected to apply tags or archive them at once. The header checkbox selects the clients currently shown; a "Select all matching clients" link then extends the selection to every match.
- The number of selected clients is shown. Changing search, filters, archived state, sorting, or page clears the selection.
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
- Saving shows that it is in progress. When the network is unavailable, the edit is kept so it can be retried; the app never says a change is saved until the server has saved it.
- Both users' screens stay current: views refresh on navigation and focus, poll while visible, pause while hidden, and recompute dates at the business's midnight. Refreshing never discards an unsaved edit.
- Removing a reference never changes the record it points to. Web links must be http or https. An archived record stays reachable from the references that link to it.
- Archiving an opportunity leaves its tasks on the task list.
- Clients and opportunities can be archived independently. Archiving keeps every field, note, link, and its history, and can be undone from an explicit archived view. Archived opportunities never appear on the board, and archived clients do not appear in the Registry by default.
- Archiving is how dead work leaves the board; Closed is reserved for engagements that were completed.
- A record created by mistake is deleted rather than archived. Clients can be deleted, only from the Registry. Opportunities can be deleted, along with the tasks promoted from their checklists. Tasks can be deleted, and deleting a promoted task deletes its checklist item. Delete options for anything else are settled when that work is built.
- A delete may look permanent to users while being kept briefly behind the scenes.
- Uploaded files are part of the MVP, as references.

## Shell and accessibility

- Collapsing the sidebar keeps the current location, focus, and unsaved edits. In the icon rail every destination stays identifiable and works by touch and keyboard.
- On phones the layout is composed for the phone rather than shrunk from desktop. Wide boards and tables scroll inside themselves, and nothing overflows the page at 375px.
- Fields are labeled, icon controls have accessible names, and focus is always visible. Overlays take focus, return it when closed, and close with Escape. No action depends on hover or drag alone.
- View transitions are short and can be interrupted, never trap navigation or focus, and fall back cleanly when the browser lacks support or reduced motion is set.

## Settings

- Settings are opened from the account menu and have a panel for User preferences, one for Business settings, and one per module.
- Both business users can see and change every business setting, and checklist templates are shared by everyone.
- Business settings include the business name, timezone, and date format. Currency is always USD. The business timezone, not the device's, decides dates and overdue for both users. Invalid values are refused.
- Pipeline settings hold the 16 checklist templates. Template edits are drafted and then saved together, with a note of how many opportunities they reach. When a template item is removed, opportunities where it is checked off or promoted keep it; elsewhere it is removed. The editor's layout will be chosen from prototypes reviewed with the developer. A save that fails validation keeps the draft, and removing an item says how many opportunities it affects before saving.
- Registry settings hold the tag vocabulary: add, rename, recolor, and retire tags. A tag in use cannot be deleted outright; retiring it stops future use and offers to strip it from existing clients. Renaming or recoloring a tag carries through to opportunities; a retired tag still shows on the clients and opportunities that keep it, but cannot be chosen for new ones.
- Registry settings also hold the relationship labels and the address labels, each starting from a provided set.

## Getting data in

The business's real client data will be imported once, with a script the developer runs. There is no in-app import screen. A record for a couple becomes one client holding both people, and a referral tag in the data becomes the client's lead source.

Decided for the first release's import of `docs/client-data.csv` on 2026-10-30:

- Clients only. The CSV's opportunity columns create no opportunities.
- A row marked as a couple becomes one client holding two people, despite the CSV's note to split it into two clients.
- Columns with no field, such as beds, baths, area preference, property type preference, budget, the old CRM's status, source, and hashtags, and legacy second phone, second email, and spouse details, go into a read-only "Imported data" field on the client rather than its notes. The client's detail view shows it compactly. The import reports how often each column is filled; the developer and the business decide which deserve fields of their own, and the field is then dropped. It is temporary, so it has no Vocabulary entry.
- Unknown email consent imports as email on; do-not-contact turns every channel off.
- Lead-relay emails (kvleads.com forwarding addresses) are dropped. A client left with no email, phone, or address is not imported; one with only a mailing address is kept.
- Rows the CSV marks as test records are not imported.

## Technical direction

How the app is built so far; change it only with a reason the developer agrees to.

- SvelteKit on Cloudflare, with D1 through Drizzle and a relational schema. Money is stored as integer USD cents; notes are plain text.
- Reads use remote `query` functions, forms use remote `form`, and other changes use remote `command`, each validated with Standard Schema against request-scoped data and identity services. A change refreshes the affected queries in the same request. No duplicate REST API, generic form framework, or shared mutable server state.
- Saves carry stable IDs, revisions, and request IDs so retries are safe; multi-row changes use conditioned D1 batches rather than interactive transactions.
- Remote queries own confirmed state. TanStack DB was tried and removed; do not reintroduce client collections or offline promises.
- Login uses Better Auth with its Drizzle adapter and interactive transactions disabled; impersonation will use its admin plugin, verified on the server.
- Route changes use native View Transitions and ordinary feedback uses CSS, with one animation owner per property.

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

### Before or during the first release

None remain; the answers are in [First release](#first-release).

### Tasks, Registry, and files

- How a task's time, location, and repeat behave, which needs discovery before it is built.
- Task shape, for an exploration session after the release. The developer's notes from 2026-10-30: a task's date is when it starts appearing on the realtor's list, defaulting to today and schedulable for a future day; it is unclear whether a date and an optional due date are enough for most of a realtor's needs. A seven-day view of the week has to show a task spanning its date to its due date without looking like a task that repeats every day in each day's column. A backlog of unscheduled work is appealing, but it is open whether it holds tasks with no date or tasks with a dedicated status. The earlier plan let a standalone task have no date and showed it among open tasks without an overdue indicator.
- How checklist item dates return with promotion: the release hides them, and promotion (see [Checklists](#checklists)) should reuse the stored dates and the item date code rather than replace them.
- Whether the Registry's opportunity-count filter counts archived opportunities. The earlier plan proposed counting every linked opportunity and saying so.
- Size, type, retention, and deletion rules for uploaded files.

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
