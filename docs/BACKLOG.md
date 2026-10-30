# Backlog

What is left to build, in order. [SPEC.md](./SPEC.md) says what the product does; [WORKFLOW.md](./WORKFLOW.md) holds the current goal, approval gates, and status. This file only says what to build next. Finish an item, then delete its line; git history keeps the record.

## First release

The goal is to deploy as soon as possible so the business can start using Meadow CRM and giving feedback. Only these items block the release; the scope decisions behind them are in [SPEC.md's First release](./SPEC.md#first-release). Visual redesign is not part of this work.

6. Release checks: `vp run check`, the relevant automated tests, a production build, and a short phone and desktop pass of login, Pipeline, Registry, and tasks.
7. Alchemy, the last step before deploying: prove it on a non-production stage, then adopt it if it passes the criteria in [WORKFLOW.md](./WORKFLOW.md#alchemy).
8. Deploy: after the developer answers "lgtm ready to deploy?", provision production, deploy, apply migrations, create the two accounts, run the import, and confirm login on the production URL.

## After the first release

In rough dependency order; not started unless the developer reprioritizes. Behavior is in [SPEC.md](./SPEC.md), which was largely drafted with the developer rather than confirmed line by line, so confirm the details an item depends on when it is planned. "Done when" lists the checks worth keeping from the earlier plan.

1. Keep both users' screens current: refresh on focus and navigation, poll while visible, pause while hidden, recompute dates at the business's midnight. Done when a change in one session appears in another, a hidden tab stops polling, rollover happens at the business's midnight, and no refresh discards an unsaved edit.
3. Task time, location, and repeat, after the discovery noted in [SPEC.md's open questions](./SPEC.md#open-questions).
4. Promote checklist items to tasks, and the stage-move dialog for open promoted tasks.
5. Previous-stage checklist inspection: the visited-stage strip with previews and a way back. Done when it works by touch and keyboard, never moves the opportunity, and keeps unsaved edits.
6. Role-specific dashboards: the realtor's Key dates; the assistant's Inbox, Realtor's day, and Pipeline summary.
7. Uploaded files as references (R2), after the rules noted in SPEC.md's open questions.
8. Registry table on TanStack Table with hand-added, restyled SV Table components: search, filters, sorting, pagination, and column controls. Done when combined search and filters behave together, the layout works on phones, and no client shows a tag twice.
9. Registry search, filters, sorting, and page in the URL. Done when reload, bookmarks, Back, Forward, and invalid values all restore a sensible view.
10. Bulk tag and archive, with "Select all matching clients", skipped clients and reasons, and Undo for the whole change; archived clients can be searched and restored.
11. Delete a client from the Registry, with the notice for its opportunities and tasks.
12. Settings panels: User preferences, Business settings, the tag vocabulary, relationship and address labels.
13. Checklist template editor, chosen from prototypes reviewed with the developer. Done when empty templates work, progress survives renaming and reordering, a failed save keeps the draft, and it is usable on a phone.
14. Board view options, settled over review rounds with the developer.
15. Git integration for deploys, attached after the first manual deploy.

## Waiting on an open question

Each needs a decision in [SPEC.md's open questions](./SPEC.md#open-questions) before it can be planned.

- The assistant's planner: whether Realtor's day and Upcoming combine into a full-width planner that open opportunity work can be dragged onto.

## Dropped from the earlier OpenSpec plan

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
