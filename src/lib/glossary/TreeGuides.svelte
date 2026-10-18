<script lang="ts">
	import type { Guide } from "./tree.ts";

	// Draws a row's connector lines. The row must be `relative`; `unit` is the indent per level, `center` the offset of a chevron's midline, and `y` where the elbow meets the row's first line.
	let { guide, unit = 14, offset = 0, center = 8, y = "1.5rem" }: { guide: Guide; unit?: number; offset?: number; center?: number; y?: string } = $props();
	const x = (level: number) => `${offset + level * unit + center}px`;
</script>

{#if guide.depth > 0}
	<span aria-hidden="true" class="pointer-events-none absolute inset-y-0 left-0" style:--guide-y={y}>
		{#each guide.continues as continues, level}
			{#if continues}<span class="bg-ink/12 absolute inset-y-0 w-px" style:left={x(level)}></span>{/if}
		{/each}
		<span class="bg-ink/12 absolute top-0 w-px" style:left={x(guide.depth - 1)} style:height={guide.last ? "var(--guide-y)" : "100%"}></span>
		<span class="bg-ink/12 absolute h-px rounded-full" style:top="var(--guide-y)" style:left={x(guide.depth - 1)} style:width={`${unit - center + 2}px`}></span>
	</span>
{/if}
