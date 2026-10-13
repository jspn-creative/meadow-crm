---
name: Meadow CRM — Soft Signal
description: A distinctly digital workspace with floating rounded surfaces, generative linework, and purposeful pastel accents.
colors:
  paper: "#f2efe3"
  paper-pill: "#e6e0cd"
  canvas: "#fdfcf9"
  hairline: "#e9e4d6"
  muted: "#756d60"
  ink: "oklch(0.216 0.006 56.043)"
  white: "#ffffff"
  shell: "rgb(255 255 255 / 0.7)"
  field: "#4c7a2f"
  field-deep: "#3a6122"
  info-soft: "#e7eef0"
  info: "#456775"
  pending-soft: "#f3ead6"
  pending: "#806126"
  tour-soft: "#eee9f1"
  tour: "#715c83"
  success-soft: "#e8eddf"
  success: "#50683d"
  urgent-soft: "#f4e5df"
  urgent: "#98543f"
  pastel-amber: "oklch(0.962 0.059 95.617)"
  pastel-amber-ink: "oklch(0.414 0.112 45.904)"
  pastel-amber-edge: "oklch(0.879 0.169 91.605)"
  pastel-violet: "oklch(0.943 0.029 294.588)"
  pastel-violet-ink: "oklch(0.38 0.189 293.745)"
  pastel-violet-edge: "oklch(0.811 0.111 293.571)"
  pastel-sky: "oklch(0.951 0.026 236.824)"
  pastel-sky-ink: "oklch(0.391 0.09 240.876)"
  pastel-sky-edge: "oklch(0.828 0.111 230.318)"
typography:
  display:
    fontFamily: '"Newsreader", Georgia, serif'
    fontSize: "36px"
    fontWeight: 400
    lineHeight: "40px"
    letterSpacing: "-0.025em"
  headline:
    fontFamily: '"Newsreader", Georgia, serif'
    fontSize: "30px"
    fontWeight: 400
    lineHeight: "36px"
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Newsreader", Georgia, serif'
    fontSize: "20px"
    fontWeight: 400
    lineHeight: "28px"
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"DM Sans", system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  compact:
    fontFamily: '"DM Sans", system-ui, sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  label:
    fontFamily: '"DM Sans", system-ui, sans-serif'
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.14em"
rounded:
  badge: "6px"
  date: "8px"
  row: "12px"
  card: "16px"
  panel: "24px"
  pill: "9999px"
spacing:
  tight: "4px"
  small: "8px"
  row: "12px"
  control: "16px"
  widget: "20px"
  card: "24px"
  section: "32px"
  desktop-gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.compact}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  button-primary-hover:
    backgroundColor: "{colors.field}"
    textColor: "{colors.white}"
  button-secondary:
    textColor: "{colors.ink}"
    typography: "{typography.compact}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.card}"
    padding: "24px"
  status-chip:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.badge}"
    padding: "2px 6px"
  navigation-selected:
    backgroundColor: "{colors.paper-pill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  segmented-control:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "4px"
---

# Design System: Meadow CRM

## Overview

**Creative North Star: "Soft Signal"**

A distinctly digital workspace: softly rounded content surfaces float over a continuous background, with precise SVG linework adding a generative signature. Newsreader gives headings character while DM Sans keeps controls and record information clear and contemporary. This is not a paper, stationery, or physical-material metaphor.

The visual source is [Quiet Cream](static/dashboards/04-quiet-cream.html), interpreted with the user's confirmed direction: use DM Sans instead of Inter, keep the digital shell composition, and make the Commission Split widget's brighter pastels available as an alternative to its muted accents. The existing beige/yellow background is provisional, not an immutable brand color. Frontmatter captures reference values for reproducibility; it does not settle the future background hue.

This documents visual language, not dashboard requirements. [PRODUCT.md](PRODUCT.md), [docs/SPEC.md](docs/SPEC.md), and [docs/CONTEXT.md](docs/CONTEXT.md) remain authoritative for product scope and vocabulary. The source HTML is unchanged and still uses Inter; this document specifies DM Sans for subsequent implementation, including charts.

