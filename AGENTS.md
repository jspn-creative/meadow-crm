# AGENTS

## Rapid prototyping mode

This repo is in rapid prototyping mode based out of [static/example.html](static/example.html). Unless otherwise specified, direct requests to and limit changes to that HTML file.

## Commands

This repo uses `vp` (Vite+). Always run scripts, checks, builds, and installs through it — `vp run <script>`, `vp check`, `vp build`, `vp install` — never `bun`/`npm`/`npx` directly. The one exception is the temporary invoice-import script below, which is deliberately not in `package.json`.

## Styling

Use Tailwind CSS v4 (already wired via `@tailwindcss/vite` and `@import "tailwindcss"` in `src/routes/layout.css`). Default to Tailwind utilities in markup for layout, spacing, and one-off styles — do not add new scoped `<style>` blocks or new global CSS classes for things Tailwind already covers.

Keep custom CSS only for: design tokens (`:root` vars in `layout.css`), base element resets, and the small set of shared primitives in `layout.css` (card, btn / btn-lg / btn-primary / btn-secondary / btn-danger, icon-btn, field base, kicker, notice, display). If a pattern is used in one file only, or only repeated inside a single `{#each}` loop, inline it with utilities — do not promote it to a global class.

When writing CSS (globals in `layout.css` or the rare scoped exception), use `@apply` for standard utilities as much as possible. Do not use arbitrary values/variants (`text-[...]`, `rounded-[...]`, `bg-(...)`, `[&...]`, etc.) — pick the closest existing scale utility and cover the difference (theme `var()` colors, `color-mix`, custom shadows) with plain CSS declarations alongside the `@apply`.

Complex effects Tailwind covers poorly (masks, `shape()`, layered gradients, print rules) may stay as small scoped classes with plain CSS.

Use native CSS nesting (baseline in all browsers): nest variants with `&` (e.g. `&[data-size="sm"]`, `&:hover`, `.child`) and nest `@media`/`@container` inside the rule they adjust — never repeat the parent selector flat.

Base element rules (`a`, `button`, `*`, etc.) must live inside `@layer base` — unlayered author CSS beats layered CSS in the cascade, so an unlayered `a { color: inherit }` would silently override `.btn-primary` text color on links.
