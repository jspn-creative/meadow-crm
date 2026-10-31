# Meadow CRM

## Local development

For isolated development, install dependencies with `vp install`, configure `.dev.vars` from `.dev.vars.example`, then run `vp run dev`. Alchemy's `Website.SvelteKit` owns the local server at `http://localhost:1337` and supplies real simulator bindings through `platform.env`. The isolated database has separate local accounts, not production logins. **`vp dev` now starts live production development**, described below; it is not the isolated command. Drizzle.Schema generates SQL in `migrations/` from `src/lib/server/db/schema.ts`, including the auth tables; Alchemy D1 applies it and records `__alchemy_migrations`. There is no separate migration command or runner.

For a new local database, run `vp run db:seed` after the first dev startup to add the business defaults. Optionally run `vp run db:seed-fictional` for fictional records. Use `vp run db:help` for local database commands; `scripts/auth-users.ts` documents protected-stdin account setup. Neither seeding step is needed to retain existing local data; do not reset the database to fix a missing table.

Local account and seed scripts use Alchemy's public runtime platform proxy, the database ID in the dev stack's explicitly exported outputs, and `.alchemy/local` persistence. Start Alchemy dev before running them. They neither replay SQL nor open a separate `.wrangler` database. Real login is the default; the explicit loopback-only identity stub remains opt-in.

The exact Alchemy beta.84 runtime has a pinned package patch in `patches/`: its platform proxy must encode and decode statement chains recursively inside arrays and objects for native `D1.batch()` to work. This fixes the upstream transport itself, preserving transactional writes and Alchemy's database/migration ownership. Revalidate the restored DB tests before removing the patch on an upstream upgrade.

## Live production development

Run `vp dev` to connect `http://localhost:1337` to the retained production `meadow-db` in JSPN. The Vite config delegates this shortcut to the existing `vp run dev:live` entrypoint rather than starting a second server without bindings; Alchemy's own injected Vite configuration skips the shortcut. This is not a snapshot: app changes, including deletion, affect production immediately. Sign in with an existing production account and password. Credentials and the production auth secret come from ignored `.env`; the wrapper defaults to the fixed JSPN account and rejects any other account. The localhost auth origin does not change production's trusted origin. Stop any existing server on port 1337 before launching another; the shortcut does not stop or replace running servers.

The separate `alchemy.live.ts` entrypoint references `Meadow/prod/Database` through Alchemy's native cross-stage resource reference. Real D1 IDs use its native `D1.remote()` preview binding. It declares no database, Drizzle schema, migrations, seed, or import, and refuses deployment and identity stubs. The reference uses the existing Cloudflare state backend; production's database/Worker declarations and retention are unchanged. Startup validates the exact account/database and prints only an aggregate client count.

Ordinary dev and local operational scripts still use only the isolated `Meadow/dev` simulator database; they do not follow the live binding. Playwright refuses to reuse an existing server and starts the ordinary isolated entrypoint. Stop live dev before starting ordinary dev or automated tests on port 1337. Never point automated tests, fictional fixtures, or reset scripts at production.

## Verification

These are command references, not a checklist to run on every change. AGENTS.md owns approval gates, ordinary-task checks, and commit-time build and regression deferrals.

- `vp run check`: Svelte and TypeScript diagnostics.
- `vp test`: unit and local D1 tests using isolated simulator storage and generated migration SQL. Run tests only under the approval conditions in AGENTS.md.
- `vp run test:shell`: Playwright interactions under Alchemy dev; it refuses an existing server. Its setup seeds the existing fictional fixtures after Alchemy has migrated D1. This currently uses the dev stage's local database, so use fictional records only.
- `vp run build`: Alchemy's SvelteKit adapter and workerd bundling pass, without provisioning or deploying resources. Plain `vp build` has no adapter and is not deployment proof.
- `vp run test:runtime`: an isolated Alchemy D1 binding check. `vp run test:production`: the prebuilt production Worker's denial checks in isolated Miniflare/workerd; requires `vp run build` first. Neither reads the normal local database. The old pre-baseline dev-startup upgrader was retired with the legacy migrator.