**Key Characteristics:**
- Floating main surface with rounded left corners and a background-integrated navigation rail.
- Precise, cropped generative SVG geometry rather than physical texture.
- Serif headings paired with digital sans-serif controls and data.
- Hairline-separated content, with structural elevation reserved for the shell and overlays.
- Two evidenced accent registers: muted semantic pairs and brighter categorical pastels.

## Colors

The reference pairs warm light surfaces with green actions and softly differentiated accents; its brighter amber, violet, and sky colors offer a second, more luminous register without changing the shell's geometry.

### Primary

- **Field green** (`field`): action links, confirmation feedback, focus outlines, and the reference's primary chart series. **Deep field** (`field-deep`) supplies stronger interactive emphasis.
- **Ink** (`ink`): primary content, selected underline tabs, wordmark marker, and default filled action buttons. Green is an action accent, not a requirement that every primary button be green at rest.

### Secondary

- **Muted blue** (`info`, `info-soft`): informational badges and activity cues.
- **Muted ochre** (`pending`, `pending-soft`): pending or due-related cues.
- **Muted lavender** (`tour`, `tour-soft`): the reference's tour/category cues; the name does not commit a Calendar module or a new pipeline stage.
- **Muted sage** (`success`, `success-soft`): completed or confirmed states.
- **Muted clay** (`urgent`, `urgent-soft`): urgency and destructive emphasis.

### Tertiary

- **Bright pastel amber**, **bright pastel violet**, and **bright pastel sky**: the Commission Split widget's category backgrounds, with corresponding darker ink and stronger edge tokens. Preserve the source Tailwind v4 OKLCH values rather than substituting approximate hex colors.
- This is an available alternative accent register, not an instruction to mix both sets arbitrarily. Use a consistent register within a component family. Category colors do not automatically acquire success, error, or urgency meanings.
- The source uses tinted category text at 70% opacity and 2px colored explanatory rules. Those are observed treatments, not permission to reduce text contrast or give every card a colored rail. Check the actual background/text combination before reuse.

### Neutral

- **Background** (`paper`): the reference's continuous viewport background; the token name is historical, not a material metaphor. It grades toward **canvas** (`canvas`). Its beige hue remains open to revision.
- **Selected fill** (`paper-pill`): navigation selection and scrollbar thumb.
- **Hairline** (`hairline`): subtle 1px content boundaries and dividers.
- **Muted ink** (`muted`): supporting information and inactive navigation.
- **White** (`white`) and **translucent shell** (`shell`): solid content surfaces and the floating main container respectively. Shell translucency does not imply pervasive glass blur.

**The Signal Rule.** Color communicates action, status, or category before decoration. Pair status color with readable words or icons; never make hue the only signal.

## Typography

**Display font:** Newsreader, with Georgia and serif fallbacks. **UI and chart font:** DM Sans, with system-ui and sans-serif fallbacks. There is no separate mono or label family.

The pairing is expressive but digital: Newsreader is concentrated in headings and prominent figures; DM Sans carries navigation, controls, record names, labels, supporting text, and chart legends/tooltips. Load DM Sans weights 400, 500, and 600 and Newsreader's optical-size range (6–72) with regular display weights. Do not retain Inter in chart defaults or embedded component previews.

### Hierarchy

- **Display:** prominent figures, using the frontmatter display role; secondary figures step down to 24px/32px.
- **Headline:** page titles and greeting; the greeting's observed line-height is 1.08 rather than the page title's default line-height.
- **Title:** section headings; the wordmark uses a smaller Newsreader treatment (16px/24px).
- **Body:** record names and navigation, with medium weight (500) for interactive labels.
- **Compact:** supporting details and compact actions; descriptive row text often uses a more open 20px line-height.
- **Label:** compact metadata, with tracked uppercase reserved for the reference's category labels. Metadata also appears at weight 400 with 0.1em tracking; avoid treating every small text element as an uppercase kicker.

The source includes 9–10px icon, badge, and date micro-labels. These are reference details, not minimum text sizes for shipped workflows. Preserve legibility and enlarge text or hit areas when the actual use scene requires it.

## Layout

The viewport background surrounds the main content, including behind navigation. On desktop, the rail is transparent and full-height (256px wide), not a separately boxed beige sidebar. The main surface reaches the right edge, sits 12px from the top, bottom, and rail, and rounds only its left corners (24px). Its internal scroll is independent of the fixed rail. There is no centered marketing-style maximum-width container.

