# Backlog

What is left to build for the MVP, in rough dependency order. [SPEC.md](./SPEC.md) says what the product does; this file only says what to build next. Each item is one piece of work for one session: plan it, ask about anything SPEC.md does not settle, build it, then delete the line. Git history keeps the record.

## Next

1. Remove the `/inbox` and `/tasks` placeholder views and their links and tests.
2. Allow creating and saving an opportunity with no client; today validation requires one.
3. Make changing an opportunity's type replace its checklists with the new type's templates; today visited stages keep their old checklists.
4. Pipeline board: four stages holding every type, filters for type and timeline, sorting by timeline, archived opportunities never shown.
5. Move opportunities between stages from the board and from the detail view, recording history.
6. Archive and restore opportunities, with a view of archived ones.
7. Per-item checklist edits: add, remove, rename, and reorder items on one opportunity, while template changes keep reaching the items not edited there. This replaces today's whole-stage "customized" flag.
8. Client create and edit in a side panel, with history and the client's opportunities inline.
9. Registry table on TanStack Table with hand-added, restyled SV Table components: search, filters, sorting, pagination, and column controls.
10. Keep Registry search and filters in the URL.
11. Bulk tag and archive, with Gmail-style "Select all matching clients"; archived clients can be searched and restored.
12. Business settings (name, timezone, date format, fixed USD) and the tag vocabulary: add, rename, recolor, and retire with an offer to strip.
13. Tasks with a date, due date, time, location, and repeat; daily rollover; overdue status; create, edit, complete, and reopen by either business user.
14. Promote checklist items: a date or due date creates a linked task that references the opportunity; completing, reopening, and deleting stay in sync both ways.
15. The stage-move dialog that asks whether to complete, delete, or ignore each open promoted task from the current stage.
16. Two dashboards: the realtor's with Today's Tasks, and the assistant's with the Inbox widget.
17. Keep both users' screens current: refresh on focus and navigation, poll while visible, and recompute overdue at the business's midnight.
18. Real login, managed by the app: accounts for the realtor, the assistant, and the support admin, with no public signup, plus logout and password change.
19. Support admin impersonation with a visible indicator while impersonating, and both identities in history.
20. Require login for every request, page, and data call.
21. Full pass before real data: phone, tablet, and desktop; keyboard; reduced motion; every automated check.
22. Import the business's real client data with a one-time script.

## Waiting on an open question

Each of these needs a decision in [SPEC.md's open questions](./SPEC.md#open-questions) before it can be planned.

- The checklist template editor in Settings.
- Viewing an earlier stage's checklist without moving the opportunity.
- What the Inbox lists.
- The other dashboard widgets: pipeline summary, Recent activity, and Upcoming events.
- Nurture follow-ups and timeline follow-ups.
- Delete options.
- How Settings is organized, and whether modules or Tasks can be switched off.
- Whether a bulk change that cannot apply to some selected clients changes nothing or changes the rest.
- File uploads as references.
- What happens to promoted tasks when a type change replaces their checklist items.

## Dropped from the OpenSpec plan

- The whole-stage checklist detach, per-stage reset, and per-stage rebase (tasks 6.2): replaced by per-item edits, no reset, and type changes that replace checklists.
- The checklist "attention scope" setting (6.5): overdue is now a task status, and the stage-move dialog handles open work from the previous stage.
- The `query.live` streaming experiment (8.6): polling (item 17) is enough for two users.
- The long acceptance matrix (9.1–9.3): folded into item 21.
