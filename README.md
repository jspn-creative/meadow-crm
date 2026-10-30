# Meadow CRM

## Local development

Install dependencies with `vp install`, then run `vp dev` (or `vp run dev:host` to expose the dev server). Dev startup applies pending SQL migrations to local D1 before accepting requests, including when using a custom `MEADOW_LOCAL_STATE_DIR`. Migration failures stop startup instead of leaving requests to fail with missing-table errors. Builds and preview never apply migrations, and nothing here migrates a remote database.

For a new local database, run `vp run db:seed` after the first dev startup to add the business defaults. Optionally run `vp run db:seed-fictional` for fictional records. Use `vp run db:help` for identity setup and the other local database commands. Neither seeding step is needed to retain existing local data; do not reset the database to fix a missing table.

If updating a database while dev is already running, restart dev or run `vp run db:migrate` with the same `MEADOW_LOCAL_STATE_DIR` as the server. Migrations are recorded and only applied once.

## Verification

- `vp run check`: Svelte and TypeScript diagnostics.
- `vp test`: unit and local D1 tests using isolated storage.
- `vp run test:dev-startup`: upgrade an isolated old local database through dev startup, verify records survive, and repeat after a restart (uses port 5183).
- `vp run test:shell`: Playwright interactions using `.wrangler/test-shell`, not your normal local database.
- `vp build`: production build with the Cloudflare adapter.
- `vp run test:production`: local production Worker smoke test; requires a build first.
