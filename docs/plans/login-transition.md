# Login -> dashboard transition plan

## Goal
Restore the sleek entrance/exit choreography between login and the dashboard lost when real login switched from client-side `goto()` (view-transition morph) to full-document `replaceSession()` (no animation). Real login stays a full navigation so cached workspace data is dropped; the choreography is rebuilt as cross-document view transitions where supported, with a pre-navigation exit + post-navigation entry CSS fallback elsewhere.

## Standards source
- MDN `@view-transition` CSS at-rule: cross-document view transitions are opted in via `@view-transition { navigation: auto; }` in CSS (the `<meta name="view-transition">` tag was an experiment and is superseded). Both current and destination documents must opt in; navigation must be same-origin, no cross-origin redirects, and user-initiated.
- `document.startViewTransition()` signals same-document (SPA) view-transition support ONLY — it is NOT a signal for cross-document view transition support and must not be used to gate the cross-document fallback.
- Cross-document interface detection: `CSSViewTransitionRule` is `[Exposed = Window]` per MDN, so `"CSSViewTransitionRule" in window` is the correct explicit signal that cross-document view transitions are available (Safari 18.2+, Chrome 126+, Edge 126+). Firefox lacks it. In browsers without it, `@view-transition` is ignored and navigation is instant — the CSS fallback provides the animation.
- Reduced motion: `@media (prefers-reduced-motion: reduce) { @view-transition { navigation: none; } }` opts out; CSS animations are also disabled under reduce.

## Bounded scope (files I own)
- `src/routes/login/+page.svelte` — sign-in exit motion; set the entry marker before navigating; failure path unchanged (immediate error, no navigation, no wait).
- `src/lib/shell/session-navigation.ts` — add the `meadow:login-entry` sessionStorage key and a `markLoginEntry(destination)` helper; `replaceSession` and `identityChangeKey` untouched.
- `src/routes/+layout.svelte` — consume the marker on mount for the CSS fallback; `data-login-entrance` on `.workspace`; cross-doc VT detection via `"CSSViewTransitionRule" in window` (MDN: `[Exposed = Window]`, represents `@view-transition`; `document.startViewTransition` only signals same-document support and is not used).
- `src/routes/layout.css` — `@view-transition { navigation: auto; }` modern opt-in (replaces meta tag); `login-exit` and `login-surface-enter` keyframes with native CSS nesting; reduced-motion gated.
- `docs/plans/login-transition.md` — this plan.

## Out of scope (not touched)
- Registry, dashboard page content, dashboard widgets, `+page.svelte` surface-enter animation.
- Global style tokens, `themes.css`, `components.css`, Auth, impersonation, signup, identity-change cross-tab clearing.
- No commits, no push, no deploy, no data mutations, no tests added.

## Choreography (restored)
- Where cross-document view transitions are supported (`"CSSViewTransitionRule" in window`): `@view-transition { navigation: auto; }` in `layout.css` (gated by `prefers-reduced-motion: no-preference`; `none` under reduce). The existing matching `view-transition-name: cream-surface` (`.workspace`) and `view-transition-name: white-surface` (`.main-surface`) rules drive the shell morph across the full `replaceSession` navigation. On login success, `replaceSession` runs immediately with no CSS exit fade, so the surfaces morph cleanly without a double exit; the CSS entry fallback is suppressed via `supportsCrossDocViewTransition`.
- Elsewhere (Firefox, older Safari, any browser without `CSSViewTransitionRule`): the `@view-transition` rule is ignored; `markLoginEntry()` writes a `sessionStorage` marker on login success, the pre-navigation exit motion runs (300ms, skipped under reduced motion), then `replaceSession()`. The dashboard consumes and clears the marker on mount and plays `login-surface-enter` (400ms, glides up) only when the marker matches the current destination, not reduced motion, and cross-doc VT isn't handling the morph. Marker is always cleared on mount, so reloads / identity-change refreshes never replay the entrance or flash stale cross-account data.
- `prefers-reduced-motion: reduce` disables both animations and skips the exit wait entirely; reduced-motion navigations proceed immediately. No reduced-motion regression.

## Security rationale
- Sign-in remains a real Better Auth POST to `/api/auth/sign-in/email`; on failure the error renders immediately and no navigation occurs — no artificial wait can hide a failed login.
- `replaceSession` still sets `identityChangeKey` in localStorage and calls `window.location.replace`, so a full document replacement drops cached workspace data and other tabs reload on the storage event (cross-account guard preserved).
- `markLoginEntry` writes to `sessionStorage` (tab-scoped, survives `location.replace`, never leaves the tab). The dashboard consumes and clears it on mount, so a plain reload or an identity-change `window.location.reload()` never replays the login entrance and cannot flash stale cross-account data — the new document loads fresh server data either way.
- Cross-document view-transition screenshot scope: a native `pageswap` listener (registered with cleanup inside `onMount`, since `onpageswap` is not in the Svelte `svelte:window` attribute set) skips `viewTransition.skipTransition()` for every cross-document navigation EXCEPT the authorized login→dashboard transition (current page `/login` and the entry marker present, and the swap's `activation.entry.url` matches the marker). This prevents `@view-transition navigation: auto` from screenshotting old CRM data on logout, impersonation switch/expiry, or identity-change reloads. The marker is read but not consumed here; the new document consumes and clears it in onMount. Same-document `onNavigate` view transitions are unaffected.
- Support-admin impersonation guard and `verifySupportSession` are untouched.

## Assumptions / known limitations
- `CSSViewTransitionRule` (`[Exposed = Window]`) is used to detect cross-document view-transition support: its absence means the browser cannot run cross-document view transitions and the CSS entry fallback runs. Browsers supporting same-document but not cross-document view transitions (older Safari before 18.2) expose `startViewTransition` but not `CSSViewTransitionRule`, so they correctly get the CSS fallback rather than no animation.
- sessionStorage is available; if not, the marker is skipped and the dashboard plays its normal load motion (no crash).
- The 300ms exit wait runs only on the success path and only when not reduced motion; it is not a fake wait hiding a failed login (the failure path never reaches it).
- Animation not observed in a live browser in this session because no authenticated browser session was available. Developer review can use the live-connected server, but logging in creates a real production session and editing changes production records; automated acceptance must stay isolated. The final combined `vp run check` passed with zero errors and warnings after introduced integration errors were fixed. Evidence is code inspection plus the existing matching shell surface names; actual motion acceptance remains pending.

## Evidence
- Before: sign-in called `replaceSession(destination())` → `window.location.replace`, document snapped away with no exit motion; dashboard mounted with only its generic `surface-enter`.
- After: on browsers without cross-document view transitions, sign-in marks the entrance, runs the exit motion, then navigates; the dashboard consumes the marker and runs the coordinated entry motion; failure shows the error immediately with no navigation. On Chrome/Edge/Safari 18.2+, `<meta>` is replaced by `@view-transition { navigation: auto; }` plus existing `view-transition-name: cream-surface` / `white-surface`, restoring the cross-document shell morph.
