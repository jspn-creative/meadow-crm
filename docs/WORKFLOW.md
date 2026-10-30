# Workflow

Checkpoint for the first release. [SPEC.md](./SPEC.md) is product direction, with [First release](./SPEC.md#first-release) the confirmed scope; [BACKLOG.md](./BACKLOG.md) is the work order. OpenSpec was removed on 2026-10-30 and is not a source.

## Goal

Deploy the first release as soon as possible so the business can use Meadow CRM and give feedback. The UI is largely built and its visuals are settled: work is function, security, data, and deployment, not redesign.

## Status (verified 2026-10-30 by code audit, not runtime)

- Done and persisted in D1: clients (people, addresses, tags, consent, history), opportunities, the board with stages, pins, and archive, per-stage checklists with per-item edits, web-link and record references, revision guards on saves, bookmarks in the browser, themes, the Glossary.
- Tasks persist in D1 with a required date and optional due date (migration `0007_task_dates.sql`); checklist item dates are hidden in the release (`src/lib/data/release.ts`). Done 2026-10-30.
- The release dashboard shows Today's Tasks, Upcoming, and Recent activity from real records and history. Done 2026-10-30.
- Better Auth login uses persisted D1 sessions for the two business users, fixed business identities, a disabled public signup, logout, and account-menu password change. `scripts/auth-users.ts` creates accounts and resets forgotten passwords by hand; resets revoke existing sessions. Real login is the local default; the loopback identity stub requires explicit `LOCAL_IDENTITY_STUB=true` and is ignored in production.
- The support admin account uses the same account script with `role: "support-admin"`. Better Auth's admin plugin issues one-hour impersonation sessions; every CRM request verifies their binding to a live support-admin session. Before choosing a business user, after exiting, and after expiry, no CRM data is available. History records both identities; switching and exiting revoke the previous impersonated session and clear document caches, including other tabs.
- Registry is a simple list with name search and a client side panel; usable for the release.
- Settings is development-only; production returns 404 and the account menu omits it.
- `vp run db:import-clients` dry-runs by default and applies to local D1 with `-- --apply`; it is local-only until Backlog 8.
- `wrangler.jsonc` is local-only: placeholder D1 ID, `remote: false`, `LOCAL_DEMO_USER`.

## Cloudflare resources (read-only check, account JSPN, 2026-10-30)

- No Meadow D1 database or R2 bucket exists, so production starts from nothing.
- One Worker named `meadow` exists (created 2026-10-10, never updated). The developer confirmed on 2026-10-30 that it was a prototype and production may take over its name.
- Other Workers and D1 databases on the account belong to unrelated projects and are out of scope.

## Gates

- [x] OpenSpec replaced by SPEC, BACKLOG, and this checkpoint (2026-10-30).
- [x] First release scope confirmed by the developer in this session (2026-10-30), recorded in SPEC.
- [x] Backlog 1-2: tasks and release dashboard implemented; `vp run check` passes (2026-10-30; DB tests, Playwright shell suite, and build also pass).
- [x] Backlog 3: login implemented and every route and remote function refuses unauthenticated requests; `vp run check`, DB tests, Playwright shell suite, build, prebuilt production denial smoke, and local browser login/password change/logout pass (2026-10-30, verified by the orchestrator).
- [x] Backlog 3a: support admin and impersonation implemented; check, build, prebuilt production forgery smoke, and local browser selection, both identities in history, switch/replay denial, exit, expiry, and business-user denial pass (2026-10-30). Verification tasks were deleted; no Cloudflare changes.
- [x] Backlog 4-5: release tidy done; import rehearsed locally with counts reported to the developer (2026-10-30: Settings hidden in production; 827 of 840 clients import, 3 test records and 10 nameless skipped; unmapped columns go to the read-only Imported data field).
- [ ] Backlog 6: release checks pass (check, relevant tests, build, short phone and desktop pass).
- [ ] Backlog 7: Alchemy go or no-go decided by the developer from the spike's evidence.
- [ ] Developer answers "lgtm ready to deploy?" with approval.
- [ ] Backlog 8: deployed; login confirmed on the production URL; import counts match the rehearsal.

## Approval boundaries

- Ask the developer before: anything that changes Cloudflare (creating, deleting, or deploying resources, secrets, DNS), running the import against production, adding or changing automated tests, changing scope beyond BACKLOG's First release, or choosing a product behavior SPEC does not settle.
- "lgtm ready to deploy?" is the whole release gate. Ask it once Backlog 1-7 are done, with a few lines of evidence: checks run and their results, the Alchemy decision, and the production URL and resource names that will be created.
- The developer authorized on 2026-10-30 one commit per completed backlog item, at most, after commit preparation checks. Never push.
- The developer authorized on 2026-10-30 updating or deleting existing automated tests that a change breaks or that are low-value; writing new tests still needs a request.
- Security and data safety are not waived by the light gate: no public signup, login on every request, secrets only as Worker secrets, no client data in logs, and the production D1 protected from deletion by tooling.
- `docs/client-data.csv` holds real client data and is tracked in git. Do not copy it into build output, logs, or prompts; tell the developer before any push to a shared remote.

## Alchemy

The developer wants Alchemy adopted as the last step before deploying, while production resources do not yet exist and can still be recreated freely. Evidence from 2026-10-30 research:

- Alchemy is v2 beta (`2.0.0-beta.84`, 2026-10-24) and its README expects breaking changes. Pin an exact version.
- `Cloudflare.Website.SvelteKit` loads `vite.config.ts` and injects its own adapter during its own build; no documented way to deploy prebuilt output or to make `vp build` its build command. Compatibility with the `vite-plus-core` override and `@sveltejs/adapter-cloudflare` 8 is undocumented.
- State lives in `.alchemy/<app>/<stage>/` by default (committable) or in a Cloudflare state store. Removing a resource from code or running destroy deletes it unless it has a retain policy.
- `Cloudflare.D1.Database` applies numbered SQL migrations from a directory, tracks them in `__alchemy_migrations`, and is documented to adopt Drizzle and Wrangler history; confirm `drizzle/` naming fits.
- Worker secrets use `Config.Redacted`; `ALCHEMY_PASSWORD` encrypts secrets in state and is separate from Worker secrets. OAuth or `CLOUDFLARE_API_TOKEN` authenticate.

The developer approved the spike on 2026-10-30: a temporary `spike`-suffixed Worker, D1, and Worker secret on account JSPN with fictional data only, destroyed afterwards. Spike on a non-production stage, timeboxed to two focused attempts. Go only if all hold:

1. Alchemy builds and deploys this app with the Vite+ override in place, and `vp dev`, `vp build`, and `vp run check` still work unchanged locally.
2. A stage D1 is created and `drizzle/` migrations apply in order.
3. A Worker secret reaches the app, and login works on the stage URL.
4. The production D1 is declared with a retain policy, and state storage is chosen (committed `.alchemy/` or a remote store) and recorded.
5. The stage is destroyed afterwards and nothing outside it changed.

On no-go, stop and bring the evidence to the developer; do not fall back silently. The alternative is a production config for the adapter plus `cf deploy --prebuilt`.

On go, AGENTS.md's Cloudflare section needs revising in the same change: Alchemy owns provisioning and deploys and its build path is the one exception to "`vp` owns build" for deployment only; `cf` stays for read-only inspection; `wrangler.jsonc` stays for local D1 development unless the spike proves Alchemy's dev path works with Vite+; state location, the retain rule for production data, and `ALCHEMY_PASSWORD` handling are recorded.

## Delegation

The orchestrating session keeps cross-item decisions and final verification. Use GPT-6 Luna (`openai/gpt-6-luna`) for scouting and mechanical work with objective acceptance, such as the release tidy and the import script's field mapping; GPT-6.1 Sol (`openai/gpt-6.1-sol`) for bounded difficult work, such as the tasks data layer, login and route protection, and the Alchemy spike. Do not parallelize items that touch `schema.ts`, `data.ts`, or `crm.remote.ts`.

## Next

Orchestration session running Backlog 1-8, through deployment and not beyond. Next: Backlog 6 release checks, then the approved Alchemy spike (Backlog 7).
