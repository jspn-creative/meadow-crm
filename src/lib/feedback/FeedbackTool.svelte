<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import { Image as ImageIcon, MessageSquarePlus, Pencil, Trash2, X } from "@lucide/svelte";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";
	import type { FeedbackNote } from "#lib/server/feedback.js";
	import DrawingOverlay from "./DrawingOverlay.svelte";
	import { clearFeedbackNote, getFeedbackNotes, saveFeedbackNote } from "./feedback.remote.js";

	const positionKey = "meadow:feedback-position";
	const margin = 8;
	const dragThreshold = 4;
	const staleReadWindow = 60_000;
	const noteTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
	const listFade = overflowFade({ axis: "y", fadePercent: 8 });

	let mounted = $state(false);
	let open = $state(false);
	let drawingMode = $state(false);
	let viewing = $state<string | null>(null);
	let notes = $state.raw<FeedbackNote[]>([]);
	let canClear = $state(false);
	let loaded = $state(false);
	let lastWrite = 0;
	let editing = $state<FeedbackNote | null>(null);
	let body = $state("");
	// Undefined keeps the saved drawing, null removes it, and a string replaces it.
	let drawing = $state<string | null | undefined>(undefined);
	let pending = $state(false);
	let message = $state("");
	let confirmingClear = $state<string | null>(null);

	// Stored as distance from the bottom-right corner, so a window resize keeps the tool beside that corner and opening the panel grows it into the page.
	let position = $state({ right: 16, bottom: 16 });
	let width = $state(0);
	let height = $state(0);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	const clamp = (value: number, limit: number) => Math.max(margin, Math.min(value, Math.max(margin, limit - margin)));
	let right = $derived(clamp(position.right, viewportWidth - width));
	let bottom = $derived(clamp(position.bottom, viewportHeight - height));

	let drag: { x: number; y: number; right: number; bottom: number; moved: boolean } | null = null;
	let suppressClick = false;

	let savedDrawing = $derived(editing?.hasDrawing ? `/api/feedback/drawing/${editing.id}?v=${editing.updatedAt}` : null);
	let preview = $derived(drawing === undefined ? savedDrawing : drawing);
	let dirty = $derived(body.trim() !== (editing?.body ?? "") || drawing !== undefined);

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(positionKey) ?? "null");
			if (typeof saved?.right === "number" && typeof saved?.bottom === "number") position = saved;
		} catch {
			/* An unreadable position falls back to the default corner. */
		}
		mounted = true;
	});

	/** A modal dialog makes the rest of the page inert, so the tool moves inside the topmost one and stays usable. Its layers are manual popovers so that they sit in the top layer, positioned against the viewport rather than the dialog; moving a popover closes it, so each move shows them again. */
	function followModalDialog(element: HTMLElement) {
		const sync = () => {
			const host = [...document.querySelectorAll("dialog:modal")].at(-1) ?? document.body;
			if (element.parentElement === host) return;
			host.append(element);
			for (const layer of element.querySelectorAll<HTMLElement>("[popover]")) layer.showPopover();
		};
		const observer = new MutationObserver(sync);
		observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
		sync();
		return () => {
			observer.disconnect();
			element.remove();
		};
	}

	const showLayer = (layer: HTMLElement) => layer.showPopover();

	function startDrag(event: PointerEvent) {
		if (event.button || (event.target as Element).closest("[data-no-drag]")) return;
		drag = { x: event.clientX, y: event.clientY, right, bottom, moved: false };
		(event.currentTarget as Element).setPointerCapture(event.pointerId);
	}
	function moveDrag(event: PointerEvent) {
		if (!drag) return;
		const x = drag.x - event.clientX;
		const y = drag.y - event.clientY;
		if (!drag.moved && Math.hypot(x, y) < dragThreshold) return;
		drag.moved = true;
		position = { right: clamp(drag.right + x, viewportWidth - width), bottom: clamp(drag.bottom + y, viewportHeight - height) };
	}
	function endDrag() {
		if (!drag) return;
		suppressClick = drag.moved;
		if (drag.moved) {
			try {
				localStorage.setItem(positionKey, JSON.stringify(position));
			} catch {
				/* The tool stays where it is for this visit. */
			}
		}
		drag = null;
	}

	async function load() {
		// KV reads can trail a write for up to a minute, so a recent save keeps the local list rather than a stale one.
		if (loaded && Date.now() - lastWrite < staleReadWindow) return;
		try {
			const query = getFeedbackNotes();
			const result = await (loaded ? query.refresh().then(() => query) : query);
			notes = result!.notes;
			canClear = result!.canClear;
			loaded = true;
		} catch {
			message = "Unable to load notes. Try again.";
		}
	}
	function toggleOpen() {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		open = !open;
		message = "";
		if (open) void load();
	}
	function resetComposer() {
		editing = null;
		body = "";
		drawing = undefined;
		message = "";
	}
	function edit(note: FeedbackNote) {
		editing = note;
		body = note.body;
		drawing = undefined;
		message = "";
	}
	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (pending) return;
		pending = true;
		message = "";
		try {
			const note = await saveFeedbackNote({ id: editing?.id, body, page: editing?.page ?? `${page.url.pathname}${page.url.search}`, drawing });
			lastWrite = Date.now();
			notes = [note, ...notes.filter(({ id }) => id !== note.id)].sort((a, b) => b.createdAt - a.createdAt);
			resetComposer();
			message = "Saved. You can come back and edit it any time.";
		} catch (cause) {
			message = (cause as { body?: { message?: string } }).body?.message ?? "Unable to save the note. Try again.";
		} finally {
			pending = false;
		}
	}
	async function clear(note: FeedbackNote) {
		if (pending) return;
		// Clearing cannot be undone, so the first press only arms the button.
		if (confirmingClear !== note.id) {
			confirmingClear = note.id;
			return;
		}
		confirmingClear = null;
		pending = true;
		message = "";
		try {
			await clearFeedbackNote(note.id);
			lastWrite = Date.now();
			notes = notes.filter(({ id }) => id !== note.id);
			if (editing?.id === note.id) resetComposer();
		} catch {
			message = "Unable to clear the note. Try again.";
		} finally {
			pending = false;
		}
	}
