<script lang="ts" module>
	export const stageNumerals = { "new-lead": "I", "active-lead": "II", "under-contract": "III", closed: "IV" } as const;
</script>

<script lang="ts">
	import { stageLabels, stageTones } from "#lib/pipeline/labels.js";
	type Stage = keyof typeof stageLabels;
	// A stage is a numbered position, so the mark is its numeral in the stage tone. Collapsed, it reveals the name on hover by expanding over its neighbours instead of reflowing them.
	let { stage, expanded = false }: { stage: Stage; expanded?: boolean } = $props();
	let tone = $derived(stageTones[stage]);
</script>

<span
	role="img"
	aria-label={`Stage ${stageNumerals[stage]}, ${stageLabels[stage]}`}
	title={expanded ? undefined : stageLabels[stage]}
	data-stage-mark
	data-expanded={expanded || undefined}
	class={["group/stage relative inline-flex shrink-0 align-middle", !expanded && "size-6"]}
	style:--soft={`var(--color-${tone}-soft)`}
	style:--strong={`var(--color-${tone})`}>
	<span aria-hidden="true" data-chip class={["flex h-6 items-center overflow-hidden rounded-full bg-(--soft) text-(--strong)", !expanded && "absolute top-0 left-0 max-w-6 transition-[max-width] duration-300 ease-(--ease-shell) group-hover/stage:z-20 group-hover/stage:max-w-48 motion-reduce:transition-none"]}>
		<span class="grid size-6 shrink-0 place-items-center font-sans text-xs leading-6 font-medium">{stageNumerals[stage]}</span>
		<span class="pr-2.5 pl-0.5 text-xs font-medium whitespace-nowrap">{stageLabels[stage]}</span>
	</span>
</span>
