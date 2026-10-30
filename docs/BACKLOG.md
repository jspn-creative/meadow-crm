# Backlog

What is left to build for the MVP, in rough dependency order. [SPEC.md](./SPEC.md) says what the product does; this file only says what to build next. Each item is one piece of work for one session: plan it, ask about anything SPEC.md does not settle, build it, then delete the line. Git history keeps the record.

## Next

1. Uploaded files as references, with a friendly name, on clients and opportunities; tasks get them when they are built.
2. Registry table on TanStack Table with hand-added, restyled SV Table components: search, filters, sorting, pagination, and column controls.
3. Keep Registry search and filters in the URL.
4. Bulk tag and archive, with Gmail-style "Select all matching clients": apply to every client possible, say which were skipped and why, and offer Undo for the whole change right after; archived clients can be searched and restored.
5. Settings panels for User preferences, Business settings, and each module; Business settings (name, timezone, date format, fixed USD); the tag vocabulary: add, rename, recolor, and retire with an offer to strip; and the relationship and address labels.
6. Checklist template editor in Settings: prototype layouts for the developer to choose from, then build the chosen one. Edits are drafted and saved together with a count of the opportunities they reach; a removed item stays where it is checked off or promoted.
7. Tasks with a date, due date, time, location, and repeat; daily rollover; overdue status; create, edit, complete, and reopen by either business user.
8. Delete a client from the Registry: a notice lists the client's opportunities (delete, archive, or leave alone, each) and tasks linked directly to the client (delete or leave alone, each); whatever is left alone loses the link.
9. Promote checklist items: a date or due date creates a linked task that references the opportunity; the title, completing, reopening, and deleting stay in sync both ways.
10. The stage-move dialog that asks whether to complete, delete, or ignore each open promoted task from the current stage.
11. Board view options: a discreet panel choosing which card details show (client names, checklist progress for the current stage, overdue marker, budget or price), saved in the browser. Card design and options settle over review rounds with the developer.
12. The realtor's dashboard: Today's Tasks, Upcoming (tasks dated or due in the next several days), and Key dates (clients' birthdays and key dates in the next few weeks).
13. The assistant's dashboard: the Inbox (overdue tasks, and records the realtor created until the assistant marks them done), Realtor's day (editable but locked against accidental edits), Upcoming, Pipeline summary, and Recent activity.
14. Keep both users' screens current: refresh on focus and navigation, poll while visible, and recompute overdue at the business's midnight.
15. Real login, managed by the app: accounts for the realtor, the assistant, and the support admin, with no public signup, plus logout and password change.
16. Support admin impersonation with a visible indicator while impersonating, and both identities in history.
17. Require login for every request, page, and data call.
18. Full pass before real data: phone, tablet, and desktop; keyboard; reduced motion; every automated check.
19. Import the business's real client data with a one-time script.

## Waiting on an open question

Each of these needs a decision in [SPEC.md's open questions](./SPEC.md#open-questions) before it can be planned.

- The assistant's planner: whether Realtor's day and Upcoming combine into a full-width planner that open opportunity work can be dragged onto. A design exploration with the developer.

## Dropped from the OpenSpec plan

- The whole-stage checklist detach, per-stage reset, and per-stage rebase (tasks 6.2): replaced by per-item edits, no reset, and opportunity types that never change.
- The checklist "attention scope" setting (6.5): overdue is now a task status, and the stage-move dialog handles open work from the previous stage.
- The `query.live` streaming experiment (8.6): polling, in the item that keeps both users' screens current, is enough for two users.
- The long acceptance matrix (9.1–9.3): folded into the full pass before real data.
