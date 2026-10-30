<script lang="ts">
	import { Archive, Ellipsis, Pin, Trash2 } from "@lucide/svelte";
	import Menu from "#lib/ui/Menu.svelte";
	import OverlayPreview from "./OverlayPreview.svelte";

	const id = $props.id();
	let contextMenu: HTMLDivElement;
	let contextTarget: HTMLButtonElement;
	let returnTarget: HTMLElement | undefined;
	let contextOpen = $state(false);
	let status = $state("Fixture only · no records are changed.");
	const actions = [
		{ id: "pin", label: "Pin opportunity", icon: Pin },
		{ id: "archive", label: "Archive opportunity", icon: Archive },
		{ id: "delete", label: "Delete opportunity", icon: Trash2 },
	] as const;

	function simulate(label: string) {
		status = `Simulated: ${label.toLowerCase()}. No records were changed.`;
	}
	function menuItems() {
		return [...(contextMenu?.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)") ?? [])];
	}
	function closeContext(restore = true) {
		if (!contextMenu?.matches(":popover-open")) return;
		contextMenu.hidePopover();
		contextOpen = false;
		if (restore && returnTarget?.isConnected) returnTarget.focus();
	}
	function openContext(target: HTMLElement, x?: number, y?: number) {
		returnTarget = target;
		const anchor = target.getBoundingClientRect();
		if (!contextMenu.matches(":popover-open")) contextMenu.showPopover();
		const box = contextMenu.getBoundingClientRect();
		contextMenu.style.left = `${Math.max(8, Math.min(x ?? anchor.left, window.innerWidth - box.width - 8))}px`;
		contextMenu.style.top = `${Math.max(8, Math.min(y ?? anchor.bottom + 6, window.innerHeight - box.height - 8))}px`;
		contextOpen = true;
		menuItems()[0]?.focus();
	}
	function contextKey(event: KeyboardEvent) {
		if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
		event.preventDefault();
		event.stopPropagation();
		openContext(event.currentTarget as HTMLElement);
	}
	function navigate(event: KeyboardEvent) {
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			closeContext();
			return;
		}
		if (event.key === "Tab") {
			closeContext();
			return;
		}
		const items = menuItems();
		if (!items.length) return;
		const current = items.indexOf(document.activeElement as HTMLButtonElement);
		const next = { ArrowDown: (current + 1) % items.length, ArrowUp: (current - 1 + items.length) % items.length, Home: 0, End: items.length - 1 }[event.key];
		if (next === undefined) return;
		event.preventDefault();
		items[next]?.focus();
	}
</script>

<svelte:window onresize={() => closeContext()} />
<svelte:document
	onscrollcapture={(event) => {
		if (!(event.target instanceof Node && contextMenu?.contains(event.target))) closeContext();
	}} />

