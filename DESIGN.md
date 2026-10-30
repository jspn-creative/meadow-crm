# Design: Meadow CRM

This records the intent behind the visual language. Tokens and themes live in `src/routes/layout.css` and the stylesheets it imports, shared primitives are CSS classes in its components layer, and the development-only `/style-guide` route renders all of them. Product scope and vocabulary stay in [docs/SPEC.md](docs/SPEC.md) and the Vocabulary section of [AGENTS.md](AGENTS.md#vocabulary).

## Character

**Soft Signal.** A distinctly digital workspace: softly rounded surfaces float over a continuous background, and precise SVG linework adds a generative signature. This is not a paper, stationery, or physical-material metaphor.

- The navigation rail is part of the continuous viewport background; the main content is a floating surface.
- Hierarchy comes from layout, type, tone, and hairlines before shadows.
- Color signals action, status, or category before decoration.

## Themes

A theme sets the palette and type pairing for the whole app. It is chosen in the account menu, saved in the user's browser, and applied as `data-theme` on `<html>` before first paint. Cream is the default; Evening is the dark theme. Cream, Pop, and Evening must be fully correct; Sage & clay, Lilac, and Butter are offered but only need to be coherent.

Every theme defines the same complete set of semantic tokens below; no token exists outside the themes, and no theme leans on another's values or on fixed colors. Each theme supplies a short list of inputs (its neutrals, accent, status hues, category hues, and shade) and derives the rest with the same rules, so components only ever read semantic tokens:

- **Neutrals:** `canvas` (viewport), `paper` (tonal fill), `paper-pill`, `hairline`, `muted`, `ink`, and `white`, which is the theme's solid surface rather than literal white.
- **Accent:** `field` and `field-deep`. The accent marks links, text actions, focus, checked controls, and caret. It is the only hue interaction states use.
- **Primary:** `primary`, `primary-hover`, `on-primary` for the filled button.
- **Interaction:** `highlight` is the transient wash under a hovered or keyboard-active row, option, or segment. `selected` and `on-selected` mark persistent selection: the current navigation item, a selected option, a checked segment. Every theme defines both from its accent, mixed in oklch so the accent's hue holds: `selected` is a clear, opaque accent tint, and `highlight` is the accent at low opacity (about a third of `selected`'s strength) so it tints whatever it sits on and reads as the same hue on the warm rail and on white menus. Components read `highlight` and `selected`, never `paper` or `paper-pill`, for interaction states.
- **Status pairs:** `info`, `pending`, `tour`, `success`, `urgent`, each with `-soft`.
- **Category families:** `category-sky`, `category-amber`, `category-violet`, `category-teal`, each a wash (the bare name), `-ink`, and `-edge`. Every theme derives them from its own four category hues, tuned in chroma and lightness to sit in that theme's palette (soft on Cream, saturated on Pop, deep on Evening), so categories never read as pasted-in pastels.
- **Shadow shade:** shadows take the theme's shade, so a dark theme deepens them instead of glowing.

**The One-Hue Rule.** Interaction states (hover washes, highlight, selection, focus, checked checkboxes and radios, text selection, `[data-interactive]` washes) use the accent family only. Status and category hues appear only on the things they classify: chips, stage marks, cards' category washes. Never put an accent control on a status-colored fill or tint a selected row with a status color; in Pop that is how green and violet collide. A checked checklist row reads as done through its muted, struck title, not a green wash.

**The Signal Rule.** Pair status color with readable words or icons; never make hue the only signal. Keep one color meaning per component family, and check contrast on the actual surface, especially tinted ink on washes.

Current mappings, which any palette change must preserve as distinct signals:

- Stages: New lead `info`, Active lead `pending`, Under contract `tour`, Closed `success`.
- Due state (`DueBadge`): overdue `urgent`, today `pending`, upcoming `info`, undated neutral.
- Opportunity types: Buyer sky, Seller amber, Estate Sale violet, Construction teal.

## Type

Each theme has its own pairing of a display face and a sans, set as `--font-display` and `--font-sans`:

| Theme | Display | Sans |
| --- | --- | --- |
| Pop | Bricolage Grotesque | Bricolage Grotesque |
| Cream | Newsreader | DM Sans |
| Evening | Instrument Serif | Instrument Sans |
| Sage & clay | Young Serif | Work Sans |
| Lilac | Fraunces | Figtree |
| Butter | Fredoka | Nunito |

Load only the active theme's faces where practical. The display face is for page titles, widget and section headings, opportunity titles, and prominent figures. The sans (weights 400, 500, and 600) is for everything else, including charts. There is no mono or label family.

Body text is 14px; supporting details are 12px. Interactive labels use weight 500. Single-line item titles use `.item-title` so wrapping never costs more height than the row budgeted. `text-2xs` is for badges only; use tracked uppercase sparingly.

