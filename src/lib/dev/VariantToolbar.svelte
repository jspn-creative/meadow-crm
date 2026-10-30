<script lang="ts">
	import { onMount } from "svelte";
	import { variantRegistry, type VariantGroup } from "./variants.svelte.js";
	interface Props {
		groups: VariantGroup[];
		storageKey: string;
	}
	let { groups, storageKey }: Props = $props();
	let pos = $state<{ x: number; y: number } | null>(null);
	let panelOpen = $state(true);
	let isDragging = $state(false);
	let bar: HTMLDivElement | null = $state(null);
	let dragOffset = { x: 0, y: 0 };
	function openKey() {
		return `${storageKey}:open`;
	}
	function persistPos() {
		if (typeof sessionStorage === "undefined" || !pos) return;
		try {
			sessionStorage.setItem(storageKey, JSON.stringify(pos));
		} catch {
			// Persistence is a convenience; dragging still works.
		}
	}
	function persistOpen() {
		if (typeof sessionStorage === "undefined") return;
		try {
			sessionStorage.setItem(openKey(), panelOpen ? "1" : "0");
		} catch {
			// Persistence is a convenience; toggling still works.
		}
	}
	onMount(() => {
		try {
			const raw = sessionStorage.getItem(storageKey);
			if (raw) {
				const parsed = JSON.parse(raw) as { x: number; y: number };
				if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) pos = { x: parsed.x, y: parsed.y };
			}
			panelOpen = sessionStorage.getItem(openKey()) !== "0";
		} catch {
			// Corrupt or unavailable storage keeps the docked, open panel.
		}
	});
	function startDrag(event: PointerEvent) {
		if ((event.target as HTMLElement | null)?.closest("[data-variant-option]")) return;
		if (!bar) return;
		// Offset from the live rect only; pos stays untouched until the first real move, so plain clicks never un-dock the bar.
		const rect = bar.getBoundingClientRect();
		dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
		isDragging = true;
		window.addEventListener("pointermove", onDrag);
		window.addEventListener("pointerup", stopDrag, { once: true });
		event.preventDefault();
	}
	function onDrag(event: PointerEvent) {
		if (!isDragging || !bar) return;
		const w = bar.offsetWidth;
		const h = bar.offsetHeight;
		pos = { x: Math.max(8, Math.min(window.innerWidth - w - 8, event.clientX - dragOffset.x)), y: Math.max(8, Math.min(window.innerHeight - h - 8, event.clientY - dragOffset.y)) };
	}
	function stopDrag() {
		isDragging = false;
		window.removeEventListener("pointermove", onDrag);
		persistPos();
	}
	function toggle() {
		panelOpen = !panelOpen;
		persistOpen();
	}
	function handleBarKeydown(event: KeyboardEvent) {
		if ((event.target as Element | null)?.closest("select")) return;
		if (event.key === "Escape") {
			toggle();
			event.preventDefault();
			return;
		}
		const step = event.shiftKey ? 24 : 8;
		let dx = 0;
		let dy = 0;
		if (event.key === "ArrowLeft") dx = -step;
		else if (event.key === "ArrowRight") dx = step;
		else if (event.key === "ArrowUp") dy = -step;
		else if (event.key === "ArrowDown") dy = step;
		else return;
		if (!bar) return;
		const rect = bar.getBoundingClientRect();
		const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, (pos?.x ?? rect.left) + dx));
		const y = Math.max(8, Math.min(window.innerHeight - rect.height - 8, (pos?.y ?? rect.top) + dy));
		pos = { x, y };
		persistPos();
		event.preventDefault();
	}
</script>

<div
	bind:this={bar}
	role="toolbar"
	tabindex={0}
	aria-label="Variant switcher. Focus and use arrow keys to move, Escape to collapse or expand."
	onpointerdown={startDrag}
	onkeydown={handleBarKeydown}
	style={pos ? `left: ${pos.x}px; top: ${pos.y}px;` : undefined}
	class={[
		"fixed z-[999999] flex cursor-grab touch-none text-xs text-white shadow-2xl backdrop-blur-md select-none active:cursor-grabbing",
		panelOpen ? "w-max max-w-[calc(100vw-2rem)] flex-col items-stretch gap-1 rounded-2xl border border-neutral-700/80 bg-neutral-900/90 p-2" : "items-center rounded-full border border-neutral-700/80 bg-neutral-900/90 p-1.5",
		pos ? null : "right-4 bottom-4",
	]}>
	{#if panelOpen}
		<div class="flex items-center gap-1.5 px-1.5">
			<span class="inline-block size-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
			<span class="font-mono text-[10px] tracking-wider text-neutral-400 uppercase">Variants</span>
			<span class="flex-1"></span>
			<button type="button" onclick={toggle} aria-expanded="true" title="Collapse (Esc)" aria-label="Collapse variant switcher" class="rounded-full px-2 py-0.5 font-mono text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"><span aria-hidden="true">▾</span></button>
		</div>
		{#each groups as group (group.id)}
			{#if group.display === "select"}
				<label data-variant-option class="flex cursor-default items-center justify-between gap-3 py-0.5 pr-0.5">
					<span class="shrink-0 px-1.5 font-mono text-[10px] text-neutral-500">{group.label ?? group.id}</span>
					<span class="relative flex">
						<select
							class="min-w-32 cursor-pointer appearance-none rounded-full border border-neutral-700 bg-neutral-800 py-1 pr-7 pl-3 text-xs font-medium text-white hover:border-neutral-500 focus-visible:outline-emerald-500"
							value={group.active}
							onchange={(event) => variantRegistry.select(group.id, Number(event.currentTarget.value))}>
							{#each group.variants as variant, i (variant)}<option value={i}>{variant}</option>{/each}
						</select>
						<svg class="pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
					</span>
				</label>
			{:else}
				<div class="flex flex-wrap items-center gap-1">
					<span class="shrink-0 px-1.5 font-mono text-[10px] text-neutral-500">{group.label ?? group.id}</span>
					{#each group.variants as variant, i (variant)}
						<button
							type="button"
							data-variant-option
							onclick={() => variantRegistry.select(group.id, i)}
							aria-pressed={group.active === i}
							title={`Show ${variant} (${i + 1})`}
							class={["flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-all", group.active === i ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"]}>
							<span class="font-mono text-[10px] opacity-60" aria-hidden="true">[{i + 1}]</span>
							<span>{variant}</span>
						</button>
					{/each}
				</div>
			{/if}
		{/each}
	{:else}
		<button type="button" onclick={toggle} aria-expanded="false" title="Expand variant switcher (Esc)" aria-label={`Expand variant switcher, ${groups.length} ${groups.length === 1 ? "set" : "sets"}`} class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-neutral-300 hover:text-white">
			<span class="inline-block size-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
			<span class="font-mono text-[10px]">{groups.length}</span>
			<span aria-hidden="true" class="font-mono text-xs">▸</span>
		</button>
	{/if}
</div>
