<script lang="ts">
	import { onDestroy } from "svelte";
	import { ArrowUpRight, BookOpen, Eye, X } from "@lucide/svelte";

	let { href, label, title, description, citation = false }: { href: string; label: string; title: string; description: string; citation?: boolean } = $props();
	const id = $props.id();
	let trigger: HTMLDivElement;
	let preview: HTMLDivElement;
	let previewButton: HTMLButtonElement;
	let open = $state(false);
	let opening: ReturnType<typeof setTimeout> | undefined;
	let closing: ReturnType<typeof setTimeout> | undefined;

	function clearTimers() {
		clearTimeout(opening);
		clearTimeout(closing);
	}
	function position() {
		if (!preview || !trigger) return;
		const anchor = trigger.getBoundingClientRect();
		const box = preview.getBoundingClientRect();
		const left = Math.max(8, Math.min(anchor.left, window.innerWidth - box.width - 8));
		const below = anchor.bottom + 8;
		const top = below + box.height <= window.innerHeight - 8 ? below : Math.max(8, anchor.top - box.height - 8);
		preview.style.left = `${left}px`;
		preview.style.top = `${top}px`;
	}
	function show() {
		clearTimers();
		if (!preview || !trigger?.isConnected) return;
		if (!preview.matches(":popover-open")) preview.showPopover();
		open = true;
		position();
	}
	function close(restoreFocus = false) {
		clearTimers();
		if (!preview?.matches(":popover-open")) return;
		const focusInside = preview.contains(document.activeElement);
		preview.hidePopover();
		open = false;
		if (restoreFocus && focusInside) previewButton.focus();
	}
	function enter(event: PointerEvent) {
		if (event.pointerType === "touch") return;
		clearTimers();
		opening = setTimeout(show, 180);
	}
	function leave() {
		clearTimers();
		closing = setTimeout(() => {
			if (trigger?.contains(document.activeElement) || preview?.contains(document.activeElement)) return;
			close();
		}, 300);
	}
	function escape(event: KeyboardEvent) {
		if (!open || event.key !== "Escape") return;
		event.preventDefault();
		event.stopPropagation();
		close(true);
	}
	onDestroy(clearTimers);
</script>

<svelte:window onkeydown={escape} onresize={() => close(true)} />
<svelte:document
	onscrollcapture={(event) => {
		if (!(event.target instanceof Node && preview?.contains(event.target))) close(true);
	}} />

<div bind:this={trigger} role="group" aria-label={`${label} navigation and preview`} class="inline-flex max-w-full flex-wrap items-center gap-2" onpointerenter={enter} onpointerleave={leave} onfocusin={() => clearTimers()} onfocusout={leave}>
	<a {href} class={["text-field hover:text-field-deep inline-flex min-h-10 items-center gap-1.5 text-sm font-medium underline decoration-current/30 underline-offset-4", citation && "bg-paper rounded-md px-2 text-xs"]} aria-details={open ? `${id}-preview` : undefined} onfocus={show} onclick={() => close()}>
		{#if citation}<BookOpen size={13} aria-hidden="true" />{/if}{label}{#if citation}<span class="text-muted tabular-nums">[1]</span>{/if}
	</a>
	<button
		bind:this={previewButton}
		type="button"
		class="control"
		data-size="sm"
		aria-expanded={open}
		aria-controls={`${id}-preview`}
		onclick={() => {
			show();
			preview.querySelector<HTMLAnchorElement>("a")?.focus();
		}}><Eye size={14} aria-hidden="true" />Preview<span class="sr-only"> {label}</span></button>
</div>
<div
	bind:this={preview}
	id={`${id}-preview`}
	popover="auto"
	role="region"
	aria-labelledby={`${id}-title`}
	class="surface surface-floating fixed inset-auto m-0 max-h-[calc(100dvh-1rem)] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto p-4"
	onpointerenter={() => clearTimers()}
	onpointerleave={leave}
	onfocusin={() => clearTimers()}
	onfocusout={leave}
	onbeforetoggle={(event) => {
		open = event.newState === "open";
		if (!open) clearTimers();
	}}>
	<div class="flex items-start justify-between gap-3">
		<span class="text-muted text-xs font-medium">{citation ? "Citation · fixture only" : "Hover card · fixture only"}</span>
		<button type="button" class="control" data-variant="ghost" data-size="sm" data-icon aria-label="Close preview" onclick={() => close(true)}><X size={13} aria-hidden="true" /></button>
	</div>
	<p id={`${id}-title`} class="font-display mt-3 text-xl/tight tracking-tight">{title}</p>
	<p class="text-muted mt-2 text-sm/6 text-pretty">{description}</p>
	<a {href} class="text-field hover:text-field-deep mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium underline underline-offset-4" onclick={() => close()}>Open {citation ? "cited specimen" : "specimen"}<ArrowUpRight size={14} aria-hidden="true" /></a>
</div>