## Layout

The desktop rail is transparent and 16rem wide, collapsing to 5rem. The main surface sits 12px from the top, bottom, and rail, reaches the right edge, scrolls independently, and rounds only its left corners. Main gutters step from 20px to 32px at 640px and to 40px at 1024px. There is no centered max-width container.

Below 64rem the rail becomes a header with horizontally scrolling section pills, the account chip moves into the wordmark row, and the greeting collapses after 24px of scrolling. Short desktop viewports shed the greeting, then the collapse button, before anything else.

Content layouts follow the container-query rules in AGENTS.md. Shipped actions must stay usable on phones and with a keyboard: 44px targets on coarse pointers, visible focus, and no fixed tuning panels. Every scrollable area gets an overflow fade.

## Shape

Every corner derives from one token, `--radius` (14px). The scale is computed from it: `rounded-3xl` = `--radius`, `2xl` 0.8×, `xl` 0.6×, `lg` 0.4×, `md` 0.3×, `sm` 0.2× (about 14, 11, 8, 6, 4, 3px). Changing `--radius` reshapes the whole app. The main surface and dialogs use `3xl`, cards and floating surfaces `2xl`, controls, fields, and rows `xl`, chips `md`. Only true circles stay round: checkboxes, radios, avatars, dots, and a collapsed stage mark.

Padding is tokenized so nested corners can be computed rather than guessed. A container that holds rounded children sets `--radius-outer` (its own corner) and `--inset` (its padding, applied with `p-(--inset)`), and a child that sits on that padding uses `rounded-nested`: `max(0px, var(--radius-outer) − var(--inset))`. Surfaces, menus, field groups, and segmented tracks set both, so their rows, segments, and compartments stay concentric at any `--radius`. Never hardcode a nested radius.

## Surfaces

Two surface treatments, plus one elevation for anything floating. Both are CSS primitives; never rebuild a boundary from utilities.

- **Standard** (`.surface`): the solid theme surface, a hairline edge, and a low resting elevation. It is the default for everything that structures a page: dashboard widgets, editor sections, panels, list containers, board columns. It should disappear into the layout.
- **Framed** (`.surface[data-surface="framed"]`): the same surface inside a thin tinted bezel and an outer hairline, drawn with layered shadows so it needs no wrapper and its corners stay concentric. The bezel reads `--surface-frame`, a faint ink tint by default, and it takes color well: set it to an accent or category wash, or let Glass make it translucent. Use Framed for things that sit above the page or ask for attention: every floating layer (menus, listboxes, popovers, the account menu, dialogs) and featured cards. Several cards in a view may be framed, and peers can each take their own frame color: the dashboard scorecards are each framed in their own stage color. Never nest Framed inside Framed. Rows, chips, and the resting control itself stay unframed; a control's floating parts (dropdown and context menus, select pickers, combobox listboxes) are Floating surfaces and carry the frame. Because the bezel paints outside the box, give framed elements room and do not clip them with `overflow-hidden` ancestors.
- **Floating** (`.surface-floating`): Framed plus the floating shadow. Menus, listboxes, popovers, and dialogs use it; dialogs add an `ink/30` backdrop with a 2px blur. Toasts stay ink pills.

The backdrop decoration (`Motif`) changes with the theme: concentric rings (a precise generated SVG), a dot field, or a fine grid, each heavily cropped off the upper-left edge and dissolved with the same masks, drawn in the theme's ink at low opacity. Pop and Lilac use dots, Cream and Sage & clay rings, Evening and Butter the grid. It stays in the background, is never interactive, and is hidden from assistive technology.

## Material

Controls have a material, set as `data-material` on `<html>`. Glass and Tactile are both still candidates; a development-only toolbar setting switches them on every view, and production uses Glass until one is chosen. A material may only restyle the primitives below, never a component directly. It restyles primary controls too, so the two materials differ on every kind of control; ghost buttons and text actions have no material.

- **Glass:** translucent controls and floating surfaces that blur what is behind them, edged with light.
- **Tactile:** controls lit from above with a top sheen and a heavier lower edge that press in; fields are recessed wells.

## Focus

One treatment, **Glow**, on `:focus-visible` for every element: a soft accent bloom, with no hard ring; an element with an edge also turns that edge accent. Text entry (`.field`, `.field-group`, native selects) shows it whenever focused, since browsers treat a focused text input as focus-visible; buttons and other controls focused by pointer show nothing, because the base layer resets `:focus:not(:focus-visible)`. Bare inputs inside a group never draw their own focus; the group glows. Scroll and overflow containers leave room for the glow so it is never clipped. Forced colors use a 2px `Highlight` outline.

## Primitives