</script>

<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />

{#if mounted}
	<!-- The outer element keeps this component's place in the layout while the inner one moves into modal dialogs. -->
	<div class="contents">
		<div class="contents" data-feedback-tool {@attach followModalDialog}>
			{#if drawingMode}
				<DrawingOverlay
					oncancel={() => (drawingMode = false)}
					onfinish={(image) => {
						drawing = image;
						drawingMode = false;
					}} />
			{:else if viewing}
				<button type="button" popover="manual" {@attach showLayer} aria-label="Close drawing" class="fixed inset-0 m-0 flex size-full max-h-none max-w-none cursor-zoom-out items-center justify-center border-0 bg-black/70 p-4" onclick={() => (viewing = null)}>
					<img src={viewing} alt="The page with the note's drawing" class="max-h-full max-w-full rounded-xl object-contain" />
				</button>
			{:else}
				<div
					role="presentation"
					popover="manual"
					{@attach showLayer}
					bind:offsetWidth={width}
					bind:offsetHeight={height}
					class="fixed inset-auto m-0 overflow-visible border-0 bg-transparent p-0"
					style:right="{right}px"
					style:bottom="{bottom}px"
					onkeydown={(event) => {
						if (event.key !== "Escape" || !open) return;
						// An open dialog would otherwise close along with the panel.
						event.preventDefault();
						open = false;
					}}>
					{#if open}
						<section aria-label="Feedback" class="surface surface-floating flex max-h-[min(36rem,calc(100dvh-1rem))] w-[min(22rem,calc(100vw-1rem))] flex-col">
							<div role="presentation" class="flex shrink-0 cursor-grab touch-none items-center justify-between gap-2 py-2 pr-2 pl-4 select-none active:cursor-grabbing" onpointerdown={startDrag} onpointermove={moveDrag} onpointerup={endDrag} onpointercancel={endDrag}>
								<h2 class="text-sm font-medium">Feedback</h2>
								<button type="button" class="control" data-size="sm" data-icon data-variant="ghost" data-no-drag aria-label="Close feedback" onclick={() => (open = false)}><X size={16} aria-hidden="true" /></button>
							</div>
							<form class="flex shrink-0 flex-col gap-2 px-4 pb-3" onsubmit={save}>
								<textarea class="field min-h-20 resize-y text-sm" aria-label={editing ? "Edit note" : "New note"} placeholder="What should we fix or improve?" maxlength="5000" bind:value={body} {@attach (element) => element.focus()}></textarea>
								{#if preview}
									<div class="flex items-center gap-2">
										<button type="button" class="border-hairline h-14 w-20 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border" aria-label="View drawing" onclick={() => (viewing = preview)}>
											<img src={preview} alt="" class="size-full object-cover object-top" />
										</button>
										<button type="button" class="text-action text-urgent" onclick={() => (drawing = null)}>Remove drawing</button>
									</div>
								{/if}
								<div class="flex flex-wrap items-center gap-2">
									<button
										type="button"
										class="control"
										data-size="sm"
										onclick={() => {
											message = "";
											drawingMode = true;
										}}><Pencil size={15} aria-hidden="true" />{preview ? "Draw again" : "Draw on page"}</button>
									<span class="ml-auto flex items-center gap-2">
										{#if editing || dirty}<button type="button" class="control" data-size="sm" data-variant="ghost" disabled={pending} onclick={resetComposer}>Cancel</button>{/if}
										<button type="submit" class="control" data-size="sm" data-variant="primary" disabled={pending || !dirty || (!body.trim() && !preview)} aria-busy={pending}>{editing ? "Save changes" : "Save note"}</button>
									</span>
								</div>
								{#if message}<p role="status" class="text-muted text-xs">{message}</p>{/if}
							</form>
							<div class="border-hairline min-h-0 flex-1 overflow-y-auto overscroll-contain border-t p-2" {@attach listFade}>
								{#if !loaded}
									<p class="text-muted px-2 py-3 text-sm">Loading notes…</p>
								{:else if !notes.length}
									<p class="text-muted px-2 py-3 text-sm">No notes yet.</p>
								{:else}
									<ul class="flex flex-col gap-1">
										{#each notes as note (note.id)}
											<li class={["rounded-nested hover:bg-highlight flex items-start", editing?.id === note.id && "bg-selected text-on-selected"]}>
												<button type="button" class="min-w-0 flex-1 p-2 text-left disabled:cursor-not-allowed" disabled={dirty && editing?.id !== note.id} title={dirty ? "Save or cancel your changes first" : undefined} aria-current={editing?.id === note.id || undefined} onclick={() => edit(note)}>
													<span class="line-clamp-2 text-sm/5 wrap-break-word">{note.body || "Drawing"}</span>
													<span class="text-muted mt-0.5 flex items-center gap-1 text-xs">
														{#if note.hasDrawing}<ImageIcon size={12} class="shrink-0" aria-label="Has a drawing" />{/if}
														<span class="truncate">{note.author} · {noteTime.format(note.createdAt)} · {note.page}</span>
													</span>
												</button>
												{#if canClear}
													{#if confirmingClear === note.id}
														<button type="button" class="control mt-1 mr-1 shrink-0" data-size="sm" data-variant="danger" disabled={pending} onblur={() => (confirmingClear = null)} onclick={() => clear(note)} {@attach (element) => element.focus()}>Clear?</button>
													{:else}
														<button type="button" class="control mt-1 mr-1" data-size="sm" data-icon data-variant="danger" aria-label="Clear note" disabled={pending} onclick={() => clear(note)}><Trash2 size={15} aria-hidden="true" /></button>
													{/if}
												{/if}
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						</section>
					{:else}
						<!-- Touch has no hover to reveal the label, so it stays icon-only there too rather than the reveal default of always showing it. -->
						<button
							type="button"
							class="control shadow-floating cursor-grab touch-none select-none active:cursor-grabbing pointer-coarse:[&_.control-label]:grid-cols-[0fr]"
							data-reveal
							aria-label="Feedback"
							onpointerdown={startDrag}
							onpointermove={moveDrag}
							onpointerup={endDrag}
							onpointercancel={endDrag}
							onclick={toggleOpen}>
							<MessageSquarePlus size={16} aria-hidden="true" /><span class="control-label" aria-hidden="true"><span><span>Feedback</span></span></span>
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
