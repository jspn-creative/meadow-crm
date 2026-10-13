
# AGENTS

## Implementation scope

The approved `build-core-crm-mvp` change moves implementation into the Svelte app. Follow its tasks and acceptance criteria when applying that change; do not limit product implementation to [static/example.html](static/example.html). Static HTML files remain visual references and should stay unchanged unless explicitly requested. Remove gallery-only routes/modules/links during the planned runtime task, not the static references themselves.

## Git

Never commit unless explicitly asked. Leave changes in the working tree so the human can review them first. This covers `git commit`, `git commit -a`, and anything that commits implicitly (`git stash pop` after a conflict is fine, but do not resolve-and-commit). `git add`, `git status`, `git diff`, `git log`, and `git stash` are fine to use freely.

When the user does ask for a commit, ask what to include if the tree has unrelated changes — do not sweep up work you did not make. Do not push, create branches, amend, or rewrite history unless that request was explicit too.

Commit messages use a simplified Conventional Commits form: a type, a colon, and a single lowercase imperative sentence describing the change. No scope parentheses, no `!` markers, no trailing period, no body unless the user asks for one. `chore: drop the unused pipeline options doc`, `fix: stop the timeline overlapping on mobile`, `docs: explain how the archive rules work`. Stick to the obvious types — `feat`, `fix`, `chore`, `docs`, `refactor`, `test` — and do not invent new ones. So not `fix(ui): ...`, not `Fixed the thing.`, not a bulleted changelog.

## Commands

This project uses Vite+ (`vp`). Run everything through `vp`, and follow whatever Vite+ guidance is already loaded in your context.

## Cloudflare

Cloudflare work goes through `cf`, Cloudflare's CLI, which is installed globally (currently v1.0.0-beta.5). It covers the entire Cloudflare API — 3,000+ operations across Workers, D1, R2, KV, DNS, Access, Tunnels, and the rest. Use it instead of `wrangler`; Wrangler is in maintenance-only support and Cloudflare is steering agents to `cf`.

**This app targets Cloudflare.** The prototype currently uses `@sveltejs/adapter-static`; the working product targets `@sveltejs/adapter-cloudflare`. Use `cf` for Cloudflare provisioning, bindings, deployment, and inspection, and verify the actual adapter/config path before deploying.

What `cf` must not do is silently take over the build. `vp` owns dev, build, and check, and `cf` is Vite-based, so a plain `cf deploy` would build through its own pipeline and pull in the Cloudflare Vite plugin, fighting `vp` and the `vite-plus-core` pin in `package.json` `overrides`. Avoid `cf init`, `cf migrate`, and `cf dev` for the same reason — they restructure project config, and the adapter stays wired in `vite.config.ts`. For a separately approved deployment, verify the prebuilt output/config path before using `cf deploy --prebuilt`; do not make a `cf` config migration a prerequisite for local MVP implementation.

The `build-core-crm-mvp` change covers local implementation and acceptance only. Use the Cloudflare adapter's required Wrangler configuration for its local D1 runtime; this config dependency does not authorize switching deployment tooling to the Wrangler CLI. Do not introduce `cloudflare.config.ts`, a competing config, provisioning, deployment, live migrations, or git integration as part of this change. The operational guidance below applies only to separately requested Cloudflare work.

**Deployment sequence: manual first, git integration second.** The first deploy is done by hand via `cf`, and git integration is attached to the already-deployed site afterwards. This is deliberate — a pipeline that builds on every push surfaces requirements as a run of failed builds, and the first several almost always fail while bindings, routes, and compatibility dates get settled. A manual deploy surfaces the same requirements immediately, with the error in front of you. Do not propose wiring up git integration as the first step, and do not treat early deploy failures as a reason to reach for CI.

Once integration exists, prefer pushing over deploying by hand: a manual `cf deploy` on top of it cuts a duplicate release. Combined with the Git rule above, production only moves when the human pushes.

