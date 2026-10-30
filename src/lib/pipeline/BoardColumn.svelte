<script lang="ts">
	import { tick, type Snippet } from "svelte";
	import { ChevronsLeftRight, ChevronsRightLeft, Plus } from "@lucide/svelte";
	import { stageLabels, stageTones } from "./labels.js";
	type Stage = keyof typeof stageLabels;
	let {
		stage,
		count,
		collapsed,
		dropping,
		ready,
		toggle,
		add,
		dragover,
		dragleave,
		drop,
		children,
	}: {
		stage: Stage;
		count: number;
		collapsed: boolean;
		dropping: boolean;
		ready: boolean;
		toggle: () => void;
		add: () => void;
		dragover: (event: DragEvent) => void;
		dragleave: (event: DragEvent) => void;
		drop: (event: DragEvent) => void;
		children: Snippet;
	} = $props();
	let collapseButton = $state<HTMLButtonElement>();
	let rail = $state<HTMLButtonElement>();
	let label = $derived(stageLabels[stage]);
	let summary = $derived(`${count} ${count === 1 ? "opportunity" : "opportunities"}`);

	// The control that was used becomes inert, so hand focus to its counterpart once the swap renders.
	async function swap() {
		toggle();
		await tick();
		(collapsed ? rail : collapseButton)?.focus();
	}
</script>

<!-- Width comes only from flex sizing: inline-size containment keeps the clipped body from widening a collapsed rail. -->
<section
	aria-label={label}
	data-stage={stage}
	data-collapsed={collapsed}
	data-drop={dropping}
	style:--stage-soft={`var(--color-${stageTones[stage]}-soft)`}
	style:--stage-ink={`var(--color-${stageTones[stage]})`}
	class="group/stage bg-paper/35 data-[drop=true]:outline-field/50 relative flex min-h-64 min-w-(--column) grow basis-0 snap-start overflow-x-clip rounded-[1.25rem] bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--stage-soft)_85%,transparent),transparent_9rem)] outline-2 outline-transparent transition-[outline-color] duration-150 [contain:inline-size] group-data-[settled=true]/board:transition-[flex-grow,flex-basis,min-width,outline-color] group-data-[settled=true]/board:duration-300 group-data-[settled=true]/board:ease-(--ease-shell) data-[collapsed=true]:min-w-12 data-[collapsed=true]:grow-0 data-[collapsed=true]:basis-12 data-[drop=true]:outline-dashed motion-reduce:group-data-[settled=true]/board:transition-[outline-color]"
	ondragover={dragover}
	ondragleave={dragleave}
	ondrop={drop}>
	<div
		data-stage-body
		inert={collapsed}
		class="w-full min-w-(--column) p-1.5 transition-opacity delay-100 duration-200 ease-out group-data-[collapsed=true]/stage:pointer-events-none group-data-[collapsed=true]/stage:opacity-0 group-data-[collapsed=true]/stage:delay-0 group-data-[collapsed=true]/stage:duration-100 motion-reduce:delay-0">
		<header class="flex items-center gap-2 py-1.5 pr-1 pl-2.5">
			<span class="size-2 shrink-0 rounded-full bg-(--stage-ink)" aria-hidden="true"></span>
			<h2 class="truncate text-sm font-semibold">{label}</h2>
			<span class="text-muted rounded-full bg-white/80 px-1.5 text-xs leading-5 font-medium tabular-nums">{count}</span>
			<span class="ml-auto flex items-center">
				<button
					type="button"
					class="text-muted hover:text-ink relative flex size-7 items-center justify-center rounded-full transition-colors after:absolute after:-inset-1.5 hover:bg-white/80 disabled:opacity-40 after:pointer-fine:hidden"
					aria-label={`New opportunity in ${label}`}
					title={`New opportunity in ${label}`}
					disabled={!ready}
					onclick={add}><Plus size={15} aria-hidden="true" /></button>
				<button
					bind:this={collapseButton}
					type="button"
					class="text-muted hover:text-ink relative flex size-7 items-center justify-center rounded-full transition-colors after:absolute after:-inset-1.5 hover:bg-white/80 disabled:opacity-40 after:pointer-fine:hidden"
					aria-label={`Collapse ${label}`}
					title={`Collapse ${label}`}
					aria-expanded="true"
					disabled={!ready}
					onclick={swap}><ChevronsRightLeft size={15} aria-hidden="true" /></button>
			</span>
		</header>
		{@render children()}
	</div>
	<button
		bind:this={rail}
		data-stage-rail
		type="button"
		inert={!collapsed}
		aria-expanded="false"
		aria-label={`Expand ${label}, ${summary}`}
		title={`Expand ${label}`}
		disabled={!ready}
		onclick={swap}
		class="pointer-events-none absolute inset-0 flex flex-col items-center gap-2.5 rounded-[1.25rem] pt-3.5 pb-3 text-(--stage-ink) opacity-0 transition-[opacity,background-color] delay-0 duration-100 ease-out group-data-[collapsed=true]/stage:pointer-events-auto group-data-[collapsed=true]/stage:opacity-100 group-data-[collapsed=true]/stage:delay-150 group-data-[collapsed=true]/stage:duration-200 focus-visible:-outline-offset-3 motion-reduce:group-data-[collapsed=true]/stage:delay-0 pointer-fine:hover:bg-[color-mix(in_oklab,var(--stage-soft)_70%,transparent)]">
		<span class="size-2 shrink-0 rounded-full bg-(--stage-ink)" aria-hidden="true"></span>
		<span class="text-muted min-w-6 rounded-full bg-white/80 px-1.5 text-center text-xs leading-5 font-medium tabular-nums" aria-hidden="true">{count}</span>
		<span class="mt-1 min-h-0 flex-1 overflow-hidden text-sm font-semibold whitespace-nowrap [writing-mode:vertical-rl]" aria-hidden="true">{label}</span>
		<ChevronsLeftRight size={15} class="text-muted shrink-0" aria-hidden="true" />
	</button>
</section>