Main horizontal gutters step from 20px to 32px at 640px, then 40px at 1024px. Cards use 24px padding; compact secondary cards use 20px. Widget spacing defaults to 20px, while row groups use tighter 12px spacing. Preserve relationships rather than copying the prototype's widget inventory.

The source's responsive breakpoints are 640px, 1024px, and 1280px. Below 1024px, navigation becomes a header block with horizontally scrolling section pills, and the identity control moves into the wordmark row. Main left corners reduce to 16px. The greeting collapses immediately after more than 24px of main-panel scrolling to reclaim space; desktop remains unchanged. Summary columns progress from one to two to four; the work area adopts a two-thirds/one-third split at desktop; charts become two columns at desktop. These are source compositions, not mandatory layouts for all screens.

The app deliberately keeps a roomier 3:2 attention/task split rather than squeezing tasks into the source's one-third column. Its scorecards retain compact dimensions, with 36px serif figures in the existing 32px line box. Phone chrome and score padding are tighter than desktop. Named content containers govern two/four-column summaries, dashboard work grids, pipeline columns, and widget interiors; viewport breakpoints govern the shell navigation mode. Test content after both sidebar expansion and collapse, not just at device-sized viewports.

Use zero minimum width on chart/grid children where intrinsic canvas dimensions would otherwise force overflow. Shipped CRM actions must remain usable on phones and keyboards; small controls and fixed prototype tuning panels are not production mobile patterns.

## Elevation & Depth

Depth is digital and structural: the main panel floats over the viewport background; content cards remain flat and separated by fine borders. Selected segmented tabs lift slightly, while dialogs and notification overlays receive a larger soft shadow. Exact shadow values live in `.impeccable/design.json` because the frontmatter schema cannot represent them.

The sidecar's tonal ramps are synthesized preview aids for the principal palette families, not approved replacement colors or a settled background palette. Normative colors remain in the frontmatter.

### Shadow Vocabulary

- **Card:** no resting shadow.
- **Shell:** low ambient offset shadow establishing the main surface above the background.
- **Tab:** small selected-state shadow within a filled segmented-control track.
- **Panel:** broad offset shadow for overlays. The source dialog also uses a dark translucent backdrop with 4px blur; this is focus separation, not decorative blur on every surface.
- **Score hover:** a temporary lift shadow from the prototype's interactive experiments, not a default card elevation.

**The Structural Depth Rule.** Reserve resting shadows for the shell, selected segmented tabs, and overlays. Content hierarchy comes from layout, type, boundaries, and tone, not a shadow on every widget.

## Shapes

Soft corners distinguish digital surfaces: compact badges have 6px corners, date tiles 8px, internal rows 12px, content cards 16px, and desktop main/overlay panels 24px. Controls and small identity/navigation elements use full pills or circles. Keep large containers as rounded panels rather than oversized pills.

The signature decoration is precise SVG geometry: concentric irregular rings or a golden-angle phyllotaxis fragment, heavily cropped off the upper-left viewport edge and dissolved with composited masks. It occupies the background, never the data surface, and stays noninteractive and hidden from assistive technology. Preserve its sense of a generated fragment entering the interface; avoid centering it like a logo or replacing it with paper grain, botanical illustration, or a generic grid.

## Components

### Buttons

Compact and clear. Filled actions use ink with white text, medium DM Sans, full rounding, and compact padding. Green supplies the source's hover emphasis. Secondary actions use a hairline border and a neutral hover fill; tertiary actions are text-led. Icon buttons use circular boundaries; the reference's small quick-accept control changes from green-on-white to white-on-green on hover.

Visible keyboard focus uses a green 2px outline with 2px offset. Disabled controls lose the active cursor; completed task controls are disabled and the row becomes subdued. The source does not establish a complete loading/error button system; specify those when implementing real save flows rather than pretending the prototype already covers them.

### Chips

Compact rounded badges pair a light colored surface with darker same-family text. They describe state or category, not interchangeable actions. The bright pastel alternative uses the Commission Split color families and tinted ink; it should retain readable contrast and consistent semantic mapping.

### Cards / Containers

Solid white content cards use a hairline boundary, 16px corners, and generous internal padding without resting shadows. Internal queue rows use canvas or a lightly tinted expanded surface with 12px corners. Preserve the floating main panel as a distinct shell layer, not another repeated widget card.

