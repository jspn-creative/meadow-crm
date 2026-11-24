# Client panel polish log

Working log for the client panel and Activity prototype (`/activity-preview`, `src/lib/registry/ClientEditor.svelte`, `src/lib/activity/`). Newest state first; delete once the prototype is accepted.

## Plan (2026-11-16)

1. Settle the layout: stacked only, no Split or Tabs; drop the Layout and Activity style variants. Preview scenario moves into the variant toolbar.
2. Remove prototype-only labels: Preview chip, Fictional relationship chip, "Sample data" lines, the feed's entry-count footer.
3. Header: Call, Text, Email open Log contact on that channel; Last contacted and Latest attempt become one scannable status block.
4. Details: People as icon rows; Address, Relationships, and Key dates as compact rows; Preferences as a list.
5. Activity: Conversation (notes and logged contact only, chat style) or Everything (the full list on its spine), chosen in the section; recent entries first with "Show earlier"; pinned note composer without an opportunity picker; fade on both edges.
6. Log contact: five-up channel control, Other's label attached to it, no direction for meetings, several opportunities per contact, roomier client card.

## Polish pass (2026-11-24)

1. Log contact is a sub-panel of the record's dialog (`SubPanel` in `src/lib/activity/sub-panel.svelte.ts`). The dialog widens to 60rem, the breadcrumb ends in Log contact, and Back, Escape, or a click outside steps back to the record with focus returned.
2. "What was this about?" offers New opportunity: a type and a title inline, created with the contact as a New lead with the client. It does not open the Pipeline's form, because that form would stack a dialog over the sub-panel. ACT-5 now says so.
3. Conversation draws consecutive messages about the same opportunity on one faint bubble in the type's color, with the opportunity's title on hover or focus. Touch screens always show the title at the thread's top. The chip under each message is gone from Conversation and stays in Everything.
4. The variant toolbar takes a `dock` position, and the client dialog docks it above the pinned bar. The Feedback tool had the same problem in production: until dragged, it now sits beside a side dialog, or above the dialog's pinned bar when there is no room.
5. Phone and touch: Log contact spans the header row on a narrow panel, a message's edit and delete show for the tapped message only, and the thread title does not stick over messages. The preview opens an opportunity from the client's Opportunities rows or the page button, in `src/routes/activity-preview/OpportunityPanel.svelte`, with only its own Activity, the shared `ActivitySection`, and Log contact asking nothing.
6. `docs/notes/client-activity.md` describes the prototype under Client panel prototype, and tasks 2.2, 3.3, 4.1, and 4.2 name the shared pieces.
7. The changed Svelte files went through `vp fmt`.

## Feedback pass (2026-11-24)

- Decisions recorded: one logged contact can cover several opportunities (ACT-2, ACT-5, task 2.1's `activity_opportunities`), Conversation and Everything are in the Vocabulary, and Latest attempt hides when it is the same contact (ACT-9, task 5.2). The client panel and Log contact's client card both follow it.
- The bands, formerly called threads, give each opportunity its own stretch of color when a message covers several. The fixture has one call about both opportunities.
- Opportunities open in the client's drawer with Back, the Registry breadcrumb, and Open full view over the drawer. Task 4.3 brings it to the Registry.
- Escape is caught as a keydown, because Chrome lets a page cancel a dialog's cancel only once between clicks. Focus returns to the opener after its pane stops being inert.
- Log contact: the new opportunity asks "What should we call this opportunity?", and When has no device-time note.
- Themes: the motifs use one vertical linear mask and are lighter. Instrument Serif display text is an eighth larger through `--font-display-adjust`.

## Status

`vp run check` passes. Inspected in a headless browser at 1280px: bands with one and two opportunities, an opportunity in the drawer, its Log contact, Escape back through each level, and Open full view closing back to the drawer. The phone pass from the earlier round was not repeated for the drawer's opportunity. Not inspected: reduced motion, the Registry's real client dialog, and keyboard-only use.

## Next

The developer accepted the prototype. Start task 2.1. Remove this log, the Activity data variant setting, and the `/activity-preview` route when task 3 replaces the fixtures.
