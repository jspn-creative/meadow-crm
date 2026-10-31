# Alchemy deployment audit

Finalized 2026-10-30 against alchemy.run's current docs and the installed `2.0.0-beta.84` packages (still npm `latest`). Supersedes the earlier draft of this audit, which defended the spike's workarounds instead of following Alchemy's documented paths.

## Direction

The project is still in development with no real production data, so nothing about the current migration history, journal, or local migration runner needs preserving. Use Alchemy's tools the way its docs intend, and remove the workarounds built around them.

- **Website:** replace the generic `Cloudflare.Worker` over prebuilt `vp build` output with `Cloudflare.Website.SvelteKit` ([guide](https://alchemy.run/cloudflare/frontend/sveltekit)). It loads `vite.config.ts`, injects its own wrangler-free adapter, binds `env` onto `platform.env` with an inferred `WebsiteEnv` type, and runs SvelteKit's own Vite dev server under `alchemy dev` with real local bindings. This retires `@sveltejs/adapter-cloudflare`, `wrangler.jsonc`, the hand-rolled platform proxy, and the deploy script's build step. The spike's objection ("no way to deploy prebuilt output") was a preference for keeping the old pipeline, not a defect.
- **Database and migrations:** `Cloudflare.D1.Database({ migrations: schema })` fed by `Drizzle.Schema("Schema", { schema, dialect: "sqlite" })` from `@alchemy.run/drizzle` ([D1 reference](https://alchemy.run/providers/cloudflare/d1), [Drizzle.Schema](https://alchemy.run/providers/drizzle/schema)). Drizzle.Schema regenerates migration SQL from the TypeScript schema during `alchemy deploy` and `alchemy dev`; D1 applies it. Editing `schema.ts` is the whole workflow: no hand-run `drizzle-kit generate`, no journal, no second runner. Alchemy's `__alchemy_migrations` is the only history table, locally and in production.
- **Fresh baseline:** delete `drizzle/` (SQL, snapshots, legacy journal), the `.alchemy/migrations` staging copy in `alchemy.run.ts`, `scripts/migrations.ts`, `src/lib/server/db/migrate.ts`, and the `meadow_migrations` table. Drizzle.Schema generates one initial migration from the current schema.
- **Better Auth:** keep upstream `better-auth` with `@better-auth/drizzle-adapter`, and fold the auth tables into the single Drizzle schema so Drizzle.Schema owns them too. Generate them with the Better Auth CLI into `auth-schema.ts` and include that file in the schema input.
- **Secret:** keep `BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET")` in the Website's `env`. Alchemy can also generate a stable secret with `Alchemy.Random`; either way the value lives in encrypted `Cloudflare.state()`, which stays the backend.

## Better Auth wrapper finding

`@alchemy.run/better-auth` does not fit a SvelteKit app. Every example and the `CloudflareD1` layer reference require an Effect-native `Cloudflare.Worker` class whose construction Effect yields `BetterAuth(...)` and whose handlers are Effect `HttpServerRequest` code. `Website.SvelteKit` returns a Worker whose server is SvelteKit's generated output, so there is no construction Effect to provide the layer to. Adopting it would mean a separate Effect auth Worker beside the site, and the app's hooks calling it over a service binding.

Its two relevant database layers also conflict with the direction above:

| Layer | Schema owner | Fit |
| --- | --- | --- |
| `CloudflareD1` | The wrapper's Kysely-based additive auth migrations at deploy | A second migration owner beside Drizzle.Schema for the same D1 |
| `Drizzle` | The application; `migrate: true` fails | Adds nothing over upstream Better Auth with the Drizzle adapter, which Meadow already uses |

The [database comparison](https://alchemy.run/better-auth/databases/) frames D1 as "native binding, deploy-time migrations, no interactive-transaction plugins" and Drizzle as "application-owned schema, Relations v2 adapter". For Meadow, the Drizzle row is the right one, with Alchemy's Drizzle.Schema supplying the automatic migrations the D1 layer would otherwise provide. Revisit the wrapper only if the app gains an Effect-native API Worker.

## Version alignment

`@alchemy.run/drizzle@2.0.0-beta.84` peers on `drizzle-orm` and `drizzle-kit` `1.0.0-rc.5-ab785fc`; Meadow is on `drizzle-orm` 0.45 and `drizzle-kit` 0.31. Upgrade both to that exact pin. Meadow uses no relational `db.query` or `relations()` code, so the query-builder change is small. `@better-auth/drizzle-adapter` 1.7 supports Relations v2 via its `/relations-v2` entry. `@alchemy.run/frontend-frameworks@2.0.0-beta.84` is required as a dev dependency for `Website.SvelteKit`; it peers on `@sveltejs/kit >=3` and `vite ^7 || ^8`.

## Risks to prove in the local spike

None need cloud access; `alchemy dev` uses local simulators for D1 and the Website.

1. **Vite+ compatibility.** `package.json` overrides `vite` with `@voidzero-dev/vite-plus-core`, and Alchemy loads `vite.config.ts` itself. Confirm `alchemy dev` and a local build succeed, and decide whether `vp` keeps owning `dev`/`check` while Alchemy owns `alchemy dev`/`deploy`.
2. **Hand-written SQL.** Migrations 0001 and 0003 contain triggers, and several contain `CHECK` constraints. Drizzle 1.0 expresses `check()` in the schema; triggers need a custom migration. Confirm Drizzle.Schema keeps a custom SQL file in its output directory across regenerations, or move the triggers into application code.
3. **Non-interactive generation.** `drizzle-kit generate` prompts on ambiguous renames. Confirm what Drizzle.Schema does on a rename during deploy; if it fails or guesses, renames need a hand-written step.
4. **State during dev.** `Cloudflare.state()` may bootstrap or upgrade the account-wide backend when loaded. Use `Alchemy.localState()` for dev stages unless the docs show dev skips the remote backend.
5. **Tests.** Existing DB tests boot D1 through wrangler's `getPlatformProxy` and the old migrator. Port them to a local D1 with the generated migrations or delete low-value ones; WORKFLOW already authorizes updating tests a change breaks.

## Production-shaped local data

Alchemy covers this without a custom export pipeline:

- `Cloudflare.D1.Database({ clone: { name: "meadow-db" } })` performs a full export and import from the source database **when the clone is first created**. A `staging` stage with a cloned D1 gets production data in a separate database with no write path back. Refreshing means destroying and recreating that stage's database. Clone runs in the cloud provider only; the local simulator does not clone.
- `importFiles: ["./snapshots/meadow.sql"]` seeds a database from SQL files, re-importing only when a file's hash changes, and works in the local simulator. Pair it with a dump taken from the staging clone for an offline local copy.

Cloudflare's D1 export blocks other queries on the source while it runs, so clone off-hours once the business relies on production. Strip sessions and reset local passwords after cloning. This is post-release work.

## Credentials

- Existing scoped `CLOUDFLARE_API_TOKEN` and account ID from the environment are sufficient; Alchemy's token-minting CLI is optional. Replace the token only if a deploy fails on a missing permission.
- Encrypted `Cloudflare.state()` holds resolved `Config.Redacted` values and generated secrets; that is expected. Never print state or commit `.alchemy/`.
- Loading `Cloudflare.state()` can bootstrap the account-wide `alchemy-state-store` or upgrade it on a version mismatch, which is expected; never destroy it.

## Production

Worker `meadow`, D1 `meadow-db` with `RemovalPolicy.retain`, URL `https://meadow.jspn.workers.dev`. With no real data yet, the first deploy creates a fresh database; if a prototype `meadow-db` or `meadow` Worker exists and holds nothing worth keeping, replace it rather than adopting its history. The client import runs right after deploy.

## Local integration proof (2026-10-30)

- Vite+: `vp run dev` runs Website.SvelteKit at `http://localhost:1337`; the Website declares that strict port and the matching auth origin. `vp run build` invokes Alchemy's framework build API, including its SvelteKit adapter and workerd finishing pass, without provisioning cloud resources. Plain `vp build` is not adapter proof.
- SQL: the final legacy progress triggers allow an item owned by the checklist or by its retained template, without the superseded `customized` flag. `saveChecklistStep` uses that same source predicate inside its guarded transaction. The other application progress insert copies to a freshly inserted local item on the same checklist. No custom migration or second history table is needed. Five restored DB test files retain 29 existing tests against isolated Alchemy simulator bindings and generated SQL.
- Auth schema: generated offline using `vp dlx -- auth@1.7.7 generate --adapter drizzle --dialect sqlite --config scripts/auth-schema-config.ts --output <review-file> --yes`. The deprecated `@better-auth/cli` package does not publish 1.7.7; `auth` is the current CLI. Meadow retains its physical `auth_` names, stricter identity constraints, credential uniqueness, and support-session binding. Generated legacy `relations()` declarations are omitted because the app uses the Relations v2 adapter and flat queries. Defaults and indexes were reconciled with the generated output; Drizzle.Schema produced the corresponding SQL.
- Non-interactive changes: installed `@alchemy.run/drizzle/src/Schema.ts` delegates ambiguous changes to drizzle-kit's CLI; `missing_hints` exit 2 fails with a decision request rather than guessing. Resolve a real ambiguity through an interactive Alchemy run; do not add a separate migration runner or silently answer rename/data-loss prompts.
- State and local tooling: only `prod` uses `Cloudflare.state()`; dev uses `Alchemy.localState()`. Account/seed/import scripts attach through the public `@alchemy.run/cloudflare-runtime/core/platform-proxy` API with `D1.local`, the dev stack's explicitly exported database ID, and `.alchemy/local` storage. They never replay migration SQL. Remote scripts verify both the JSPN account and the `meadow-db` database name before querying.
- Upstream runtime defect: exact beta.84 loses pending statement chains inside arrays on encode and fails to rehydrate them on decode, breaking `D1.batch()` in Website dev as well as scripts. The package-manager patch in `patches/` fixes recursive transport in the source and shipped runtime artifacts. It preserves native transaction behavior, migration ownership, exact dependency pins, and local storage. Remove it only after an upstream version passes the restored DB coverage.
- Runtime acceptance used a generated temporary local credential kept in memory and passed over protected stdin, never tool arguments or logs. Real browser login, rendered Dashboard/Pipeline/Registry, client form persistence, opportunity creation/stage movement, checklist progress, and task create/complete/delete succeeded. No production account, client CSV, or cloud deploy was involved. Paid repair was used after Beam Free failed the same bounded integration repair twice, as WORKFLOW permits.
- Verification: Svelte/type diagnostics passed with zero errors or warnings, the Alchemy Website build produced 65 server modules, all 29 restored DB tests passed, and the ported isolated binding and prebuilt production-denial checks passed. Playwright reported 40 passed and 34 skipped using fictional local fixtures; skipped tests are not runtime acceptance evidence. Use `vp exec -- playwright test tests/data-boundary.spec.ts --project=desktop` for the focused boundary spec; inserting a literal `--` before Playwright's file/options prevents the intended filtering.

## Explicit live production development (2026-10-30)

- The developer explicitly requested a live connection, not a clone or import, and acknowledged that app changes must affect production. `vp run dev:live` uses the separate `alchemy.live.ts` stack, a native `Cloudflare.D1.Database.ref("Database", { stack: "Meadow", stage: "prod" })`, and the existing Cloudflare state backend for reference resolution. It declares only a local Website, never a managed database, Drizzle schema, migrations, fixtures, or imports. Production resource declarations and retention are unchanged.
- Installed beta.84 evidence: `cloudflare/src/Workers/RuntimeBindings.ts` maps real D1 IDs to runtime `D1.remote()`; that hook wraps the native D1 API over Alchemy's edge-preview binding transport. No custom SQL proxy or production Worker deployment was added. The live entrypoint refuses non-dev execution and identity stubs; the wrapper validates JSPN and the exact `meadow-db` UUID before starting.
- Startup's read-only API preflight confirmed database `f3dcaa0f-97ad-4403-b32d-a2164027c64d` named `meadow-db` and 827 clients. Alchemy separately resolved the production resource reference to that same UUID and started `http://localhost:1337`. Public `/login` returned 200 with a password form, `/registry` redirected to login, and responses retained `private, no-store`. Authenticated UI acceptance awaits the developer's login; no account, password, or client record was changed for verification.
- Local auth uses the existing `createAuth` behavior with the explicit localhost base URL and trusted origin; production auth configuration, request-origin checks, session verification, and cross-user cache clearing were not weakened or edited. Ordinary dev, Playwright's non-reused server, isolated DB tests, and local scripts still use their original simulator paths and never select this entrypoint. No automated tests were run; `vp run check` passed with zero errors or warnings.
