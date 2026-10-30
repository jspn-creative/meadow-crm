# Sivir exploration

Development-only comparison, not approval to adopt a component or change production defaults. Source review is pinned to Sivir revision `ac4289844b27d0f6d213b25a76d60e7e85866773`; never infer the reference implementation from its mutable checkout. The existing Meadow palettes, native controls, dependencies, and variant host remain the foundation.

## Surface mapping

The relevant upstream sources are `packages/sivir/src/themes/theme.ts`, `packages/sivir/src/themes/builtin-presets.ts`, `packages/sivir/src/ui.css`, and the button, input, card, popover, and modal component sources at that revision. Current Sivir removes panel framing while retaining elevation. Legacy retains a tinted outer frame and an inset surface. Neither is equivalent to applying the same shadow to every control.

- Outline buttons: palette-derived semantic edge, inset bottom shade, and inset top highlight; no external elevation in that recipe.
- Panel buttons: real border, separate secondary ring, and external elevation. Keep this comparison independent of outline-button shading.
- Fields: real border and fill; focus composes with the field boundary rather than introducing a recessed well. Adorned fields share one wrapper boundary.
- Framed surfaces: distinguish the outer edge, tinted frame, inner stroke, fill, and elevation. Nested radii account for the actual inset and border; upstream Legacy panel-card and modal formulas are not interchangeable.
- Floating surfaces: coordinate their visual vocabulary, not their semantics. Action menus move focus between actions; editable listboxes retain input focus; previews supplement links and never trap focus.
- Ringed: appended to `sg-controls-v2`; the original Tactile, Glass, and Outlined indices and the Glass default remain unchanged.

The existing guide deliberately flattens widget shadows. Selecting Cream therefore does not recreate an exact shipped baseline. Recipe comparisons retain Meadow typography and density so those differences do not masquerade as surface changes.

## Candidate locations

- `InputExplorations.svelte`: attachment, color-picker, combobox, pagination, progress, radio-group, tag-input.
- `OverlayExplorations.svelte`: dropdown-menu, context-menu, hover-card, source (an upstream citation pattern, not the product's Lead source field).
- `FeedbackExplorations.svelte`: alert, alert-dialog, button behavior, copy-button, reorder-list, toast.
- `SurfaceExplorations.svelte`: independent Sivir and Legacy surface recipes and outline/panel button treatments.
- Existing `src/lib/ui/Select.svelte` and Fields specimens: progressively enhanced native select, including server-rendered native fallback.
- Existing Buttons and opportunity specimens in `+page.svelte`: linked tabs with a sliding underline and reduced-motion handling.

All demo state belongs to this route. File selection does not upload anything; record actions do not save anything; clipboard success must reflect the actual Clipboard API result. Controlled tags resolve stable fixture IDs rather than creating tags from free text. Local examples do not establish production data contracts, positioning parity with Sivir, or assistive-technology acceptance.

## Later maintainability recommendations — not implemented

1. **Menu triggers:** evaluate `src/lib/ui/Menu.svelte` against the route's context-menu specimen before adding an arbitrary-trigger API. Its existing ellipsis contract is useful and small; making it universal would add coordinate anchoring and focus-restoration obligations. Share visual tokens first, not a universal overlay controller.
2. **Controlled tag selection:** compare `src/lib/registry/ClientEditor.svelte`'s checkbox-based `draft.tagIds` editing with the route's inline suggestions. A future shared picker could consolidate ID resolution, retired-tag handling, and removal semantics, but needs a real second production consumer and explicit API approval.
3. **Feedback ownership:** compare the original `+page.svelte` toast and dialog helpers with the route's awaited feedback specimens. Local async feedback can be made consistent without introducing app-wide singleton lifetime, cross-navigation timers, or an overlay stack; a shared service would require separate lifecycle and accessibility decisions.
4. **Specimen composition:** the new stateful examples are split from `+page.svelte`; the original guide still contains substantial composition and fixture logic. Further extraction should follow actual editing pressure, retaining `guide.svelte.ts` as navigation-only and avoiding a generic component framework.

No dependency addition, shared utility, production component replacement, or broad refactor is authorized by these recommendations. Any proposal for new shared code must name paths, responsibilities, consumers, and existing alternatives before implementation.
