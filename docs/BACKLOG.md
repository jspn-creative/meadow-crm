# Backlog

What is left to build, in order. [SPEC.md](./SPEC.md) says what the product does; [WORKFLOW.md](./WORKFLOW.md) holds the current goal, approval gates, and status. This file only says what to build next. Finish an item, then delete its line; git history keeps the record.

## First release

The goal is to deploy as soon as possible so the business can start using Meadow CRM and giving feedback. Only these items block the release; the scope decisions behind them are in [SPEC.md's First release](./SPEC.md#first-release). Visual redesign is not part of this work.

1. Tasks, persisted in D1: title, date, due date, an optional link to one client or one opportunity; create, edit, complete, reopen, and delete by either business user; daily rollover and overdue in the business's timezone. Extend the existing `tasks` table and data service rather than starting over.
2. The release dashboard: one shared dashboard of Today's Tasks, Upcoming, and Recent activity, built from real records and history. Widgets that only show fixture data are removed from the release dashboard.
3. Real login, managed by the app with Better Auth: accounts for the realtor and the assistant created by a script, no public signup, logout, and password change. Every request, page, and data call requires login. The local development identity stays development-only.
4. Release tidy: remove demo and "not implemented" copy from production views, and hide Settings controls that cannot save. No new features.
5. Import the business's real client data from `docs/client-data.csv` with a one-time script, rehearsed against local D1 first, with counts and skipped rows reported to the developer.
6. Release checks: `vp run check`, the relevant automated tests, a production build, and a short phone and desktop pass of login, Pipeline, Registry, and tasks.
7. Alchemy, the last step before deploying: prove it on a non-production stage, then adopt it if it passes the criteria in [WORKFLOW.md](./WORKFLOW.md#alchemy).
8. Deploy: after the developer answers "lgtm ready to deploy?", provision production, deploy, apply migrations, create the two accounts, run the import, and confirm login on the production URL.

## After the first release

Not started unless the developer reprioritizes. Listed so nothing is lost.

- Task time, location, and repeat.
- Promote checklist items to tasks, and the stage-move dialog for open promoted tasks.
- Uploaded files as references (R2).
- Support admin account and impersonation, with both identities in history.
- Role-specific dashboards: the realtor's Key dates; the assistant's Inbox, Realtor's day, and Pipeline summary.
- Registry table on TanStack Table with hand-added, restyled SV Table components; search and filters in the URL; bulk tag and archive with "Select all matching clients" and Undo.
- Delete a client from the Registry, with the notice for its opportunities and tasks.
- Settings panels: Business settings, the tag vocabulary, relationship and address labels.
- Checklist template editor, chosen from prototypes reviewed with the developer.
- Board view options, settled over review rounds with the developer.
- Keeping both users' screens current: refresh on focus and navigation, polling while visible, overdue recomputed at the business's midnight.
- Git integration for deploys, attached after the first manual deploy.

## Waiting on an open question

Each needs a decision in [SPEC.md's open questions](./SPEC.md#open-questions) before it can be planned.

- The assistant's planner: whether Realtor's day and Upcoming combine into a full-width planner that open opportunity work can be dragged onto.
