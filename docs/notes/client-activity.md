# Client activity, archive, and import corrections

Research for the beta feedback of 2026-11-12: unexplained archived clients, missing past deals, wrong lead sources, unreadable imported notes, a contact log, a combined activity feed, the Recent activity widget, and word-based client IDs. Source rows are cited by number; no client data is copied here.

## Sources

- `~/Downloads/Combined Data Export.csv` (not in the repo) is the raw BoldTrail export: 840 rows, 125 columns.
- `docs/misc/client-data.csv` is a transform of it made an hour later, before this repo existed. It split buyer+seller rows, invented `client_archived`, `opportunity_archived`, `stage`, `tags`, and `lead_source`, and kept a few raw columns as `OLD_*`. `scripts/import-clients.ts` imports that transform, not the raw export.
- `docs/misc/client-sources/meadow-active-clients/` (added 2026-11-13) holds the realtor's own client lists: three BoldTrail-era spreadsheets (2020 client list, Closed Clients, My Past Clients with two sheets) and `Past Client Originals.pdf`, a scan of 2018–2021 broker statements with each client's name handwritten beside the property. Everyone in this folder is a confirmed active client.
- `docs/misc/client-sources/closed-opportunities/` holds the brokerage's commission statements for 2022 to 2025. They list close date, property, side, and price, but no client names. `11_12_2025.pdf` repeats the second half of `2025 YTD.pdf`; Referral bonus, Additional, and Mentor rows (another agent's client) are not the realtor's deals.
- `docs/misc/client-sources/past-client-originals-transcribed.csv` transcribes the scan's handwriting by eye; OCR can't read it. `closed-deals.csv` lists all 165 closed deals from both sources with the matched `import-client-*` IDs and a confidence.
- `docs/misc/client-sources/confirmed-client-records.csv` freezes the 113 matched client IDs approved for the core client list. `review-groups.py` reads that list, the raw export, the existing transform, and `client-review-cases.json` (reviewed explanations, case membership, the developer's Active decision, and concise review instructions) to produce `client-review-groups.csv` (all 714 other client IDs, evidence, dates, and restrictions), `client-review-summary.json`, the 30-client `client-review-active.json` application manifest, and the embedded data in `client-review.html`. It never connects to or changes the CRM.

## Why clients are archived

BoldTrail has an archive, but the developer counts fewer than 100 contacts in it, which looks like a manual effort that was abandoned, and the export doesn't mark them: `Deleted On`, `Action`, and `Last Closing Date` are empty on every row. `client_archived` came from the transform, and reverse-engineering it gives these rules, which explain most rows but not all:

- Archived whenever do-not-contact is set (102 rows, all archived), mostly people who replied STOP or opted out.
- Archived when BoldTrail's concierge disqualified the lead or reached a wrong number.
- Never archived when tagged sphere (BoldTrail `#PastClient` or `#ForeverClient`) or when the notes show an inbound reply or phone conversation.
- Otherwise, every row whose last activity is before mid-2025 is archived, and newer rows are split with no consistent rule (outbound text count, source, and status don't separate them). That part looks like per-row judgment, not a rule.

Source row 321 is a BoldTrail `Client` with no `#PastClient` hashtag. The transform mapped such rows to Active lead instead of Closed, then archived them for being quiet since 2022. 50 of the 62 BoldTrail `Client` rows without that hashtag are archived the same way.

The pass of 2026-11-13 ignores the transform's archive flags: every imported client starts undecided, the realtor's own lists decide who is active, and everyone else is tiered for the realtor and assistant to decide by group.

Active clients, 113 of the 827 imported, matched by email, phone, or first and last name, and for deals by the handwritten name or the property address in the client's address or notes:

| Evidence | Clients |
| --- | --- |
| In a client list and in a closed deal | 60 |
| In a client list only | 42 |
| In a closed deal only | 11 |

17 of them were archived in production on 2026-11-13. 9 couples are split across two clients each, so the 113 are 104 relationships; merging them is a separate decision. The 30 unmatched names are additional to the 113 matched client records, not a subset; they need identity review before import.

On 2026-11-14 the client confirmed these 113 as the core client list and requested a distinguishing tag; the exact label is not yet decided. A Past client tag would require a confirmed completed engagement, which membership in a client list alone does not establish.

On 2026-11-14 the developer approved six evidence-based review groups and a 12-month cutoff, replacing the earlier four groups. Later that day, the developer rejected treating a free-text note like a PastClient/ForeverClient hashtag and chose separate recent and older note groups. The subsequent per-case-card review format was rejected. The developer has now approved all 27 outlined recent-note cases, covering 30 clients, as Active with a review flag; the HTML returns to the original compact group format for the remaining 684. BoldTrail's Status field is ignored throughout: Client, Sphere, Contract, Active Lead, and Prospect do not establish a relationship or engagement by themselves.

The 714 clients are grouped once each, in the order explicit hashtag, notes needing review, opt-out, engagement, then no engagement. PastClient/ForeverClient hashtags have their own category, which is empty in the remaining review population. Notes use transparent pattern exclusions for recognized system events, address-only blocks, and bare dates; this is not a claim that every note's meaning or author has been verified. Inspecting the recent notes exposed invalid-email system notices and generic outbound introductions that passed those exclusions; their case metadata preserves that distinction, and their approved review instructions ask for verification rather than presenting them as relationship evidence. A completed call alone belongs to engagement, not notes.

The snapshot is fixed at 2026-11-14, with recent meaning 2025-11-14 onward. Engagement uses the latest personal incoming text (excluding STOP), answered qualification question, personal Zillow message beyond the default address inquiry and system tour text, or call outcome phoneConversation/successfulTransfer. Automated outbound texts, reports, unanswered calls, and field changes never refresh engagement. Clients without engagement are split by the raw Registered date, not Meadow's import date; the raw field is populated on every export row. Registered can itself be a legacy import date, so it is when BoldTrail registered the record, not necessarily the start of the relationship.

| Tier | Criteria | Clients |
| --- | --- | --- |
| Recent notes — decided | Latest dated note on or after 2025-11-14; approved Active with a review flag, removed from the remaining choices | 30 |
| 1. Older notes | Latest dated note before 2025-11-14; one group decision with representative examples | 72 |
| 2. Recent engagement | Latest personal reply, qualification answer, personal inquiry, or completed conversation on or after 2025-11-14 | 36 |
| 3. Older engagement | Same engagement evidence, latest before 2025-11-14 | 91 |
| 4. Recently added, no engagement | Registered on or after 2025-11-14; no hashtag, note-review clue, engagement, or recorded restriction | 197 |
| 5. Older, no engagement | Registered before 2025-11-14; no hashtag, note-review clue, engagement, or recorded restriction | 192 |
| 6. Opted out | Incoming STOP, recorded opt-out, or imported contact restriction, without a hashtag or note-review clue | 96 |

All 102 restricted clients remain accounted for: 6 in the approved recent-note cohort and 96 in opted out. Restriction annotations were removed from the questionnaire at the developer's request; the underlying research metadata and actual Consent remain unchanged. A STOP command is parsed from the incoming text body, excluding BoldTrail's trailing Message Type field; an outbound "Reply STOP" footer never counts. A later reply does not clear a restriction. Texting restrictions must not be represented as a ban on every contact channel; preserving Consent by channel is independent of archive decisions. The two invalid-email notices describe email unsubscribes separately and do not establish a restriction on all channels.

All 102 clients from the earlier combined group qualified through notes, not hashtags; 30 have a latest dated note on or after the cutoff and 72 before it. The approved 30 came from 27 cases: 25 single-client cases, one pair with the same invalid-email notice, and three clients with similar outbound introductions. Similar wording alone did not combine different buying or selling situations. No clients currently have only undated notes; a separate undated category prevents a missing date from silently becoming older.

The questionnaire at [client-review.html](../misc/client-sources/client-review.html) asks only for Active, Archive, Delete, or Not sure on six remaining groups, with three collapsed representative examples per group. A Finder alias at the original Downloads location opens this repository copy. The existing browser-storage key preserves remaining group answers, but any earlier choices for the 27 recent-note cases are ignored: the developer's explicit Active decision now governs every member. The CSV includes 30 fixed Active rows with client IDs, case IDs, and sanitized review instructions, followed by six group answer rows. Those 36 rows still cover the original 714 research clients; at questionnaire preparation, 684 remained undecided. Generating the questionnaire changes review artifacts only, not clients, archive states, Consent, or tags in Meadow.

[Client flags implementation plan](client-review-flags-plan.md) is the separate end-to-end plan for building the feature and applying the approved manifest. `client-review-active.json` contains only stable IDs and operational reasons to review; personal background, housing narratives, and original imported notes are not flag-note content. The earlier questionnaire explanations are provenance, not instructions to copy into the app. The partial Downloads CSV inspected during that planning contained only four Not sure rows from the assistant's browser check and otherwise unanswered rows; it was not a source of user-approved Active decisions. The completed, subsequently approved export below is a different input.

### Approved remaining decisions, 2026-11-15

The developer confirmed the assistant's completed CSV, SHA-256 `7251d677c12a09421426cac6a0c4c8e7f3aaa7227dd4df70429073c67fa96ab2`: the 36 recent-engagement and 91 older-engagement clients are Active; the 197 recently added clients without engagement are archived; the 72 older-note, 192 older-unengaged, and 96 opted-out clients are deleted. During the linked-record notice required by REG-10, the developer identified the sole linked opportunity as a test and chose to delete it while archiving its client, `import-client-303`, instead of deleting that client. This produces 270 Active, 198 archived, and 359 deleted clients, rather than the CSV's initial 270/197/360 split. All 714 review clients now have decisions; the 30 already approved Active clients retain their existing flags and curated notes, and the separate 113 remain unchanged.

`client-review-decisions.json` freezes exact IDs, group membership, source hashes, and the exception without duplicating personal fields. `scripts/client-review-decisions.ts prepare <approved-csv> <private-backup>` checks those sources and an unchanged read-only production baseline, then generates the manifest and `20261115010000_apply_client_review_decisions/migration.sql`; it never writes to production. Alchemy applies the guarded SQL once, with per-client History, child-first deletion, unchanged retained-client fields, and refusal of unexpected linked opportunities, tasks, referrals, relationships, or references. The helper's `verify <private-backup>` mode checks the ledger hash, every decision and revision, the opportunity deletion, all 143 protected clients, and the complete expected application state against the private backup. It never replays completed operations or restores a whole backup over later work. The private backup contains real client data and must not be committed or logged.

Applied to production through Alchemy on 2026-11-15. Read-only verification matched the exact ledger hash and all 685 History entries: 684 client decisions plus the test-opportunity deletion. Production now has 468 clients: 270 Active and 198 archived; 359 clients and the test opportunity were deleted. All 30 existing flags and notes, all 143 previously approved clients, every retained-client field outside the allowed archive/revision/timestamp changes, and unrelated application data matched the private baseline, with zero preservation differences. `vp run check` passed with zero errors or warnings; the helper's focused TypeScript check passed after its command explicitly enabled Node types. No automated tests were written or run. The deployment's Website build and upload succeeded. Do not replay the completed migration manually.

To regenerate the review artifacts locally: `vp exec -- python3 docs/misc/client-sources/review-groups.py --raw-export <raw-export.csv> --output-dir docs/misc/client-sources`. This command reads private source data and writes private review artifacts only; it does not invoke the importer or access a database. It updates the HTML's generated JSON block from the same summary, escaping less-than signs so source text cannot close the script element. Curated cases must match the snapshot and cutoff and cover each recent-note client exactly once; review their explanations and membership before changing either date. Keep these real-client artifacts out of app build output and logs, and tell the developer before any push to a shared remote.

Any correction must be a reviewed SQL data migration or a targeted script: rerunning `db:import-clients -- --remote --apply` discards every app edit made to imported clients since 2026-10-30.

## Past deals

The export has no transaction data: no closing dates, sale prices, or closed property addresses. The only signals are `Status = Client` (145 rows), the `#PastClient` (88) and `#ForeverClient` (13) hashtags, `Deal Type`, and free text; 15 `Client` rows mention closing, escrow, or a purchase in their notes. Status `Client` means BoldTrail's lifecycle reached client, not a count, so the number of past deals per client cannot be derived from this file.

`Deal Type` is not a usable hint: 739 of 840 rows say `buyer` and 89 `buyer,seller`, both defaults of lead capture.

The broker statements in `client-sources/` replace inference with a list. 165 closed deals from 2018 to 2025:

| Match | Deals | How |
| --- | --- | --- |
| Strong | 67 | Handwritten name or a client's own address |
| Likely | 6 | A 2022–2025 property named in the client's notes or Zillow inquiry, on a client marked Client |
| Possible | 5 | A surname or first name alone, or a referral or listing the client may only have inquired about; confirmation deferred |
| Unknown | 87 | 59 statement deals from 2022–2025 with no matching address, and 28 handwritten names not in Meadow or left blank |

The 73 strong and likely deals belong to 71 clients. Each counts toward the client's opportunity count without creating Closed opportunities (chosen 2026-11-13), which REG-3 doesn't yet allow: its counts come only from opportunities, so past deals need their own stored count, or year and side per deal, on the client. Naming the client of each unknown deal remains deferred work in `closed-deals.csv`, outside the current questionnaire.

## Data to pull

A running list of client data the sources hold that Meadow doesn't, and how to bring it in:

- Past deals: year, side, and property per deal from `closed-deals.csv`, plus close date and price from the statements, into the client's past-deal count once the realtor confirms the possible and unknown rows.
- Missing clients: the 30 listed people not in Meadow have name, email, phone, address, and lead source in the spreadsheets. Import them as new clients through a targeted script, not `db:import-clients`.
- Addresses: Closed Clients and My Past Clients give a street address for clients whose Meadow record has none; a sold or bought property is an Address marked owned or not owned.
- Spouses: the spreadsheets and handwriting name partners that Meadow holds as separate clients or not at all; they become a second person on the client.
- Commission statements are the only source for 2022 onward; BoldTrail never linked deals to contacts, so future statements need the client written beside each deal, as the realtor did on the 2018–2021 scan.

## Lead sources

BoldTrail's `Source` is the vendor and `System Source` is the intake surface. `Agent Website` is the BoldTrail-hosted IDX site that paid campaigns land on, not the realtor's own site:

| BoldTrail Source | Rows | Imported as | What it is |
| --- | --- | --- | --- |
| Leads360 | 322 | Website | BoldTrail's paid ad lead generation (Facebook and Google ads) |
| Zillow Tech Connect | 288 | Website | Zillow Premier Agent / Flex leads |
| PropertyBoost | 16 | Website | Paid ads promoting a listing |
| Organic Website, Direct Website | 38 | Website | Unpaid visits to the BoldTrail IDX site |
| Paid Marketing (PPC), FACEBOOK | 2 | Website | Paid ads |
| IMPORT, Manual Add, Lead Import, SPHERE, CALLIN, AGENT_IMPORT | 143 | none | Entered by hand; no channel recorded |

Zillow already exists as a lead source but no imported client has it. The developer chose one lead source per vendor on 2026-11-12. `Referrer` adds detail for paid rows, such as `Facebook: LeadAd`.

Mapping (Paid ad chosen 2026-11-13 and recorded in REG-20; the rest still recommended):

| BoldTrail Source | Recommended lead source |
| --- | --- |
| Zillow Tech Connect | Zillow |
| Leads360, PropertyBoost, Paid Marketing (PPC), FACEBOOK | A new lead source, Paid ad, with a detail field like Referred by that keeps the vendor and platform, such as "Leads360 · Facebook" or "Leads360 · Google". Social media stays for unpaid social. The developer rejected "Online ad" on 2026-11-13 and wants this detail kept; Paid ad is preferred to PPC because 250 of the 307 Referrer values are Facebook lead ads, which aren't pay-per-click search |
| Organic Website, Direct Website | Website: to the client it is the realtor's site, whoever hosts it |
| Manual and import sources | None; a sphere-tagged client may be a referral, but without a referrer the business fills it in |

## Imported notes

`Agent Notes` packs every BoldTrail timeline event into one string joined by `---`, each prefixed with a timestamp. 4,935 dated entries across 840 clients:

| Kind | Entries | Shape |
| --- | --- | --- |
| Text message | 2,005 | To, from, direction, count, body; almost all automated outbound concierge drips |
| Typed note | 746 | Free text by the realtor or assistant, often a needs list |
| Zillow inquiry | 379 | Contact message, property URL, search criteria |
| Lead routing status | 374 | Lead status, status type (AutoClaimed, Disqualified), reason |
| TCPA consent | 316 | Phone number and consent boilerplate; not imported |
| Call | 303 | Details, outcome (callAttempt 235, phoneConversation 49, optedOut 14, wrongNumber 4, successfulTransfer 1) |
| Lead created | 244 | Vendor and landing URL |
| Market report | 233 | Report area and link |
| Concierge status change | 178 | Status or timeline qualification changed |
| Disqualified | 93 | Reason |
| Field change | 64 | Field, before, after |

All of these fit one entry shape: when, who, kind, channel and direction for contact, outcome, one summary line, and optional detail fields. TCPA consent entries are dropped: they are boilerplate, and Consent already records the current state. A STOP reply is kept, because it explains why texting is off.

### Applied import, 2026-11-24

`scripts/client-activity-import.ts prepare` read production read-only for 468 surviving clients and parsed 2,986 dated entries for 408 of them. It dropped 235 TCPA consent entries and planned 2,754 Activity rows: 1,797 imported contacts, 954 imported notes, and 3 Meadow-era notes. Of the 426 clients with notes text, 423 matched the import, 2 were edited in Meadow, and 1 had Meadow text only; no opportunity had notes text. A second preparation on the day of deployment produced byte-identical SQL and the same counts as the first.

Alchemy applied `20261124200000_import_client_activity` on deploy. The script's `verify` mode matched all 2,754 rows, with zero row differences, zero unexpected rows, zero skipped rows, and zero changed client or opportunity rows. A second deploy applied `20261124210000_damp_punisher`, which drops `notes` from `clients` and `opportunities`. A read-only check afterwards still matched all 2,754 rows and found zero client or opportunity differences apart from the dropped column. The private backup is outside the repository.

The drop migration was renamed from its generated timestamp so that it sorts after the import, which still reads `notes` on a fresh database. `verify` compares whole client and opportunity rows with the backup, so it now reports every row as different because of the dropped column. `prepare` no longer finds Meadow-era notes text to carry over. Do not replay the migration manually.

Who an imported entry belongs to is limited by the export. Every contact is assigned to Jayden, all 1,719 outbound texts come from one number, and typed notes and calls carry no author, so BoldTrail can't tell Jayden from Janae or from its own call team. The client is the actor of inbound texts, Zillow messages, and STOP replies. Everything else on the business's side is attributed to BoldTrail; outbound texts whose body repeats a template (1,434) are automated, and the 285 one-off texts were probably typed by a person but still show BoldTrail. Meadow-era entries are always attributed to the user who logged or wrote them.

## Activity feed

The client's and the opportunity's list is called Activity, not Notes, because most entries aren't notes (chosen 2026-11-13). The developer settled its behavior on 2026-11-15 in the ACT requirements, with Note and Logged contact in the Vocabulary; History stays the name of a record's saved changes, now one of Activity's sources. [client-activity-mockup.html](client-activity-mockup.html) sketches the shapes and wording with fictional data.

One Activity per client and per opportunity, oldest first and newest at the bottom like Linear, merging three sources:

1. History: the existing `history` table, rendered as quiet one-line events ("Janae changed the lead source from Website to Zillow").
2. Notes: posted messages with author and time, replacing the single editable `notes` field. Imported notes are parsed into typed entries by the patterns above rather than kept as one authorless message (chosen 2026-11-12); only unrecognized text falls back to a note shown as BoldTrail.
3. Logged contact: calls, texts, emails, meetings, and other contact with direction, outcome, and an optional note, recorded from a "Log contact" form whose fields change with the channel. Imported BoldTrail contact lands here too.

Each note belongs to one record, and a logged contact belongs to the client or to one or more of its opportunities (ACT-2). Logging contact is how a client becomes an opportunity; once one exists, contact about it goes on the opportunity, and the client keeps contact before any opportunity plus client-level matters. The client's Activity rolls up its opportunities' notes and logged contact, labeled with the opportunity title, so the whole relationship reads in one place; the opportunity shows only its own. Log contact opened from a client with open opportunities asks which one it's about and shows the opportunity's and client's key details beside the form (ACT-5).

History and activity stay in separate tables because they behave differently. History is a by-product: the app writes a row on every save, as a before and after per field, nobody can edit or delete it, and it stays complete enough to undo or audit a change. Activity is content: people write notes and log contact deliberately, can fix a note's text or delete a mistaken entry (ACT-6), and each kind carries its own fields (channel, direction, outcome, body). One table would make every history row carry empty contact columns and would make the audit trail editable. Edits and deletions of notes and logged contact write History rows, so they appear in Activity too. The Activity query reads both for the open client or opportunity and merges them by time.

Imported entries with no known author use the support admin's user ID, because `history` and every actor column require a real user, with an imported marker that displays them as BoldTrail (ACT-7). The client is the actor of their own inbound messages and STOP replies, so an entry's actor is either a user or the client.

Presentation rules for the design pass:

- An era divider separates BoldTrail from Meadow: a labeled rule above the first imported entry ("From BoldTrail · Nov 2024 – Oct 2026") and another at the switch ("In Meadow · since Oct 30, 2026"). Imported entries need no other badge.
- An entry of the same kind looks the same in both eras; only the actor differs. A Meadow-logged call and an imported call share one shape.
- Three weights. Quiet one-liners for history and automation; contact rows with the message or call note in a bubble, tinted when it is the client's own words and outlined when it is the business's; notes as cards, clamped after a few lines.
- Two-way contact (inbound texts and emails, Zillow messages, calls that talked, STOP replies) always stands alone. Consecutive automation of one kind with no reply between collapses into one row ("BoldTrail sent 14 automated texts · no reply", with the date range), which expands to quiet one-liners. Collapsing is presentation only: every imported entry stays its own row.
- History edits collapse like Linear's: consecutive saves to one record by the same person, each within 5 minutes of the last and with nothing from anyone else between them, show as one row with the net change from the first save's before to the last save's after ("Janae changed the budget from $650k to $700k"). A field that ends where it started drops out of that row, and a row with no net change disappears. This is presentation only: every save keeps its history row, and Recent activity applies the same grouping.
- Any entry with detail fields expands in place to show them, such as a Zillow inquiry's property and search criteria.
- Wording is standardized as actor, past-tense verb, object: "Priya texted", "Janae called Priya · Talked", "BoldTrail sent 9 market reports", "Added from a Zillow inquiry about 418 Alder Ct", "Priya replied STOP · texting turned off". Raw BoldTrail codes (`AutoClaimed`, `phoneConversation`) never appear in summaries, only translated, and only in expanded detail when they add anything.
- On a client, rolled-up opportunity entries carry the opportunity's title so they read as part of that engagement.

### Client and opportunity views

Tasks 3 and 4 shipped the design that the developer accepted in the prototype. The client drawer is `src/lib/registry/ClientEditor.svelte`. The Pipeline's opportunity dialog is `src/lib/pipeline/PipelineView.svelte`, and an opportunity opened from a client is `src/lib/pipeline/OpportunityPanel.svelte`. Both read `getActivity` through `src/lib/activity/record-activity.svelte.ts`, which also posts, edits, and deletes notes and logs contact. Each write shows at once and rolls back with a message if it fails.

- The client panel is one scroller: the header with Call, Text, Email, and Log contact, then Last contacted and Latest attempt, People, Opportunities, Details, and Activity. The note composer is pinned under the scroller. While a details section is open, the save bar takes its place. The notes field is gone from the client and the opportunity; task 6 moved its text into Activity.
- Activity has two views, shared by every record and kept in the browser. Conversation shows notes and logged contact as a chat, with the client's words on the left and the business's on the right. Everything shows the whole list on its spine. Both open on the newest 12 rows, with a control for the earlier ones.
- In a client's Conversation, consecutive messages about the same opportunities sit on one faint band in the opportunity type's color. A band about several opportunities gives each its own stretch of the width, in its color. The opportunities' titles show on hover or focus, and always on touch screens. An opportunity's own Activity has no bands, because every entry is about it. Everything still labels each rolled-up entry with a chip.
- Latest attempt shows beside Last contacted unless it is the same contact (ACT-9). The server derives both from the client's logged contact and the contact on their opportunities, imported contacts included. Logging or deleting contact refreshes them and the Registry's Last contacted column. Log contact shows them only for the client whose dialog is open.
- The Registry's Last contacted column sorts with never-contacted clients last in both directions. Its filter takes calendar days like Created, and a client never reached matches no date.
- Recent activity uses Activity's describer in `src/lib/activity/describe.ts`. Each row leads with the event, worded as in Activity, then the record name and time. Consecutive saves to one record by one person group as they do in Activity. Imported entries stay out of Recent activity.
- Activity's Meadow era starts at the client import of 2026-10-30, so it reads "In Meadow · since Oct 30, 2026" rather than the date of the first Meadow entry.
- An opportunity opened from the client's Opportunities rows is a sub-panel of the client's drawer. Back or Escape returns to the client, and the breadcrumb stays Registry / client / opportunity. Open full view opens the Pipeline's opportunity dialog over the drawer, so the client is still there when it closes. Its Log contact is one more level, and Escape steps back one level at a time.
- Log contact is a sub-panel of the record's dialog, not a second dialog. In the client drawer, the client slides aside, the drawer widens to fit the key details, and the breadcrumb ends in Log contact. In the Pipeline's dialog, Log contact stays in view under the dialog's header wherever the dialog was scrolled. Back, Escape, or a click outside returns to the record.
- From a client, "What was this about?" lists the open opportunities, New opportunity, and No opportunity. New opportunity needs only a type and a title, asked as "What should we call this opportunity?", and it starts as a New lead with the client. The Pipeline's full form was not reused, because it would open a dialog over the sub-panel. From an opportunity, the form asks nothing and shows each of its clients' key details.
- On touch screens, a message's edit and delete actions show for the tapped message only.
- The Feedback tool keeps clear of a modal dialog's controls until someone drags it: beside a side dialog when the window has room, otherwise above the dialog's pinned bar.

Decided 2026-11-24: one logged contact can cover several opportunities (ACT-2), the views are Conversation and Everything (Vocabulary), and Latest attempt hides when it is the same contact (ACT-9).

Last contacted and the latest attempt sit together on the client (ACT-9), so a run of unanswered calls is visible beside the last real conversation. Recent activity already aggregates history across records (DASH-9); it shares Activity's event describer so each row leads with the event ("New opportunity created", "Contact preferences updated") and the record name, with an expandable before and after, and now includes notes and logged contact.

## Client IDs

Imported clients are `import-client-<source row>` so the import can replace exactly its own rows (`id GLOB 'import-client-*'`, DATA-10); app-created clients use UUIDs. The ID appears in `?client=` URLs and duplicate flags, where it works like any other ID since it is URL-safe. The developer chose to leave them on 2026-11-12. Changing it means rewriting every foreign key and invalidating browser bookmarks, and it ends the import's ability to replace itself, which no longer matters much since a rerun would discard the business's edits anyway. Targeted scripts, such as parsing the untouched `Agent Notes` into activity, don't depend on it.

## Planned work

The Activity feed is the current milestone in [tasks.md](../tasks.md). Archive corrections are complete (DATA-14 to DATA-16). Correcting imported lead sources (REG-20's Paid ad is decided but not yet in `src/lib/data/lead-sources.ts`), storing realtor-confirmed past deals, and importing the missing listed clients are later work there.