Every control is built from these classes. A component may add layout utilities, but it must not restate a primitive's color, border, radius, height, hover, or focus. If a component needs a look the primitives lack, add a variant to the primitive instead.

- **Buttons — `.control`:** 44px, `rounded-xl`, solid surface with a hairline edge; hover fills `highlight`, presses compress slightly on pointer input. `data-variant`: `primary` (filled `primary`), `ghost` (no edge or fill; text in `--action-color`, the accent by default, so a context such as a bookmark card or a toned alert can tint it; hover deepens the text and adds a soft tint of the same color) is the quiet button: the secondary action beside a primary one, such as a dialog's Cancel, an alert's actions, and inline edit icons beside a value, such as a bookmark's note or an opportunity's budget and address. `danger` is a ghost in the urgent color, such as the archived view's Delete. `data-size="sm"` is 36px for toolbars and board columns, keeping a 44px hit area on coarse pointers. `data-icon` makes it square; `data-reveal` hides the label until hover or focus on fine pointers. `aria-busy` shows a wait cursor and the label says "Saving…". Not every button is a `.control`: commands in toolbars, forms, and dialogs are; a button that is part of a component's own anatomy (an opportunity card's title, a collapsed rail, a bookmark card) is a plain `<button>` styled by that component.
- **Text actions — `.text-action`:** an inline action inside content, such as Add item or Add reference: accent text (or the container's tone ink via `--action-color`), no box, underline on hover.
- **Fields:** `.field` for inputs, textareas, and selects (44px, `rounded-xl`, `aria-invalid` turns the edge urgent). `.field-group` wraps a `.field-bare` input with `.field-addon` compartments or chips, sharing one boundary and one glow. `.field-inset` puts a small label inside the boundary. `.select` wraps a native select with its chevron in a trailing compartment and becomes a customizable select where supported. `.select-pill` is the compact filter select; when set to anything other than its default (`data-active`) it shows accent text and an accent edge, and keeps the same hover and focus as at rest. Every select, in the app and the style guide, renders through the shared `Select` component.
- **Choices:** `.check` is the round checkbox and `.radio` the round radio, both filled with the accent when checked. `.segmented` is a radio group on a `paper` track; the checked segment takes `selected`, hover takes `highlight`. `.choice` is a larger option row with its own radio for choices that need a description.
- **Chips — `.chip`:** a 24px, `rounded-md` badge describing state or category, not an action. `data-tone` picks a status pair or a category family, defaulting to neutral on `paper`; `data-dot` leads with a `--dot` color, `data-due-state` leads with the due icon. Tags are neutral chips with their tag's dot. A removable chip ends with `.chip-remove`. Client chips lead with a small client icon tile, not initials or an avatar.
- **Menus — `.menu` and `.menu-item`:** a floating surface of 36px rows (44px on coarse pointers). Hover and the keyboard-active option take `highlight`; `aria-selected`, `aria-checked`, or `aria-current` take `selected` with a trailing accent check where it helps. `data-tone="danger"` uses urgent text and `urgent-soft`. Listboxes (combobox, customizable select) use the same rows.
- **Rows:** `.work-row` is a tonal row; `[data-interactive]` adds the translucent accent wash on hover and focus.
- **Cards:** `DashboardCard` owns a widget's surface, heading, optional action, and gutters. `TaskList` and `DueBadge` own task rows and due semantics everywhere.
- **Dialogs:** native `<dialog>` on a floating surface with `3xl` corners, a sticky header carrying the Pipeline crumb, and icon actions. Escape is blocked while a save is pending, and dismissal restores trigger focus.
- **Tabs:** underline tabs reserve their 2px border, so selection does not shift layout.
- **Feedback:** toasts are ink pills at the bottom center. Inline alerts use `urgent-soft`, retained drafts `pending-soft`, and context notes `tour-soft`; all three share one layout, with the message beside small ghost buttons that each carry an icon and wrap below it when space runs short. Empty states are a dashed hairline box with one line of guidance. Never confirm an action that did not happen.

## Motion

`--ease-shell` (`cubic-bezier(0.23, 1, 0.32, 1)`) is the shared curve. Control color changes take about 120ms, overlays 140–200ms, and route and widget entrances 300–560ms, with widget order taken from explicit metadata. Hover effects require a fine pointer, and keyboard focus gets the same washes. Reduced motion removes movement, entrances, and lifts.

Choose motion for interaction feedback. Card lifts, animated names, and staggered entrances are not defaults for every new surface.

## Don't

- Describe or build the interface as paper or textured material.
- Restate a primitive's styling in a component, or style a `<button>` without a primitive.
- Combine the accent with a status or category hue in one interaction state.
- Mix the muted status pairs and the bright category families within one component family, or give category colors status meanings.
- Present prototype tuning controls, motif switching, or role switching as product patterns.