Dashboard widgets use `src/lib/dashboard/DashboardCard.svelte` for a consistent boundary, named heading, optional supporting description/action, and container-responsive 16–20px gutters. It does not prescribe widget body composition, heights, or page-wide containers. `TaskList` is independent of that wrapper so task pages do not inherit dashboard-only headings or self-links. Shared work rows use tonal fill rather than another resting border; metadata wraps naturally within each available width. `DueBadge` uses clay for overdue, ochre for due today, blue for upcoming, and quiet neutral styling for undated work, independent of category colors. Task icons, tones, and notes travel with their presentation data, with neutral defaults when omitted.

### Inputs / Fields

Observed controls are native checkboxes and prototype range sliders; no text-field design is established by this reference. Checkbox/range accents should follow the action color in future implementation; the source's task checkboxes currently use stock lime instead. Keep labels, visible focus, and reachable hit areas. Do not infer a complete form system from tuning controls.

### Navigation

Transparent rail, muted inactive entries, and a filled neutral pill for the current destination. Each entry aligns icon and label; selected text stays ink. The main section tabs use a 2px underline with reserved border space, while the compact queue/task switch uses a neutral pill track and a white selected tab. Mobile navigation scrolls horizontally without displaying a decorative scrollbar. Real tabs need keyboard navigation and correct panel relationships, not merely the source's visual ARIA states.

### Overlays and Feedback

The source notification panel has a solid white surface, rounded corners, and structural shadow. The native dialog uses canvas, 24px corners, a width capped at 640px with 16px viewport gutters, and a maximum height of 85vh. Dialog dismissal restores trigger focus. Toasts are compact ink pills with white text and meaningful status icons; do not reproduce success feedback for actions that did not happen.

### Charts and Generative Detail

When charts are actually specified, retain clear DM Sans labels, understated axes, rounded green bars, and coordinated category colors. Prototype charts are visual evidence only, not an MVP reporting commitment. The background SVG is a durable visual signature; tying its variant to “Mark all read” is a prototype comparison trick, not notification behavior.

### Motion

The reference uses ease-out control feedback, small press compression, soft overlay entrances, and optional hover color washes. Motion parameters are recorded in the sidecar. Pointer hover effects require a fine pointer; keyboard input disables animated button compression and programmatic entrances where the source supports it. Reduced-motion preferences suppress movement and discrete transitions.

Card lifts, letter-by-letter animated names, staggered widget entrances, shared-element work-detail transitions, and the tuning/replay panel are observed experiments, not settled requirements for every CRM screen. Keep the digital character, but choose motion for actual interaction feedback rather than automatically animating all names and records.

The app's dashboard entrance order is explicit widget metadata rather than a dependency on DOM position. Row washes respond to focused links and keyboard-focused disclosure summaries; the focus outline remains visible. Reduced motion disables the entrances, lifts, and disclosure-arrow transitions.

## Do's and Don'ts

### Do:

- **Do** make the rail read as part of the continuous viewport background and the main content as a floating digital surface.
- **Do** use Newsreader for display roles and DM Sans for UI, data, and charts.
- **Do** preserve the precise, edge-cropped generative SVG signature without interfering with reading or input.
- **Do** treat the current beige background as provisional and the bright pastel register as an evidenced alternative.
- **Do** use consistent color meanings within a component family and verify contrast on the actual surface.
- **Do** keep cards flat at rest and reserve structural shadows for the shell, selected tabs, and overlays.
- **Do** follow product scope and glossary rather than adopting prototype widgets as features.

### Don't:

- **Don't** describe or implement this world as physical paper, stationery, or textured material.
- **Don't** replace DM Sans with Inter, including in charts or preview snippets.
- **Don't** lock the background to yellow/beige or invent an approved replacement hue.
- **Don't** mix muted and brighter palettes randomly or assign category colors new status meanings without a decision.
- **Don't** turn the SVG into a centered illustration or repeat its ornament across content cards.
- **Don't** make prototype tuning controls, animated names, motif-switch tricks, or role switching mandatory product patterns.
- **Don't** assume text fields, dark mode, loading/error states, or a production-ready mobile form system have already been designed.
