<script lang="ts">
	import { Archive, Check, Clock3, Pin, PinOff, Trash2 } from "@lucide/svelte";
	import type { Workspace } from "#lib/data/workspace.js";
	import Menu from "#lib/ui/Menu.svelte";
	import { stageLabels, stageTones, timelineLabels, typeLabels, typeStyles } from "./labels.js";
	type Opportunity = Workspace["opportunities"][number];
	type Stage = keyof typeof stageLabels;
	let {
		opportunity,
		clients,
		progress,
		ready,
		busy,
		dragging = false,
		open,
		move,
		archive,
		pin,
		remove,
		dragstart,
		dragend,
	}: {
		opportunity: Opportunity;
		clients: string[];
		progress: { done: number; total: number } | null;
		ready: boolean;
		busy: boolean;
		dragging?: boolean;
		open: () => void;
		move: (stage: Stage) => void;
		archive: () => void;
		pin: () => void;
		remove: () => void;
		dragstart: (event: DragEvent) => void;
		dragend: () => void;
	} = $props();
	const titleId = $props.id();
	let style = $derived(typeStyles[opportunity.type]);
	let Icon = $derived(style.icon);
</script>

<!-- Every card colour derives from --card-hue: wash and edge, a headline pulled toward ink, and chips tinted from the hue rather than neutral white. -->
<article
	aria-labelledby={titleId}
	data-dragging={dragging}
	draggable={!busy}
	ondragstart={dragstart}
	ondragend={dragend}
	style:--card-hue={`var(--color-category-${style.tone}-edge)`}
	style:--card-wash={`var(--color-category-${style.tone})`}
	style:--card-ink={`var(--color-category-${style.tone}-ink)`}
	class="group/card @container/card relative isolate rounded-2xl border border-(--card-hue)/45 bg-linear-160 from-(--card-wash) via-(--card-wash)/70 to-white/80 p-3.5 text-(--card-ink) transition-[translate,box-shadow,opacity] duration-300 ease-(--ease-shell) [--card-chip:light-dark(color-mix(in_oklab,var(--card-hue)_14%,var(--color-white)),color-mix(in_oklab,var(--card-wash)_90%,var(--color-ink)))] data-[dragging=true]:opacity-40 motion-reduce:transition-none pointer-fine:hover:-translate-y-0.5 pointer-fine:hover:shadow-[0_12px_24px_-16px_color-mix(in_srgb,var(--card-ink)_45%,transparent)] motion-reduce:pointer-fine:hover:translate-y-0">
	<div class="flex items-center gap-2 pr-8">
		<span class="inline-flex items-center gap-1.5 rounded-md bg-(--card-chip) px-2 py-0.5 text-xs leading-none font-medium"><Icon size={12} strokeWidth={2.25} aria-hidden="true" />{typeLabels[opportunity.type]}</span>
		{#if opportunity.pinnedAt}
			<span class="ml-auto flex size-6 items-center justify-center rounded-full bg-(--card-chip) shadow-[0_1px_2px_color-mix(in_srgb,var(--card-ink)_14%,transparent)]" title="Pinned to the top of this stage">
				<Pin size={12} strokeWidth={2.25} class="rotate-45 fill-current" aria-hidden="true" /><span class="sr-only">Pinned</span>
			</span>
		{/if}
	</div>
	<h3 id={titleId} class="mt-2.5 text-sm/5 font-semibold text-balance wrap-anywhere text-[color:color-mix(in_oklab,var(--card-hue)_35%,var(--color-ink))]">
		<button type="button" data-open disabled={!ready} class="text-left after:absolute after:inset-0 after:rounded-2xl" onclick={open}>{opportunity.title}</button>
	</h3>
	{#if clients.length}<p class="mt-1 truncate text-xs leading-none text-(--card-ink)/80">{clients.join(", ")}</p>{/if}
	<div class="mt-3 flex items-center justify-between gap-3">
		<span class={["inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs leading-none font-medium tabular-nums", opportunity.timeline ? "bg-(--card-chip)" : "text-(--card-ink)/70"]}>
			<Clock3 size={12} strokeWidth={2.25} aria-hidden="true" />{opportunity.timeline ? timelineLabels[opportunity.timeline] : "No timeline"}
		</span>
		{#if progress && progress.total}
			<span class="flex min-w-0 items-center gap-2 text-xs leading-none font-medium tabular-nums">
				<span class="sr-only">Checklist </span>
				{#if progress.total <= 10}
					<span class={["gap-0.75", progress.total > 6 ? "hidden @min-[15rem]/card:flex" : "flex"]} aria-hidden="true">
						{#each { length: progress.total }, index}<span class={["size-1.5 rounded-full", index < progress.done ? "bg-(--card-ink)" : "bg-(--card-ink)/20"]}></span>{/each}
					</span>
				{/if}
				{#if progress.total > 6}
					<span class={["h-1.5 w-10 overflow-hidden rounded-full bg-(--card-ink)/15", progress.total <= 10 && "@min-[15rem]/card:hidden"]} aria-hidden="true"><span class="block h-full rounded-full bg-(--card-ink)" style:width={`${(progress.done / progress.total) * 100}%`}></span></span>
				{/if}
				{progress.done}/{progress.total}
			</span>
		{/if}
	</div>
	<div class="absolute top-2.5 right-2 z-10">
		<Menu label="More actions" disabled={busy} class="text-(--card-ink)/70 pointer-fine:hover:bg-(--card-chip) pointer-fine:hover:text-(--card-ink)">
			<div role="group" aria-labelledby={`${titleId}-move`}>
				<p id={`${titleId}-move`} class="text-muted px-2.5 pt-1 pb-1.5 text-xs leading-none">Move to stage</p>
				{#each Object.entries(stageLabels) as [stage, label] (stage)}
					{@const current = stage === opportunity.stage}
					<button type="button" role="menuitemradio" aria-checked={current} class="menu-item" disabled={current} onclick={() => move(stage as Stage)}>
						<span class="size-2 rounded-full" style:background={`var(--color-${stageTones[stage as Stage]})`}></span>{label}
						{#if current}<Check size={15} class="text-field ml-auto" aria-hidden="true" />{/if}
					</button>
				{/each}
			</div>
			<hr class="border-hairline mx-1.5 my-1" />
			<button type="button" role="menuitem" class="menu-item" onclick={pin}>
				{#if opportunity.pinnedAt}<PinOff size={15} aria-hidden="true" />Unpin{:else}<Pin size={15} aria-hidden="true" />Pin{/if}
			</button>
			<button type="button" role="menuitem" class="menu-item" onclick={archive}><Archive size={15} aria-hidden="true" />Archive</button>
			<button type="button" role="menuitem" class="menu-item" data-tone="danger" onclick={remove}><Trash2 size={15} aria-hidden="true" />Delete</button>
		</Menu>
	</div>
</article>
