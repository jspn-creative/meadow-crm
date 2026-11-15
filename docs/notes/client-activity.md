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

The questionnaire at [client-review.html](../misc/client-sources/client-review.html) asks only for Active, Archive, Delete, or Not sure on six remaining groups, with three collapsed representative examples per group. A Finder alias at the original Downloads location opens this repository copy. The existing browser-storage key preserves remaining group answers, but any earlier choices for the 27 recent-note cases are ignored: the developer's explicit Active decision now governs every member. The CSV includes 30 fixed Active rows with client IDs, case IDs, and sanitized review instructions, followed by six group answer rows. Those 36 rows still cover the original 714 research clients; 684 remain undecided. This changes review artifacts only, not clients, archive states, Consent, or tags in Meadow.

[Client flags implementation plan](client-review-flags-plan.md) is the separate end-to-end plan for building the feature and applying the approved manifest. `client-review-active.json` contains only stable IDs and operational reasons to review; personal background, housing narratives, and original imported notes are not flag-note content. The earlier questionnaire explanations are provenance, not instructions to copy into the app. The existing Downloads CSV inspected during planning contains only four Not sure rows from the assistant's browser check and otherwise unanswered rows; it is not a source of user-approved Active decisions.

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

Who an imported entry belongs to is limited by the export. Every contact is assigned to Jayden, all 1,719 outbound texts come from one number, and typed notes and calls carry no author, so BoldTrail can't tell Jayden from Janae or from its own call team. The client is the actor of inbound texts, Zillow messages, and STOP replies. Everything else on the business's side is attributed to BoldTrail; outbound texts whose body repeats a template (1,434) are automated, and the 285 one-off texts were probably typed by a person but still show BoldTrail. Meadow-era entries are always attributed to the user who logged or wrote them.

## Activity feed

The client's and the opportunity's feed is called Activity, not Notes, because most entries aren't notes (chosen 2026-11-13). Note and logged contact are still proposed vocabulary entries; History stays the name of a record's saved changes, now one of Activity's sources. [client-activity-mockup.html](client-activity-mockup.html) sketches the shapes and wording with fictional data.

One feed per client and per opportunity, oldest first and newest at the bottom like Linear, merging three sources:

1. History: the existing `history` table, rendered as quiet one-line events ("Janae changed the lead source from Website to Zillow").
2. Notes: posted messages with author and time, replacing the single editable `notes` field. Imported notes are parsed into typed entries by the patterns above rather than kept as one authorless message (chosen 2026-11-12); only unrecognized text falls back to a note from BoldTrail, marked as having no known author.
3. Contact log: calls, texts, emails, and meetings with direction, outcome, and an optional note, logged from a "Log contact" form whose fields change with the channel. Imported BoldTrail contact lands here too.

History and activity stay in separate tables because they behave differently. History is a by-product: the app writes a row on every save, as a before and after per field, nobody can edit or delete it, and it stays complete enough to undo or audit a change. Activity is content: people write notes and log contact deliberately, can fix a typo or delete a mistaken entry, and each kind carries its own fields (channel, direction, outcome, body). One table would make every history row carry empty contact columns and would make the audit trail editable. The feed query reads both for the open client or opportunity and merges them by time, so users see one Activity.

Presentation rules for the design pass:

- An era divider separates BoldTrail from Meadow: a labeled rule above the first imported entry ("From BoldTrail · Nov 2024 – Oct 2026") and another at the switch ("In Meadow · since Oct 30, 2026"). Imported entries need no other badge.
- An entry of the same kind looks the same in both eras; only the actor differs. A Meadow-logged call and an imported call share one shape.
- Three weights. Quiet one-liners for history and automation; contact rows with the message or call note in a bubble, tinted when it is the client's own words and outlined when it is the business's; notes as cards, clamped after a few lines.
- Two-way contact (inbound texts and emails, Zillow messages, calls that talked, STOP replies) always stands alone. Consecutive automation of one kind with no reply between collapses into one row ("BoldTrail sent 14 automated texts · no reply", with the date range), which expands to quiet one-liners. Collapsing is presentation only: every imported entry stays its own row.
- History edits collapse like Linear's: consecutive saves to one record by the same person, each within 5 minutes of the last and with nothing from anyone else between them, show as one row with the net change from the first save's before to the last save's after ("Janae changed the budget from $650k to $700k"). A field that ends where it started drops out of that row, and a row with no net change disappears. This is presentation only: every save keeps its history row, and Recent activity applies the same grouping.
- Any entry with detail fields expands in place to show them, such as a Zillow inquiry's property and search criteria.
- Wording is standardized as actor, past-tense verb, object: "Priya texted", "Janae called Priya · Talked", "BoldTrail sent 9 market reports", "Added from a Zillow inquiry about 418 Alder Ct", "Priya replied STOP · texting turned off". Raw BoldTrail codes (`AutoClaimed`, `phoneConversation`) never appear in summaries, only translated, and only in expanded detail when they add anything.

