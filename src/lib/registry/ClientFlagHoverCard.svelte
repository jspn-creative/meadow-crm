<script lang="ts">
	import { onDestroy, tick } from "svelte";
	import { Flag, X } from "@lucide/svelte";

	type Client = { id: string; name: string; flagged: boolean; flagNote: string };
	const id = $props.id();
	let preview: HTMLDivElement;
	let client = $state.raw<Client | null>(null);
	let open = $state(false);
	let trigger: HTMLElement | null = null;
	let row: HTMLElement | null = null;
	let opening: ReturnType<typeof setTimeout> | undefined;
	let closing: ReturnType<typeof setTimeout> | undefined;
	let suppressFocus = false;
	let configured = false;
	let generation = 0;
	let disposed = false;

	function clearTimers() {
		clearTimeout(opening);
		clearTimeout(closing);
	}
	function position() {
		if (!trigger || !preview) return;
		const anchor = trigger.getBoundingClientRect();
		const box = preview.getBoundingClientRect();
		preview.style.left = `${Math.max(8, Math.min(anchor.left, innerWidth - box.width - 8))}px`;
		preview.style.top = `${anchor.bottom + 8 + box.height <= innerHeight - 8 ? anchor.bottom + 8 : Math.max(8, anchor.top - box.height - 8)}px`;
	}
	export function close(restoreFocus = false) {
		clearTimers();
		generation++;
		const focusInside = preview?.contains(document.activeElement);
		if (preview?.matches(":popover-open")) preview.hidePopover();
		open = false;
		if (restoreFocus && focusInside && trigger?.isConnected) {
			suppressFocus = true;
			trigger.focus({ preventScroll: true });
			suppressFocus = false;
		}
		trigger?.setAttribute("aria-expanded", "false");
		trigger?.removeAttribute("aria-controls");
		trigger = null;
		row = null;
	}
	async function show(next: Client, source: HTMLElement, focus = false) {
		clearTimers();
		if (disposed || !next.flagged || !source.isConnected) return;
		if (client?.id !== next.id || row !== source) close();
		const showing = ++generation;
		row = source;
		trigger = source.querySelector<HTMLElement>("[data-flag-trigger]");
		if (!trigger) return;
		client = next;
		await tick();
		if (disposed || showing !== generation || row !== source || !trigger?.isConnected) return;
		// Keep the existing specimen's measured placement across browsers; hint falls back to auto for native light dismissal.
		if (!configured) {
			preview.popover = "hint";
			if (preview.popover !== "hint") preview.popover = "auto";
			configured = true;
		}
		if (!preview.matches(":popover-open")) preview.showPopover();
		open = true;
		trigger.setAttribute("aria-expanded", "true");
		trigger.setAttribute("aria-controls", `${id}-preview`);
		position();
		if (focus) preview.querySelector<HTMLButtonElement>("button")?.focus();
	}
	export function enter(event: PointerEvent, next: Client) {
		if (event.pointerType === "touch" || !next.flagged) return;
		clearTimers();
		const source = event.currentTarget as HTMLElement;
		opening = setTimeout(() => void show(next, source), 180);
	}
	export function focus(event: FocusEvent, next: Client) {
		if (!suppressFocus && next.flagged) void show(next, event.currentTarget as HTMLElement);
	}
	export function reveal(event: MouseEvent, next: Client) {
		const source = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-client-row]");
		if (source) void show(next, source, true);
	}
	export function leave() {
		clearTimers();
		closing = setTimeout(() => {
			if (row?.contains(document.activeElement) || preview?.contains(document.activeElement) || row?.matches(":hover") || preview?.matches(":hover")) return;
			close();
		}, 300);
	}
	export function reconcile(clients: Client[]) {
		if (!client || !open) return;
		const saved = clients.find((item) => item.id === client?.id);
		if (!saved?.flagged || !row?.isConnected) close(true);
		else {
			client = saved;
			void tick().then(() => {
				if (!disposed && open) position();
			});
		}
	}
	function escape(event: KeyboardEvent) {
		if (event.key !== "Escape" || !open) return;
		event.preventDefault();
		event.stopPropagation();
		close(true);
	}
	onDestroy(() => {
		disposed = true;
		generation++;
		clearTimers();
	});
</script>

<svelte:window onkeydown={escape} onresize={() => close(true)} />
<svelte:document
	onscrollcapture={(event) => {
		if (!(event.target instanceof Node && preview?.contains(event.target))) close(true);
	}} />

<div
	bind:this={preview}
	id={`${id}-preview`}
	popover="auto"
	role="region"
	aria-labelledby={`${id}-title`}
	class="surface surface-floating fixed inset-auto m-0 max-h-[calc(100dvh-1rem)] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto p-4"
	onpointerenter={clearTimers}
	onpointerleave={leave}
	onfocusin={clearTimers}
	onfocusout={leave}
	onbeforetoggle={(event) => {
		open = event.newState === "open";
		if (!open) {
			clearTimers();
			trigger?.setAttribute("aria-expanded", "false");
		}
	}}>
	<div class="flex items-center justify-between gap-3">
		<span class="text-field flex items-center gap-2 text-xs leading-none font-medium"><Flag size={14} aria-hidden="true" />Flagged for review</span><button type="button" class="icon-action" aria-label="Close flag note" onclick={() => close(true)}><X size={13} aria-hidden="true" /></button>
	</div>
	<p id={`${id}-title`} class="font-display mt-3 text-xl/tight tracking-tight">{client?.name}</p>
	<p class="text-muted mt-2 text-sm wrap-anywhere whitespace-pre-wrap">{client?.flagNote || "Flagged for review. No note added."}</p>
</div>
