# Requirements

A working CRM for Meadow Lane Realty & Development, replacing scattered client and engagement tracking. Business language is in the Vocabulary section of [AGENTS.md](../AGENTS.md#vocabulary), which the app also shows as its Glossary. Default checklist content is in [checklists.md](./misc/checklists.md).

The developer confirmed every requirement here on 2026-11-05. A requirement marked `(proposed)` is an idea the developer hasn't committed to. Add or confirm an answer only once the developer does.

## Product

- **Platform:** web, on desktop and mobile browsers, not a native app.
- **Users:** one realtor and one assistant with equal access to shared records, plus a separately provisioned support admin acting through either business identity. The assistant keeps work organized and assigns tasks to the realtor.
- **Operating context:** the realtor works away from a desk, so shipped workflows must work on phones. The business also refers estate sales to a partner and takes personal construction jobs.
- **Positioning:** a small-business workspace: one shared pipeline, fixed stages, reversible archiving, no scoring or workflow builder. Every surface projects the same records.
- **Principles:** shared records, not copies. Real dates, not hand-maintained urgency. Checklists, not more pipeline columns. Archive, not irreversible deletion. Two equal users, with phone-usable workflows. No feature commitments from design references.
- **Accessibility:** legible text, reachable touch actions, visible focus, keyboard-operable controls, and clear feedback for two non-specialist users. Static comparison prototypes are exempt from production mobile requirements; the shipped app is not.
- **Evidence on hand:** static dashboards and screenshots are visual references only, and fixture content is not real client data or evidence of expected functionality. [checklists.md](./misc/checklists.md) holds the 16 editable seed templates, not mandatory procedures. Calendar, Phone, automated reminders, and reporting are not inferred from examples.

## First release (REL)

- REL-1 Tasks ship with title, date, due date, an optional client or opportunity link, create, edit, complete, reopen, delete, rollover, and overdue. Time, location, repeat, checklist promotion, and the stage-move dialog come after the release.
- REL-2 The realtor, the assistant, and the support admin have logins. The support admin account and impersonation, as described in People, ship in the release so the developer can see the deployment without signing in as a business user (decided 2026-10-30).
- REL-3 Uploaded files come after the release; web links and linked records remain.
- REL-4 The business's real client data is imported as part of the release.
- REL-5 The release has one shared dashboard of real data: Today's Tasks, Upcoming, and Recent activity. Role-specific dashboards come after the release.
- REL-6 Advanced Registry features, Settings panels, the checklist template editor, board view options, and other refinements come after the release. Visual redesign is not part of it.
- REL-7 Every task has a date, when it starts appearing on the realtor's list. A new task's date defaults to today and can be set to a future day; the due date is optional. The release builds this as a basic primitive to iterate on, not the final task shape.
- REL-8 Checklist items show no date control in the release. Stored item dates and the date code are kept so promotion can build on them later.
- REL-9 The business timezone is America/Los_Angeles; Settings cannot change it in the release.
- REL-10 A forgotten password is reset by the developer by hand with a script; there is no reset email or link.
- REL-11 The production Worker may take over the existing `meadow` Worker's name; it was a prototype.
- REL-12 Nobody depends on production before the business starts using it, so deploying needs no separate sign-off; it ships once it works locally.

## People (PPL)

- PPL-1 The realtor and the assistant are the two business users. Both can see and change every record.
- PPL-2 The assistant usually creates tasks for the realtor; the realtor can create tasks too. The assistant has no tasks of their own.
- PPL-3 The developer has a support admin account that signs in and impersonates either business user to give support. History records both who acted and who they acted as.
- PPL-4 Login is managed by the app itself.
- PPL-5 Login uses secure HTTP-only cookies, trusted origins, rate-limited attempts, and the same message for every failed login. Every response is private and never cached.
- PPL-6 Logout and password change live in the account menu, apart from business Settings.
- PPL-7 While impersonating, a persistent indicator shows who the support admin is acting as, with an explicit way to switch or exit. Impersonation expires after a short time. The support admin cannot change records without first choosing a business user, and exiting returns to that choice.
- PPL-8 Switching identity clears cached data and revokes the previous identity's access. Business users cannot impersonate, and a request that claims another identity without a valid impersonation is refused.

## Look (LOOK)

- LOOK-1 The business chose [Quiet Cream](../static/dashboards/04-quiet-cream.html) as the visual starting point.
- LOOK-2 Example screens and prototypes are design references only: they never imply a feature.

## Modules (MOD)

- MOD-1 The modules are Dashboard, Pipeline, and Registry, each with its own sidebar item.
- MOD-2 None of them can be switched off; later modules may be optional.
- MOD-3 Tasks cannot be switched off either.
- MOD-4 Settings and the Glossary are views that belong to no module, opened from the account menu.

### Dashboard (DASH)

- DASH-1 There are two fixed versions for now: one for the realtor and one for the assistant.
- DASH-2 The realtor's dashboard has Today's Tasks (incomplete tasks whose date has arrived), Upcoming, and Key dates.
- DASH-3 The assistant's dashboard has the Inbox, Realtor's day, Upcoming, Pipeline summary, and Recent activity.
- DASH-4 The Inbox lists things the assistant should do or check, each linking to its record: overdue tasks, and clients, opportunities, and tasks the realtor created. An overdue task leaves the Inbox once it is no longer overdue; a record the realtor created stays until the assistant marks it done.
- DASH-5 Realtor's day shows the realtor's Today's Tasks on the assistant's dashboard. The assistant can edit them there, but the widget is locked against accidental edits until deliberately unlocked.
- DASH-6 Upcoming shows the realtor's tasks whose date or due date falls in the next several days.
- DASH-7 Key dates shows clients' birthdays and key dates coming up in the next few weeks.
- DASH-8 Pipeline summary counts opportunities per stage and links to the board.
- DASH-9 Recent activity lists the latest changes across records, drawn from their history.
- DASH-10 Widgets show existing records rather than keeping copies, and link to them. Counts are real, and widgets link into filtered views as well as single records.
- DASH-11 Each widget has loading, error, and empty states, and an empty state says what to do next.
- DASH-12 Recent activity's empty state may be playful, such as four milestones from the birth of the universe to today, as long as it never looks like business history.

### Pipeline (PIPE)

- PIPE-1 One board holds every opportunity, whatever its type. Type distinguishes the cards and selects checklist templates; it never splits the board.
- PIPE-2 The stages are fixed, in order: New lead, Active lead, Under contract, Closed.
- PIPE-3 Stages describe progress; they are not gates. An opportunity is created at its real stage, can skip stages, and can move backwards. A stage changes only when a person moves it.
- PIPE-4 A contract that falls through with the client still engaged returns the opportunity to Active lead. When the client is gone, the opportunity is archived. Closed means the engagement was completed; outstanding checklist items can remain.
- PIPE-5 The types are Buyer, Seller, Estate Sale, and Construction, with no "other". An engagement that fits none is recorded against the closest type with a note. Types are fixed for now, but implemented so another type can be added later without a redesign.
- PIPE-6 An opportunity's type is chosen when it is created and never changes. An opportunity created with the wrong type is deleted and created again.
- PIPE-7 An Estate Sale opportunity is a referral relationship and may sit in one stage its whole life. Construction work stays on the same board so the realtor's side work is visible alongside everything else.
- PIPE-8 An opportunity has a title, type, stage, optional timeline, optional property address, optional budget or target price in USD, its clients, notes, references, checklists, and an archive state.
- PIPE-9 The title is what the business calls the work: "Miller home search" until a property is picked, then the address.
- PIPE-10 A client is not required.
- PIPE-11 The timeline (1-3 mo, 3-6 mo, 6+ mo) is shown on the card and used to filter and sort. It never blocks a stage change or judges an opportunity.
- PIPE-12 An opportunity shows the combined tags of its clients, read-only. Tags are edited on the client.
- PIPE-13 The board can be filtered by type, timeline, and tag, and sorted by timeline: 1-3 mo, 3-6 mo, 6+ mo, then opportunities without one. A card's type is shown by its label, never by color alone. Type filters are buttons, one per type; selecting several shows opportunities of any selected type, combined with the timeline and tag filters.
- PIPE-14 Each stage's column can be collapsed. The choice lasts for the browser session; a new session starts with just enough columns collapsed, rightmost first, to keep every column visible. When expanded columns overflow the board, its scrolling edges fade.
- PIPE-15 A pinned opportunity stays at the top of its stage's column for both users until someone unpins it.
- PIPE-16 An opportunity can be bookmarked from its detail view. Bookmarks are a stack in the sidebar, kept per user in the browser and removed only by that user; clicking a stack of several fans it out, choosing one opens that opportunity, and clicking elsewhere closes the fan; clicking a lone bookmark opens its opportunity directly.
- PIPE-17 A card always shows its title, type, and timeline. It can also show client names, checklist progress for the current stage, an overdue marker when a task linked to the opportunity is overdue, and the budget or target price. Which of these appear is chosen in the board's view options, a discreet panel saved in the user's browser; losing that choice is acceptable. The card design and its options settle over several rounds of review with the developer.
- PIPE-18 Opening an opportunity shows its details, with its checklist in a sidebar beside them. Each detail and the references can be added or changed in place, and the full editor stays available as a second way to edit.

### Checklists (CHK)

Checklists belong to the Pipeline. They are rough guidelines for each stage, not a separate module.

- CHK-1 Each stage of an opportunity has its own checklist, which starts from that type and stage's checklist template. Returning to a stage shows its checklist as it was left.
- CHK-2 Template changes made in Settings reach every opportunity's checklist at that type and stage. Items that were added, renamed, removed, or reordered on one opportunity keep their local version.
- CHK-3 Anyone can add, remove, rename, and reorder items on one opportunity's checklist without touching the template.
- CHK-4 There is no "Reset to template" action for now.
- CHK-5 A template can be empty. Renaming or reordering a template item keeps the progress opportunities already have on it; a new template item starts unchecked and undated.
- CHK-6 An opportunity's detail view shows a compact strip of the stages it has visited, with each checklist's completion count. Hovering or focusing previews a stage's checklist, and clicking or tapping opens it for inspection with a clear way back to the current stage. Inspecting a stage never moves the opportunity, and the view always distinguishes the stage being inspected from the opportunity's actual stage. Unsaved edits survive moving between stages.
- CHK-7 Giving a checklist item a date or a due date promotes it to a task on the realtor's task list. Behind the scenes this creates a task linked to the item. The task and the item always share one title; renaming either renames both.
- CHK-8 Completing, reopening, or deleting a promoted task does the same to its checklist item, and the other way around.
- CHK-9 A promoted task references its opportunity. Its reference can also show the checklist item.
- CHK-10 Moving an opportunity to another stage while tasks promoted from its current checklist are still open asks what to do with each one: complete it, delete it, or ignore it.

### Registry (REG)

- REG-1 The Registry lists every client in a dense, sortable table. A client opens in a side panel.
- REG-2 Keyword search is instant and covers name, contact details, address, notes, and tags.
- REG-3 Tags and lead source have searchable faceted filters alongside a filter builder for opportunity counts, Consent, Referred by, and Created. Opportunity-count filters offer both current (non-archived) opportunities and all opportunities (archived included). The archived toggle opens the explicit archived view.
- REG-4 Search and filters live in the URL so a view can be shared or bookmarked, along with the archived toggle and sorting. Reloading, Back, and Forward restore the view; invalid values fall back to defaults. Typing in search replaces the current history entry rather than adding one per keystroke, and adding or removing a filter adds one. Selections and record content never go in the URL.
- REG-5 The developer prefers perpetual scrolling over pagination where sensible. The current adaptation loads 50 clients at a time, with no pagination or page-size control; it retains loaded rows rather than virtualizing them. Virtualization remains a performance follow-up, not an implemented feature. Sorting or filtering starts again at the top.
- REG-6 Columns can be hidden or moved through a right-click header menu, also available with the keyboard; clicking a sortable heading sorts. Consent, Referred by, and Created are hideable columns, with Referred by and Created initially hidden. Column order and visibility are saved in the browser. No export, spreadsheet-style editing, or reporting.
- REG-7 Several clients can be selected to apply tags or archive them at once. The header checkbox selects the clients currently shown; a "Select all matching clients" link then extends the selection to every match.
- REG-8 The number of selected clients is shown. Changing search, filters, archived state, or sorting clears the selection; loading more rows preserves it. The current implementation limits each bulk change to 2,000 clients and labels that limit when results exceed it.
- REG-9 A bulk change applies to every selected client it can, then says which clients were skipped and why. An Undo action shown right after the change reverses the change, skipping clients edited since that action rather than overwriting newer work. Each client's history records both the change and its undo. Archived clients can be selected and restored too.
- REG-10 A client can be deleted, and only from the Registry. Before deleting, a notice lists the client's opportunities, each with a choice to delete it, archive it, or leave it alone, and the tasks linked directly to the client, each with a choice to delete it or leave it alone. Whatever is left alone loses its link to the client.
- REG-11 Each client shows their opportunities inline, so the Registry is also a way into the Pipeline.
- REG-12 A client is a person, or several people such as a married couple, whom the business treats as one relationship. Each person has a name, a birthday, and any number of labeled phone numbers and email addresses.
- REG-13 A client has its people, any number of addresses, a lead source, Referred by, relationships, key dates, preferences, consent, a preferred contact method, notes, tags, created and updated timestamps, and an archive state. These fields are meant to give later features, such as nurture follow-ups, referral tracking, and Phone, the data they need.
- REG-14 An address can be of any kind, whether or not the client owns it. Each has a label and a marker for whether the client owns it.
- REG-15 Referred by is either an existing client, linked, or a typed name when the referrer is not a client, such as a lender or another agent.
- REG-16 A relationship is a labeled link between two clients, such as parent, sibling, or colleague.
- REG-17 A key date is a named custom date, such as a wedding anniversary or a home purchase.
- REG-18 Preferences is free text on how to treat the client, including how to address them. Later it may give AI features context, and AI may suggest additions to it.
- REG-19 Consent records, for the whole client, whether they may be contacted by call, text, email, and mail. It is on for every client by default, because there are no promotional automations; the assistant turns channels off where needed, and turning all of them off marks the client as not to be contacted. It is shaped so it can later hold preferences for different kinds of communication on each channel.
- REG-20 Lead source is a field set when the client is created, and it can be filtered.
- REG-21 Tags say where a client stands with the business. The starting tags are sphere and nurture. How a client came to the business is recorded by lead source and Referred by, not a tag. Nurture is a label; follow-up behavior built on it is not part of the MVP and will be decided once the MVP has been tested.

## Tasks (TASK)

- TASK-1 Tasks are work on the realtor's task list. A task can stand alone or link to a client or an opportunity.
- TASK-2 A task's date is when it starts appearing on the task list. If it is not completed, it rolls over to the next day.
- TASK-3 A task's due date is its deadline. An incomplete task whose due date is before today, in the business's timezone, is overdue. That is a problem for the realtor who missed it and for the assistant who may need to fix it.
- TASK-4 A task can carry a time, a location, and a repeat, so scheduled things such as showings are tasks. There are no separate events.
- TASK-5 Tasks and checklists are separate; a checklist item becomes a task only when promoted.

## Records (REC)

- REC-1 Clients, opportunities, and tasks are records. Each opens in its own detail view with a references section and a history section.
- REC-2 A reference is a linked record, a web link, or an uploaded file. Its kind sets how it looks. Web links and files can be given a friendly name; a linked record shows its own name. Related records and uploads live in the references section rather than in sections of their own.
- REC-3 History records what changed, when, by whom, and as whom when impersonating.
- REC-4 A saved change appears immediately and rolls back with a message if saving fails. If someone else changed the record first, the later save is refused and the screen shows their version so the edit can be redone.
- REC-5 Saving shows that it is in progress. When the network is unavailable, the edit is kept so it can be retried; the app never says a change is saved until the server has saved it.
- REC-6 Both users' screens stay current: views refresh on navigation and focus, poll while visible, pause while hidden, and recompute dates at the business's midnight. Refreshing never discards an unsaved edit.
- REC-7 Removing a reference never changes the record it points to. Web links must be http or https. An archived record stays reachable from the references that link to it.
- REC-8 Archiving an opportunity leaves its tasks on the task list.
- REC-9 Clients and opportunities can be archived independently. Archiving keeps every field, note, link, and its history, and can be undone from an explicit archived view. Archived opportunities never appear on the board, and archived clients do not appear in the Registry by default.
- REC-10 Archiving is how dead work leaves the board; Closed is reserved for engagements that were completed.
- REC-11 A record created by mistake is deleted rather than archived. Clients can be deleted, only from the Registry. Opportunities can be deleted, along with the tasks promoted from their checklists. Tasks can be deleted, and deleting a promoted task deletes its checklist item. Delete options for anything else are settled when that work is built.
- REC-12 A delete may look permanent to users while being kept briefly behind the scenes.
- REC-13 Uploaded files are part of the MVP, as references.

## Shell and accessibility (SHELL)

- SHELL-1 Collapsing the sidebar keeps the current location, focus, and unsaved edits. In the icon rail every destination stays identifiable and works by touch and keyboard.
- SHELL-2 On phones the layout is composed for the phone rather than shrunk from desktop. Wide boards and tables scroll inside themselves, and nothing overflows the page at 375px.
- SHELL-3 Fields are labeled, icon controls have accessible names, and focus is always visible. Overlays take focus, return it when closed, and close with Escape. No action depends on hover or drag alone.
- SHELL-4 View transitions are short and can be interrupted, never trap navigation or focus, and fall back cleanly when the browser lacks support or reduced motion is set.

## Settings (SET)

- SET-1 Settings are opened from the account menu and have a panel for User preferences, one for Business settings, and one per module.
- SET-2 Both business users can see and change every business setting, and checklist templates are shared by everyone.
- SET-3 Business settings include the business name, timezone, and date format. Currency is always USD. The business timezone, not the device's, decides dates and overdue for both users. Invalid values are refused.
- SET-4 Pipeline settings hold the 16 checklist templates. Template edits are drafted and then saved together, with a note of how many opportunities they reach. When a template item is removed, opportunities where it is checked off or promoted keep it; elsewhere it is removed. The editor's layout will be chosen from prototypes reviewed with the developer. A save that fails validation keeps the draft, and removing an item says how many opportunities it affects before saving.
- SET-5 Registry settings hold the tag vocabulary: add, rename, recolor, and retire tags. A tag in use cannot be deleted outright; retiring it stops future use and offers to strip it from existing clients. Renaming or recoloring a tag carries through to opportunities; a retired tag still shows on the clients and opportunities that keep it, but cannot be chosen for new ones.
- SET-6 Registry settings also hold the relationship labels and the address labels, each starting from a provided set.

## Getting data in (DATA)

- DATA-1 The business's real client data will be imported once, with a script the developer runs.
- DATA-2 There is no in-app import screen.
- DATA-3 A record for a couple becomes one client holding both people, and a referral tag in the data becomes the client's lead source.

Decided for the first release's import of `docs/misc/client-data.csv` on 2026-10-30:

- DATA-4 Clients only. The CSV's opportunity columns create no opportunities.
- DATA-5 A row marked as a couple becomes one client holding two people, despite the CSV's note to split it into two clients.
- DATA-6 Columns with no field, such as beds, baths, area preference, property type preference, budget, the old CRM's status, source, and hashtags, go into a read-only "Imported data" field on the client rather than its notes. The client's detail view shows it compactly. The import reports how often each column is filled; the developer and the business decide which deserve fields of their own, and the field is then dropped. It is temporary, so it has no Vocabulary entry. Under the developer's delegated mapping decision on 2026-10-30, second mobile and home phone numbers and second emails become labeled fields on the first person; spouse contact details belong to the spouse when named. Legacy status and hashtags remain Imported data rather than being guessed into tags.
- DATA-7 Unknown email consent imports as email on; do-not-contact turns every channel off.
- DATA-8 Lead-relay emails (kvleads.com forwarding addresses) are retained in Imported data, not used as a person's email address (changed by the developer on 2026-10-30). A client left with no non-relay email, phone, or address is not imported; one with only a mailing address is kept.
- DATA-9 Rows the CSV marks as test records are not imported.
- DATA-10 Correction authorized 2026-10-30: delete and replace every `import-client-*` client and its history, discarding app edits to those records. Keep stable source-row IDs and exactly one import history row per client. The default is still a database-free dry run; explicit apply replaces the entire import atomically and is repeatable without accumulating records.
- DATA-11 Keep each couple's full client name, split the people even without a legacy couple flag, and inherit the shared surname where supplied. Intelligently normalize lowercase and uppercase names while preserving mixed-case spellings. Numeric-only names stay unchanged and carry an Imported data review flag because blank client/person names violate database constraints; move a phone found in their address into a phone field instead of creating a junk address. Do not invent surnames when the source has none.
- DATA-12 Under the developer's delegated cleanup decision, keep possible duplicates separate and flag their source rows in Imported data: a matching name or shared phone alone is not enough to establish one client. Normalize imported lead sources to the existing choices: A referral, An open house, A sign, The website, and A walk-in.
- DATA-13 Client email addresses are always lowercase, including secondary/spouse emails and retained relay emails; normalize existing values, future imports, and app saves (confirmed 2026-10-30). This does not rewrite email addresses embedded in legacy free text or change login identities.

## Not planned

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
- Phone, which is a later milestone with its own research in [notes/phone-module.md](./notes/phone-module.md).

### Dropped earlier

Kept so these are not reintroduced by accident.

- The whole-stage checklist detach, per-stage reset, and per-stage rebase: replaced by per-item edits, no reset, and opportunity types that never change.
- Moving completed or dated template items into history when a template item is removed: replaced by keeping them on the opportunities where they are checked off or promoted.
- The checklist "attention scope" setting and separately copied dated checklist tasks: replaced by overdue as a task status, promotion that keeps item and task in sync, and the stage-move dialog.
- Tasks as an optional module: Tasks cannot be switched off.
- Page-only selection and all-or-nothing bulk changes: replaced by "Select all matching clients", partial success with reasons, and Undo.
- One shared dashboard with a purely derived Inbox as the end state: replaced by role-specific dashboards and an Inbox the assistant marks done. The first release's shared dashboard is temporary.
- Required client links on opportunities and a "referral" starting tag: opportunities need no client, referral is a lead source, and the starting tags are sphere and nurture.
- A single Settings page with no user preferences: replaced by User preferences, Business settings, and module panels.
- A calendar view in the MVP: not in the MVP.
- The `query.live` streaming experiment: polling is enough for two users.
- The long acceptance matrix: replaced by the release checks and the "Done when" notes above.

## Open questions

### Tasks, Registry, and files

- How a task's time, location, and repeat behave, which needs discovery before it is built.
- Task shape, for an exploration session after the release. The developer's notes from 2026-10-30: a task's date is when it starts appearing on the realtor's list, defaulting to today and schedulable for a future day; it is unclear whether a date and an optional due date are enough for most of a realtor's needs. A seven-day view of the week has to show a task spanning its date to its due date without looking like a task that repeats every day in each day's column. A backlog of unscheduled work is appealing, but it is open whether it holds tasks with no date or tasks with a dedicated status. The earlier plan let a standalone task have no date and showed it among open tasks without an overdue indicator.
- How checklist item dates return with promotion: the release hides them, and promotion (see Checklists) should reuse the stored dates and the item date code rather than replace them.
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
