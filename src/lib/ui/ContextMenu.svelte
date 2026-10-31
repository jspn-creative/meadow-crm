<!-- A menu opened at the pointer by a right click, or under the focused element from the keyboard's context-menu key. It shares Menu's surface, items, and arrow-key handling. -->
<script lang="ts">
	import { tick, type Snippet } from "svelte";

	let { label, children }: { label: string; children: Snippet } = $props();

	let menu = $state<HTMLElement>();
	let open = $state(false);
	let point = $state({ x: 0, y: 0 });
	let opener: HTMLElement | null = null;

	const items = () => [...(menu?.querySelectorAll<HTMLElement>("[role^='menuitem']:not(:disabled)") ?? [])];

	/** Opens at the pointer, or below `target` when the event came from the keyboard. */
	export async function show(event: MouseEvent | KeyboardEvent, target: HTMLElement) {
		event.preventDefault();
		opener = document.activeElement instanceof HTMLElement ? document.activeElement : target;
		const rect = target.getBoundingClientRect();
		const pointer = event instanceof MouseEvent && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
		point = pointer ? { x: event.clientX, y: event.clientY } : { x: rect.left, y: rect.bottom + 4 };
		menu?.hidePopover();
		menu?.showPopover();
		await tick();
		// Keep the whole menu on screen, flipping it to the other side of the point when it would overflow.
		if (!menu) return;
		const box = menu.getBoundingClientRect();
		point = {
			x: point.x + box.width > innerWidth - 8 ? Math.max(8, point.x - box.width) : point.x,
			y: point.y + box.height > innerHeight - 8 ? Math.max(8, point.y - box.height) : point.y,
		};
	}
	function navigate(event: KeyboardEvent) {
		const list = items();
		const index = list.indexOf(document.activeElement as HTMLElement);
		const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.length - 1 }[event.key];
		if (next === undefined) {
			if (event.key === "Tab") menu?.hidePopover();
			return;
		}
		event.preventDefault();
		if (list.length) list[(next + list.length) % list.length]?.focus();
	}
</script>

<div
	bind:this={menu}
	popover="auto"
	role="menu"
	tabindex="-1"
	aria-label={label}
	class="surface surface-floating menu fixed m-0 min-w-52"
	style:inset="auto"
	style:left={`${point.x}px`}
	style:top={`${point.y}px`}
	onbeforetoggle={(event) => (open = event.newState === "open")}
	ontoggle={(event) => {
		if (event.newState === "open") items()[0]?.focus();
		// Return focus only when it would otherwise be lost, not when a click outside moved it somewhere on purpose.
		else if (document.activeElement === document.body || menu?.contains(document.activeElement)) opener?.focus({ preventScroll: true });
	}}
	onkeydown={navigate}
	oncontextmenu={(event) => event.preventDefault()}
	onclick={(event) => {
		if ((event.target as HTMLElement).closest("[role^='menuitem']")) menu?.hidePopover();
	}}>
	{#if open}{@render children()}{/if}
</div>
