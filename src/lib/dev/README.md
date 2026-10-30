# Live design variants

Portable Svelte 5 helpers for temporary design comparisons. Styles use Tailwind v4 utilities; the dropdown chevron is inline SVG, with no icon-package dependency. Import through your project's lib alias (`#lib/dev/...` here). Keep the four helper files together when syncing downstream repos.

## Render alternatives with VariantPicker

```svelte
<script lang="ts">
	import VariantPicker from "#lib/dev/VariantPicker.svelte";
</script>

<VariantPicker id="example-layout" variants={["Original", "Compact"]} defaultIndex={0}>
	{#snippet children(variant, index)}
		<div data-layout={variant}>Selected: {variant} ({index + 1})</div>
	{/snippet}
</VariantPicker>
```

`variants: string[]` supplies unique option names. `id` defaults to `"default"`, but use a stable, page-unique, namespaced id to avoid registry and storage collisions. `defaultIndex` defaults to `0` and must be a valid zero-based index. The child snippet receives the selected name and index. A picker shows its own toolbar when no host is mounted.

## Control whole-page styles with variantSetting

```svelte
<script lang="ts">
	import VariantHost from "#lib/dev/VariantHost.svelte";
	import { variantSetting } from "#lib/dev/variants.svelte.js";

	const surface = variantSetting("example-surface", ["Original", "Flat", "Raised"], {
		label: "Surface",
		display: "select",
		defaultIndex: 0,
	});
</script>

<VariantHost />
<main data-surface={surface.value}>Existing page markup</main>
```

Call `variantSetting(id, options, config?)` during component initialization, not inside an event handler. It registers on mount and unregisters on unmount. Read the returned object's reactive `.value` getter directly or through `$derived`; destructuring `value` captures only its current value. The options accept readonly string tuples and infer a union of their values. Use a nonempty list with unique names and a valid default index; these are initialization-time settings, not a reactive configuration API.

`config` accepts `defaultIndex` (default `0`), `label` (default: id), and `display` (`"buttons"` by default, or `"select"` for longer lists). These display options belong to `variantSetting`/registry groups, not `VariantPicker` props. A setting needs a mounted host to expose controls; it does not render a standalone toolbar.

## Shared host and controls

Mount `<VariantHost />` once in the root layout for multiple pickers or any settings. All live groups appear in registration order in one draggable, collapsible toolbar, and individual picker toolbars disappear. No registered groups means no host toolbar. Preserve routed content separately when declaring a snippet named `children` in a layout to avoid shadowing its children prop.

- Drag the toolbar background to move it; option controls do not initiate dragging.
- Focus the toolbar and use arrow keys to move it by 8 px (Shift: 24 px); Escape toggles collapse. Dropdown keys retain native select behavior.
- Number keys `1`–`9` select an option in the last-touched group, initially the first group. Modified shortcuts and input, textarea, select, or contenteditable targets are ignored.
- `sessionStorage` preserves each group's selection, toolbar position, and collapsed state across refreshes in the same tab. Unavailable storage is nonfatal. Stable ids preserve selections; changing option order changes what a stored index means.

Toolbar rendering is development-only (`dev` from `$app/env`), not a production feature flag or an authorization boundary. Children still render in production, and settings still have values; remove experiments rather than relying on the toolbar being hidden. Registration and storage restoration happen on the client after mount, so SSR initially uses the default option.

After choosing a design, remove experiment wrappers, settings, imports, and rejected styles, then apply the winner directly. Keep the host and shared helper files for future comparisons.