On the config file: `cf` expects `cloudflare.config.ts`, while the SvelteKit adapter has historically read Wrangler's config. Confirm which one this setup actually consumes before creating either, and do not add both by default — a stale Wrangler config the adapter reads while you edit the `cf` one is a silent failure. `cf schema <command>` and `--help` on the relevant command are the reliable sources here.

To share the static prototype in `static/`, deploy it directly — `cf pages deploy static` — as a one-off, not a repo script.

Within `cf` itself:

- **Output is JSON by default.** Do not pass `--json` and do not reflexively pipe to `jq` — plain `cf <command>` already returns parseable JSON. Use `-q`/`--quiet` to drop non-essential output when you only care about the data.
- **Find commands with search, not from memory.** `cf cli search "purge everything at the edge"` takes plain-language intent and returns candidate commands. With this many routes, guessing a path and reading `--help` at every level burns far more context than one search.
- **Get exact parameters from the schema.** `cf schema dns records create` returns the real request shape, so you are not inventing flags. Use it whenever you are about to call a command you have not run before.
- **Useful globals:** `-z/--zone` (zone ID or domain; overrides `CLOUDFLARE_ZONE_ID`), `--profile` (auth profile), `-m/--mode`, and `--local` (simulated resources). `--local` coverage is partial — read-only calls like `cf --local zones list` still fail against the real API — so fall back to a live read rather than assuming the simulation is authoritative.
- **Check auth before the first call.** `cf auth whoami` returns `{"authenticated": false, "error": "Not logged in"}` when there are no credentials — if you see that, stop and ask the user to run `cf auth login` rather than trying workarounds. On success it also returns the account list, which is what you actually need: read it and confirm you are pointed at the intended account before any write, since a wrong account means wrong data. Do not create or switch profiles (`cf auth create`, `cf auth activate`) unprompted.
- **Treat anything that changes production as requiring approval.** Deploys, cache purges, DNS edits, access policy changes, and deletions are outward-facing and hard to undo. Confirm the target account and zone, then ask. Read-only calls (`list`, `get`, `describe`) are fine to run freely.
- **Dry-run first.** `cf deploy --dry-run` builds and validates without uploading. Worth doing before any real deploy here, particularly while the adapter/config work is still in flight.
- **It is a beta.** Check `cf --version` and confirm behavior against `--help` or `cf schema` if a command errors in a way that does not match the docs.

When a request is ambiguous between "change the app" and "change something on Cloudflare", stop and ask which is meant. Provisioning a database and binding it in code are different tasks with different blast radii.

## Styling

Tailwind CSS v4, wired via `@tailwindcss/vite` and `@import "tailwindcss"` in `src/routes/layout.css`. Follow whatever Tailwind guidance is already loaded in your context, in full, before editing any styling.

`layout.css` currently contains only the Tailwind import. Define the product's design tokens, base resets, and CSS-first shared native control classes there during implementation. Start buttons and fields as native elements; create reusable Svelte components only when current behavior or repeated composition needs them, not as up-front scaffolding. Dashboard cards belong to that surface rather than becoming mandatory containers everywhere. Do not assume primitives already exist.

## Documentation

Product requirements live under `docs/`; `PRODUCT.md` is a short design-context summary, and OpenSpec changes hold implementation plans and acceptance criteria. Read before building:

- `docs/SPEC.md`: what the MVP is, the record model, the pipeline, modules, settings, out of scope, settled decisions, and open questions. The primary document.
- `docs/CONTEXT.md`: the glossary. Use its terms for domain concepts; it defines `Client`, `Opportunity`, `Stage`, `Timeline`, `Tag`, `Archive`, and the rest.
- `docs/checklists.md`: the 16 default checklist templates (4 opportunity types × 4 stages).
- `docs/research/`: research briefs for later milestones, currently the phone module.
- `docs/examples/`: visual inspiration screenshots, not requirements.

If the work contradicts `docs/SPEC.md`, say so before implementing it. If it contradicts `docs/CONTEXT.md`, fix the glossary first.

## Domain vocabulary

`docs/CONTEXT.md` is the glossary and the single source of the project's business language. When naming or proposing a new domain concept, follow its terminology guidance.