"Last contacted" is the latest contact entry whose outcome reached the client; the latest attempt can sit beside it. Recent activity already aggregates history across records (DASH-9); it should share the feed's event describer so each row leads with the event ("New opportunity created", "Contact preferences updated") and the record name, with an expandable before and after.

## Client IDs

Imported clients are `import-client-<source row>` so the import can replace exactly its own rows (`id GLOB 'import-client-*'`, DATA-10); app-created clients use UUIDs. The ID appears in `?client=` URLs and duplicate flags, where it works like any other ID since it is URL-safe. The developer chose to leave them on 2026-11-12. Changing it means rewriting every foreign key and invalidating browser bookmarks, and it ends the import's ability to replace itself, which no longer matters much since a rerun would discard the business's edits anyway. Targeted scripts, such as parsing the untouched `Agent Notes` into activity, don't depend on it.

## Proposed tasks

One worktree, in order. Each depends on the decisions asked on 2026-11-12.

1. Correct imported archive states with a reviewed data migration: restore the 113 active clients, then apply the decided tiers (active, archive, or delete); it touches only `archived_at` on unedited imported clients and opportunities and records history.
2. Correct imported lead sources from the raw `Source`, adding any newly decided lead source to `src/lib/data/lead-sources.ts`, the vocabulary, and Registry facets.
3. Add an `activity` table (notes and contact log entries, with author, kind, channel, direction, outcome, occurred-at, body, and JSON detail) and a feed query that returns one client's or opportunity's activity merged with its `history`.
4. Add Activity to the vocabulary (replacing the Record entry's history section), then build the Activity feed on the client with a note composer and a "Log contact" form, plus "Last contacted" on the client and in the Registry; then the same feed on opportunities.
5. Parse BoldTrail `Agent Notes` into one activity row per entry with a script that dry-runs by default and inserts with stable IDs, dropping TCPA consent and marking automated entries so the feed can collapse them.
6. Rewrite Recent activity on the shared event describer: event headline, record name, actor, time, and an expandable diff.
7. Store realtor-confirmed past deals from `closed-deals.csv` on their clients and include them in opportunity counts, without creating Closed opportunities; add the missing listed clients first.

## Design pass prompt

To run after the decisions are recorded:

> Take a design pass at the client dialog in meadow-crm (`src/lib/registry/ClientEditor.svelte` and what it composes). Read `AGENTS.md`, `DESIGN.md`, `docs/notes/client-activity.md`, and the REG and REC requirements first, and load the Svelte and Tailwind guidance. Improve the dialog's layout, hierarchy, and every edit form inside it, and prototype the Activity feed described in the note, following its presentation rules and `docs/notes/client-activity-mockup.html` for entry shapes, wording, and states, but not for visual design: the BoldTrail and Meadow era dividers, one shape per kind across both eras, two-way contact as standalone bubbles, automation collapsed into runs that expand, back-and-forth edits grouped into one net change or hidden when reverted, expandable detail, and notes clamped as cards; plus "Last contacted" and a "Log contact" form that changes with the channel. Use realistic fictional content covering each entry kind in both eras, including a long typed needs list, a run of 14 automated texts, and a STOP reply. Compare layouts with `VariantPicker` per `src/lib/dev/README.md`; keep data fictional and local (`vp run dev:local` with the identity stub), and don't build schema or server changes. Stop for my review in the browser.