<div class="grid min-w-0 gap-8 @min-[44rem]/guide:grid-cols-2">
	<div class="min-w-0">
		<h3 class="text-sm font-semibold">Dropdown menu</h3>
		<p class="text-muted mt-1 text-xs/5">Fixture only · the existing Meadow menu, with grouped actions and a destructive last item.</p>
		<div class="bg-paper/50 mt-4 flex min-h-32 items-center justify-between gap-4 rounded-2xl p-4">
			<div class="min-w-0">
				<p class="item-title">Maple first home</p>
				<p class="text-muted mt-1 text-xs">Sample opportunity</p>
			</div>
			<Menu label="Sample opportunity actions">
				<p class="text-muted px-2.5 py-2 text-xs">Sample opportunity · fixture only</p>
				{#each actions as action (action.id)}
					{#if action.id === "delete"}<hr class="border-hairline my-1" />{/if}
					<button type="button" role="menuitem" class="menu-item" data-tone={action.id === "delete" ? "danger" : undefined} onclick={() => simulate(action.label)}><action.icon size={15} aria-hidden="true" />{action.label}</button>
				{/each}
			</Menu>
		</div>
		<p class="text-muted mt-3 text-xs/5">Open with the action button. Use ↑ / ↓, Home / End, Enter, and Escape.</p>
	</div>
	<div class="min-w-0">
		<h3 class="text-sm font-semibold">Context menu</h3>
		<p class="text-muted mt-1 text-xs/5">Fixture only · right-click the sample, or use the visible actions button on touch.</p>
		<div class="bg-paper/50 mt-4 flex min-h-32 items-center gap-3 rounded-2xl p-4">
			<button
				bind:this={contextTarget}
				type="button"
				class="min-w-0 flex-1 rounded-xl px-3 py-2 text-left pointer-fine:hover:bg-white/60"
				aria-haspopup="menu"
				aria-expanded={contextOpen}
				aria-controls={`${id}-context`}
				oncontextmenu={(event) => {
					event.preventDefault();
					openContext(event.currentTarget, event.clientX, event.clientY);
				}}
				onkeydown={contextKey}
				onclick={() => openContext(contextTarget)}>
				<span class="item-title block">Maple first home</span><span class="text-muted mt-1 block text-xs">Sample opportunity · right-click or activate</span>
			</button>
			<button type="button" class="control" data-variant="ghost" data-size="sm" data-icon aria-label="Open sample context menu" aria-haspopup="menu" aria-expanded={contextOpen} aria-controls={`${id}-context`} onkeydown={contextKey} onclick={(event) => openContext(event.currentTarget)}
				><Ellipsis size={16} aria-hidden="true" /></button>
		</div>
		<p class="text-muted mt-3 text-xs/5">Focus the sample, then press Context Menu or Shift + F10. ↑ / ↓, Home / End, Escape, and focus return are local to this specimen.</p>
	</div>
	<div class="min-w-0">
		<h3 class="text-sm font-semibold">Hover card</h3>
		<p class="text-muted mt-1 text-xs/5">Fixture only · preview without replacing the link’s normal navigation.</p>
		<div class="bg-paper/50 mt-4 rounded-2xl p-5">
			<p class="mb-3 text-sm/6">Keep useful context close to the thing you are reading.</p>
			<OverlayPreview href="#buttons" label="Button specimens" title="One action language" description="Native controls in their rest, hover, focus, pressed, disabled, and busy states. This preview is guide content, not a live record." />
		</div>
		<p class="text-muted mt-3 text-xs/5">Hover or focus the link. The delayed close allows pointer travel into the preview; Preview is an explicit keyboard and touch alternative.</p>
	</div>
	<div class="min-w-0">
		<h3 class="text-sm font-semibold">Upstream source · citation preview</h3>
		<p class="text-muted mt-1 text-xs/5">The upstream “source” means a citation, not the product’s Lead source field. Fixture only; no fetched or verified claims.</p>
		<div class="bg-paper/50 mt-4 rounded-2xl p-5">
			<p class="mb-3 text-sm/6">A small citation can carry a title and short excerpt without interrupting the surrounding text.</p>
			<OverlayPreview citation href="#fields" label="Style guide · Fields" title="Fields and their supporting context" description="Sample citation excerpt: labels, hints, and validation belong near the input. This citation points to the guide’s field specimens, not an external publication." />
		</div>
		<p class="text-muted mt-3 text-xs/5">The citation remains a direct link. The preview is nonmodal, dismissible with Escape, and does not block the rest of the guide.</p>
	</div>
</div>
<p role="status" class="text-muted mt-5 text-xs/5">{status}</p>

<div
	bind:this={contextMenu}
	id={`${id}-context`}
	popover="auto"
	role="menu"
	tabindex="-1"
	aria-label="Sample opportunity context actions"
	class="surface surface-floating menu fixed inset-auto m-0 max-h-[calc(100dvh-1rem)] w-60 max-w-[calc(100vw-1rem)] overflow-y-auto"
	onkeydown={navigate}
	onbeforetoggle={(event) => (contextOpen = event.newState === "open")}
	ontoggle={(event) => {
		if (event.newState === "closed" && (contextMenu.contains(document.activeElement) || document.activeElement === document.body)) returnTarget?.focus();
	}}>
	<p class="text-muted px-2.5 py-2 text-xs">Sample opportunity · fixture only</p>
	{#each actions as action (action.id)}
		{#if action.id === "delete"}<hr class="border-hairline my-1" />{/if}
		<button
			type="button"
			role="menuitem"
			tabindex="-1"
			class="menu-item"
			data-tone={action.id === "delete" ? "danger" : undefined}
			onclick={() => {
				simulate(action.label);
				closeContext();
			}}><action.icon size={15} aria-hidden="true" />{action.label}</button>
	{/each}
</div>
