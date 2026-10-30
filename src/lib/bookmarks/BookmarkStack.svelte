<script lang="ts">
	import { onMount, tick } from "svelte";
	import { flip } from "svelte/animate";
	import { cubicOut } from "svelte/easing";
	import { MediaQuery } from "svelte/reactivity";
	import { afterNavigate, goto } from "$app/navigation";
	import { Archive, Check, CircleOff, Pencil, X } from "@lucide/svelte";
	import { getWorkspace } from "#lib/crm.remote.js";
	import { stageLabels, typeLabels, typeStyles } from "#lib/pipeline/labels.js";
	import { bookmarks } from "./bookmarks.svelte.js";

	type Stage = keyof typeof stageLabels;
	type Type = keyof typeof typeLabels;
	type Entry = { id: string; state: "loading" } | { id: string; state: "active"; title: string; type: Type; stage: Stage } | { id: string; state: "archived"; title: string } | { id: string; state: "missing" };

	// The rail stack lives in the desktop sidebar; the compact one sits in the phone and tablet top bar.
	let { variant, openOpportunity }: { variant: "rail" | "compact"; openOpportunity: (id: string) => void } = $props();

	const id = $props.id();
	const desktop = new MediaQuery("(min-width: 64rem)");
	const reducedMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
	let trigger = $state<HTMLButtonElement>();
	let front = $state<HTMLElement>();
	let fan = $state<HTMLElement>();
	let open = $state(false);
	let mode = $state<"rail" | "collapsed" | "compact">("rail");
	let placement = $state("");
	let scrollable = $state(false);
	let announcement = $state("");
	let editingNote = $state("");
	let noteDraft = $state("");
	let placedWidth = 0;

	let ids = $derived(bookmarks.ids);
	// Bookmarks never ship with the server render, so both stacks stay empty until the browser has mounted.
	let shown = $derived(bookmarks.hydrated && ids.length > 0 && (variant === "rail") === desktop.current);
	// One shared workspace query, the same instance the pipeline and dashboard read, and only while there is something to show.
	let remote = $derived(shown ? getWorkspace({ archived: false }) : undefined);
	let entries = $derived.by((): Entry[] => {
		const workspace = remote?.current;
		return ids.map((saved) => {
			if (!workspace) return { id: saved, state: "loading" };
			const active = workspace.opportunities.find((row) => row.id === saved);
			if (active) return { id: saved, state: "active", title: active.title, type: active.type, stage: active.stage };
			// The workspace still names archived opportunities; a deleted one is gone from it entirely.
			const known = workspace.referenceOpportunities.find((row) => row.id === saved);
			if (known?.archivedAt) return { id: saved, state: "archived", title: known.title };
			return known ? { id: saved, state: "loading" } : { id: saved, state: "missing" };
		});
	});
	let deck = $derived(entries.slice(0, 3));
	let topColors = $derived(tone(deck[0]));
	let countLabel = $derived(`${ids.length} ${ids.length === 1 ? "opportunity" : "opportunities"}`);

	onMount(() => bookmarks.hydrate());
	afterNavigate(() => fan?.hidePopover());

	function title(entry: Entry) {
		if (entry.state === "active" || entry.state === "archived") return entry.title;
		return entry.state === "missing" ? "Unavailable opportunity" : "Loading opportunity";
	}

	function tone(entry: Entry | undefined) {
		const family = entry?.state === "active" ? typeStyles[entry.type].tone : null;
		return family ? { wash: `var(--color-category-${family})`, ink: `var(--color-category-${family}-ink)`, edge: `var(--color-category-${family}-edge)` } : { wash: "var(--color-paper)", ink: "var(--color-muted)", edge: "var(--color-hairline)" };
	}

	// Measure where the stack sits so the fan opens from it: over the stack in the full rail, beside the collapsed rail, or below the top-bar button.
	function place() {
		if (!trigger || !front) return;
		placedWidth = innerWidth;
		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
		const cardHeight = 3.5 * rem;
		const step = cardHeight + 0.5 * rem;
		const source = trigger.getBoundingClientRect();
		const card = front.getBoundingClientRect();
		mode = variant === "compact" ? "compact" : trigger.closest("[data-collapsed='true']") ? "collapsed" : "rail";
		let left: number;
		let top: number;
		let width: number;
		if (mode === "rail") {
			({ left, top } = card);
			width = Math.max(card.width, 18 * rem);
		} else if (mode === "collapsed") {
			width = 18 * rem;
			left = source.right + 0.75 * rem;
			top = card.top;
		} else {
			width = Math.min(20 * rem, innerWidth - 1.5 * rem);
			left = Math.max(0.75 * rem, source.right - width);
			top = source.bottom + 0.5 * rem;
		}
		const gutter = 1.25 * rem;
		left = Math.max(gutter, Math.min(left, innerWidth - width - gutter));
		const height = Math.min(entries.length * step - 0.5 * rem, innerHeight - 2 * gutter);
		if (mode !== "compact") top = source.bottom - height;
		top = Math.max(gutter, Math.min(top, innerHeight - gutter - height));
		let maxHeight = innerHeight - top - gutter;
		scrollable = entries.length * step > maxHeight;
		// A scrolling fan pads its edges so remove badges hanging off the cards are not clipped.
		if (scrollable) maxHeight -= 1.25 * rem;
		placement = [`--fallback-left:${left}px`, `--fallback-top:${top}px`, `--fan-width:${width}px`, `width:${width}px`, `max-height:${maxHeight}px`, `--n:${entries.length}`, `--source-x:${mode === "compact" ? 0 : card.left - left}px`, `--source-y:${mode === "compact" ? -0.5 * rem : card.top - top}px`].join(";");
	}

	function primaries() {
		return [...(fan?.querySelectorAll<HTMLElement>("[data-primary]") ?? [])];
	}

	function navigate(event: KeyboardEvent) {
		const list = mode === "compact" ? primaries() : primaries().toReversed();
		const current = list.findIndex((element) => element.closest("li")?.contains(document.activeElement));
		const next = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: list.length - 1 }[event.key];
		if (next === undefined || !list.length) return;
		event.preventDefault();
		list.at(next % list.length)?.focus();
	}

	function openEntry(event: MouseEvent, href: string) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		fan?.hidePopover();
		void goto(href);
	}

	function openBookmarkedOpportunity(event: MouseEvent, id: string) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		fan?.hidePopover();
		openOpportunity(id);
	}

	function saveNote(id: string) {
		if (editingNote !== id) return;
		bookmarks.setNote(id, noteDraft);
		editingNote = "";
	}

	function blurNote(event: FocusEvent, id: string) {
		if (event.relatedTarget instanceof HTMLInputElement && event.relatedTarget.closest("li") === (event.currentTarget as HTMLElement).closest("li")) return;
		if (event.relatedTarget instanceof HTMLElement && event.relatedTarget.dataset.noteEdit === id) return;
		saveNote(id);
	}

	function finishNote(id: string, cancel = false) {
		if (cancel) editingNote = "";
		else saveNote(id);
		fan?.querySelector<HTMLElement>(`[data-note-edit="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
	}

	async function remove(entry: Entry) {
		const index = entries.findIndex((item) => item.id === entry.id);
		bookmarks.remove(entry.id);
		announcement = `Removed ${title(entry)} from bookmarks`;
		await tick();
		const list = primaries().filter((element) => !element.closest("li")?.hasAttribute("data-leaving"));
		const target = list[Math.min(index, list.length - 1)];
		if (target) target.focus();
		else {
			fan?.hidePopover();
			document.getElementById("workspace-main")?.focus();
		}
	}

	function leave(node: Element) {
		node.setAttribute("data-leaving", "");
		return {
			duration: reducedMotion.current ? 0 : 180,
			easing: cubicOut,
			css: (t: number) => `opacity:${t};transform:translateX(${(1 - t) * -12}px) scale(${0.96 + t * 0.04})`,
		};
	}
</script>

<svelte:window
	onresize={() => {
		// Phone toolbars resize the viewport's height while scrolling; only a width change moves the stack.
		if (innerWidth !== placedWidth) fan?.hidePopover();
	}} />

{#snippet tile(entry: Entry)}
	{@const colors = tone(entry)}
	<span style:--wash={colors.wash} style:--ink={colors.ink} style:--edge={colors.edge} class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-(--edge)/45 bg-[color-mix(in_oklab,var(--edge)_16%,var(--wash))] text-(--ink)" aria-hidden="true">
		{#if entry.state === "active"}
			{@const Icon = typeStyles[entry.type].icon}
			<Icon size={16} strokeWidth={2.1} />
		{:else if entry.state === "archived"}
			<Archive size={14} strokeWidth={2} />
		{:else if entry.state === "missing"}
			<CircleOff size={14} strokeWidth={2} />
		{/if}
	</span>
{/snippet}

{#snippet face(entry: Entry)}
	{#if entry.state === "loading"}
		<span class="flex min-w-0 flex-1 flex-col gap-1.5" aria-hidden="true"><span class="bg-paper-pill/70 h-2.5 w-3/4 rounded-full"></span><span class="bg-paper-pill/50 h-2 w-1/3 rounded-full"></span></span>
	{:else}
		<span class="flex min-w-0 flex-1 flex-col">
			<span class={["truncate text-sm/5 font-semibold", entry.state === "active" ? "text-(--title)" : "text-muted"]}>{title(entry)}</span>
			<span class={["flex items-center gap-1.5 truncate text-xs/4", entry.state === "active" ? "text-(--ink)/75" : "text-muted"]}>
				{#if entry.state === "active"}
					<span class="sr-only">{typeLabels[entry.type]}, </span>{stageLabels[entry.stage]}
				{:else if entry.state === "archived"}
					Archived
				{:else}
					No longer available
				{/if}
			</span>
		</span>
	{/if}
{/snippet}

{#if shown}
	<div class={["bookmark-stack", variant === "rail" && "mb-5 shrink-0"]} data-variant={variant} data-open={open}>
		<button
			bind:this={trigger}
			type="button"
			popovertarget={`${id}-fan`}
			aria-controls={`${id}-fan`}
			aria-expanded={open}
			aria-label={`Bookmarks, ${countLabel}`}
			title={variant === "rail" ? undefined : "Bookmarks"}
			class={["stack-trigger group/stack relative flex min-h-11 items-center rounded-xl text-left", variant === "rail" ? "w-full" : "size-11 shrink-0 justify-center [--card-h:2.75rem]"]}>
			<span class="relative block w-full">
				{#each deck.slice(1) as entry, index (entry.id)}
					{@const colors = tone(entry)}
					<span class="surface stack-card stack-back block" style:--depth={index + 1} style:--tilt={index === 0 ? "-1.4deg" : "1.8deg"} style:--wash={colors.wash} style:--edge={colors.edge} aria-hidden="true"></span>
				{/each}
				<span bind:this={front} class={["surface stack-card stack-front relative flex items-center", variant === "rail" ? "gap-3 px-3" : "justify-center"]} style:--wash={topColors.wash} style:--ink={topColors.ink} style:--edge={topColors.edge} aria-hidden="true">
					{@render tile(deck[0])}
					{#if variant === "rail"}<span class="stack-text flex min-w-0 flex-1">{@render face(deck[0])}</span>{/if}
					<span class="stack-count bg-ink ring-paper text-2xs pointer-events-none absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-semibold text-white tabular-nums ring-2">{ids.length}</span>
				</span>
			</span>
		</button>

		<div
			bind:this={fan}
			id={`${id}-fan`}
			popover="auto"
			role="group"
			aria-label="Bookmarks"
			class="fan"
			data-mode={mode}
			data-scroll={scrollable || undefined}
			style={placement}
			onbeforetoggle={(event) => {
				open = event.newState === "open";
				if (event.newState === "open") place();
			}}
			ontoggle={(event) => {
				open = event.newState === "open";
				if (open && fan?.matches(":popover-open")) {
					primaries()[0]?.focus({ preventScroll: true });
				} else if (fan?.contains(document.activeElement)) trigger?.focus();
			}}
			onfocusout={(event) => {
				const next = event.relatedTarget as Node | null;
				if (next && !fan?.contains(next) && next !== trigger) fan?.hidePopover();
			}}>
			<ul class={["flex gap-2", mode === "compact" ? "flex-col" : "flex-col-reverse"]} style:--n={entries.length}>
				{#each entries as entry, index (entry.id)}
					{@const colors = tone(entry)}
					<li class="fan-card" style:--i={index} style:--depth={Math.min(index, 2)} style:--tilt={index === 0 ? "0deg" : index === 1 ? "-1.4deg" : "1.8deg"} style:--delay={`${Math.min(index, 4) * 12}ms`} animate:flip={{ duration: reducedMotion.current ? 0 : 220, easing: cubicOut }} out:leave>
						<div style:--wash={colors.wash} style:--ink={colors.ink} style:--edge={colors.edge} class="surface card-face group/bookmark relative flex h-14 items-center gap-3 pr-1.5 pl-3 pointer-fine:pr-3">
							{@render tile(entry)}
							{#if entry.state === "active"}
								{@const href = `/pipeline?opportunity=${encodeURIComponent(entry.id)}`}
								<div class="flex min-w-0 flex-1 flex-col">
									<a {href} data-primary onkeydown={navigate} class="truncate text-sm/5 font-semibold text-(--title) after:absolute after:inset-0" onclick={(event) => openBookmarkedOpportunity(event, entry.id)}>{entry.title}</a>
									<div class="pointer-events-none flex min-w-0 items-center gap-1 text-xs/4 text-(--ink)/75">
										{#if editingNote === entry.id}
											<input
												class="pointer-events-auto relative z-10 field-sizing-content min-w-0 border-0 bg-transparent p-0 text-xs/4 text-(--ink) caret-current placeholder:text-(--ink)/50"
												aria-label={`Bookmark note for ${entry.title}`}
												placeholder="Add a note…"
												maxlength="200"
												bind:value={noteDraft}
												{@attach (input) => {
													input.focus();
													input.select();
												}}
												onblur={(event) => blurNote(event, entry.id)}
												onkeydown={(event) => {
													if (event.key === "Enter" || event.key === "Escape") {
														event.preventDefault();
														event.stopPropagation();
														finishNote(entry.id, event.key === "Escape");
													}
												}} />
										{:else}
											<span class="min-w-0 truncate">{bookmarks.note(entry.id) || stageLabels[entry.stage]}</span>
										{/if}
										<button
											type="button"
											data-note-edit={entry.id}
											data-variant="ghost"
											data-icon
											data-size="sm"
											style:--action-color="var(--title)"
											class={[
												"control pointer-events-auto z-10 -my-0.5 size-5 min-h-0",
												editingNote !== entry.id &&
													"pointer-fine:pointer-events-none pointer-fine:opacity-0 pointer-fine:group-hover/bookmark:pointer-events-auto pointer-fine:group-hover/bookmark:opacity-100 pointer-fine:group-has-[:focus-visible]/bookmark:pointer-events-auto pointer-fine:group-has-[:focus-visible]/bookmark:opacity-100",
											]}
											aria-label={`${editingNote === entry.id ? "Save" : "Edit"} bookmark note for ${entry.title}`}
											title={editingNote === entry.id ? "Save bookmark note" : "Edit bookmark note"}
											onblur={(event) => blurNote(event, entry.id)}
											onclick={() => {
												if (editingNote === entry.id) finishNote(entry.id);
												else {
													editingNote = entry.id;
													noteDraft = bookmarks.note(entry.id);
												}
											}}>
											{#if editingNote === entry.id}<Check size={11} strokeWidth={2.2} aria-hidden="true" />{:else}<Pencil size={11} aria-hidden="true" />{/if}
										</button>
									</div>
								</div>
							{:else if entry.state === "archived"}
								<a href="/pipeline/archived" data-primary onkeydown={navigate} class="flex min-w-0 flex-1 items-center after:absolute after:inset-0" onclick={(event) => openEntry(event, "/pipeline/archived")}>{@render face(entry)}</a>
							{:else}
								<span class="flex min-w-0 flex-1 items-center">{@render face(entry)}</span>
							{/if}
							<button
								type="button"
								data-primary={entry.state === "missing" || entry.state === "loading" || undefined}
								aria-label={`Remove bookmark: ${title(entry)}`}
								title="Remove bookmark"
								onkeydown={navigate}
								class="fan-remove pointer-fine:shadow-raised relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-(--title)/70 transition-[background-color,color,opacity,scale] duration-150 after:absolute after:-inset-1.5 hover:bg-(--edge)/15 hover:text-(--title) active:scale-90 pointer-fine:absolute pointer-fine:-top-2 pointer-fine:-right-2 pointer-fine:size-6 pointer-fine:border pointer-fine:border-(--edge)/60 pointer-fine:bg-[color-mix(in_oklab,var(--wash)_45%,var(--color-white))] after:pointer-fine:hidden pointer-fine:hover:bg-(--wash)"
								onclick={() => remove(entry)}>
								<X size={14} strokeWidth={2.4} aria-hidden="true" />
							</button>
						</div>
					</li>
				{/each}
			</ul>
		</div>
		<p role="status" class="sr-only">{announcement}</p>
	</div>
{/if}

<style>
	.bookmark-stack {
		--card-h: 3.5rem;
		--spring: linear(0, 0.03, 0.106, 0.212, 0.334, 0.46, 0.582, 0.694, 0.793, 0.877, 0.944, 0.997, 1.035, 1.061, 1.076, 1.083, 1.083, 1.079, 1.071, 1.061, 1.051, 1.04, 1.031, 1.022, 1.014, 1.008, 1.003, 0.999, 0.996, 0.994, 0.993, 0.993, 0.993, 0.994, 0.994, 0.995, 1);
	}

	/* Each card is washed in its opportunity type's category color, fading toward the surface; titles take that color pulled toward the ink. */
	.stack-card,
	.card-face {
		--title: color-mix(in oklab, var(--ink) 70%, var(--color-ink));
		border-color: color-mix(in oklab, var(--edge) 55%, transparent);
		background: linear-gradient(160deg, var(--wash), color-mix(in oklab, var(--wash) 70%, var(--color-white)) 55%, var(--color-white));
	}
	.card-face {
		box-shadow: var(--shadow-floating);
	}

	/* The deck: the newest bookmark faces up, the next two peek out behind it at a slight angle. */
	.stack-card {
		height: var(--card-h);
		transition:
			transform 360ms var(--ease-shell),
			opacity 200ms ease;
	}
	.stack-back {
		position: absolute;
		inset: 0;
		transform-origin: 50% 100%;
		transform: translateY(calc(var(--depth) * -0.5rem)) scale(calc(1 - var(--depth) * 0.06)) rotate(var(--tilt));
		z-index: calc(-1 * var(--depth));
	}
	.stack-front {
		transition:
			transform 160ms var(--ease-shell),
			box-shadow 360ms var(--ease-shell);
	}
	.stack-text {
		transition: opacity 160ms ease;
	}
	.stack-count {
		opacity: 1;
		scale: 1;
		transition:
			opacity 160ms ease,
			scale 260ms var(--ease-shell);
	}
	.stack-trigger {
		anchor-name: --bookmark-trigger;
		&:active .stack-front {
			transform: scale(0.98);
		}
		@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
			&:hover {
				.stack-back {
					transform: translateY(calc(var(--depth) * -0.75rem)) scale(calc(1 - var(--depth) * 0.05)) rotate(calc(var(--tilt) * 1.8));
				}
				.stack-front {
					box-shadow: 0 10px 24px -14px color-mix(in oklab, var(--ink) 50%, transparent);
				}
			}
		}
	}

	/* The cards leave the deck while the fan is out. */
	.bookmark-stack[data-open="true"] {
		.stack-count {
			opacity: 0;
		}
		.stack-back {
			opacity: 0;
			transform: translateY(0) scale(0.94);
		}
	}

	/* A collapsed rail keeps the deck and its count, but drops the title. */
	:global(.workspace[data-collapsed="true"]) .bookmark-stack {
		.stack-text {
			opacity: 0;
		}
		.stack-count {
			opacity: 1;
			scale: 1;
		}
		&[data-open="true"] .stack-front {
			opacity: 0.4;
		}
	}

	/* The fan is a top-layer popover, so the browser handles outside clicks and Escape. */
	.fan {
		position: fixed;
		inset: auto;
		left: var(--fallback-left);
		top: var(--fallback-top);
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		overflow: visible;
		transition:
			display 280ms allow-discrete,
			overlay 280ms allow-discrete;
		&:not(:popover-open) .card-face {
			transform: var(--folded);
			opacity: 0;
			transition-duration: 160ms, 120ms;
			transition-delay: 0ms;
			pointer-events: none;
		}
		&[data-mode="compact"] {
			.fan-card {
				--row: var(--i);
			}
			.card-face {
				--folded: translateY(calc(var(--source-y) - var(--row) * 4rem)) scale(0.96);
				transform-origin: top right;
				@media (prefers-reduced-motion: reduce) {
					--folded: none;
				}
			}
		}
		&[data-scroll] {
			box-sizing: content-box;
			margin: -0.625rem 0 0 -0.625rem;
			padding: 0.625rem;
			overflow-y: auto;
			overscroll-behavior: none;
			scrollbar-width: none;
		}
		&::backdrop {
			background: transparent;
		}
	}
	@supports (left: anchor(left)) {
		.fan {
			position-anchor: --bookmark-trigger;
			left: clamp(1.25rem, anchor(left), calc(100vw - 1.25rem - var(--fan-width)));
			top: clamp(1.25rem, calc(anchor(bottom) - min(calc(var(--n) * 4rem - 0.5rem), calc(100dvh - 2.5rem))), calc(100dvh - 1.25rem - min(calc(var(--n) * 4rem - 0.5rem), calc(100dvh - 2.5rem))));
			&[data-mode="collapsed"] {
				left: clamp(1.25rem, calc(anchor(right) + 0.75rem), calc(100vw - 1.25rem - var(--fan-width)));
			}
			&[data-mode="compact"] {
				left: clamp(1.25rem, calc(anchor(right) - var(--fan-width)), calc(100vw - 1.25rem - var(--fan-width)));
				top: clamp(1.25rem, calc(anchor(bottom) + 0.5rem), calc(100dvh - 1.25rem - min(calc(var(--n) * 4rem - 0.5rem), calc(100dvh - 2.5rem))));
			}
		}
	}
	/* Keep fan motion on the face so list reordering can animate independently. */
	.fan-card {
		--row: calc(var(--n) - 1 - var(--i));
		position: relative;
		z-index: calc(var(--n) - var(--i));
	}
	.card-face {
		--folded: translate(var(--source-x), calc(var(--source-y) - var(--row) * 4rem - var(--depth) * 0.5rem)) scale(calc(1 - var(--depth) * 0.06)) rotate(var(--tilt));
		transform-origin: center bottom;
		transform: none;
		opacity: 1;
		transition:
			transform 230ms var(--ease-shell) var(--delay),
			opacity 160ms ease var(--delay);
		@starting-style {
			transform: var(--folded);
			opacity: 1;
		}
		@media (prefers-reduced-motion: reduce) {
			--folded: none;
			transition: opacity 100ms ease;
		}
	}

	/* Precise pointers reveal the remove control on intent; touch keeps it visible. */
	@media (hover: hover) and (pointer: fine) {
		.fan-remove {
			opacity: 0;
		}
		.card-face:hover .fan-remove,
		.card-face:has(:focus-visible) .fan-remove {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stack-card,
		.stack-front {
			transition: opacity 160ms ease;
		}
		.stack-trigger:active .stack-front {
			transform: none;
		}
	}
</style>
