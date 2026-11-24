import { tick } from "svelte";

/** A record's main pane and one sub-panel share a grid cell and trade places: the main pane slides aside toward the start as the sub-panel arrives from the end. Visibility waits for a leaving pane to finish but switches at once for an arriving one, so focus can move into it straight away. Each pane sets `data-active` and is inert while inactive. */
export const paneClass =
	"col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col transition-[opacity,translate,visibility] duration-300 ease-(--ease-shell) data-[active=false]:invisible data-[active=false]:opacity-0 data-[active=true]:transition-[opacity,translate] motion-reduce:transition-none";
export const mainPaneClass = `${paneClass} data-[active=false]:-translate-x-8`;
export const subPaneClass = `${paneClass} data-[active=false]:translate-x-8`;

/** Open sub-panels, innermost last: a sub-panel can hold its own, such as Log contact inside an opportunity, and Escape steps back one level at a time. A panel left open inside a pane that is now inert no longer counts. */
const open: SubPanel<unknown>[] = [];
const innermost = () => open.findLast((panel) => !panel.node?.closest("[inert]"));

/** A sub-panel inside a dialog, such as Log contact: opened with a value, a fresh form each time, focus on its heading, and Escape or a click outside stepping back to the record before either can close the dialog. */
export class SubPanel<T> {
	/** What the sub-panel was opened with, or null while it is closed. */
	current = $state<T | null>(null);
	/** Changes on every opening; key the sub-panel's form on it so each opening starts fresh. */
	key = $state(0);
	heading = $state<HTMLElement>();
	#opener: HTMLElement | null = null;
	/** The element stepBack is attached to. */
	node: HTMLElement | undefined;
	#onchange?: (open: boolean) => void;

	constructor(onchange?: (open: boolean) => void) {
		this.#onchange = onchange;
	}

	async open(value: T) {
		this.#opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const wasOpen = this.current !== null;
		this.key += 1;
		this.current = value;
		if (!open.includes(this)) open.push(this);
		if (!wasOpen) this.#onchange?.(true);
		await tick();
		this.heading?.focus({ preventScroll: true });
	}

	close() {
		if (this.current === null) return;
		this.current = null;
		open.splice(open.indexOf(this), 1);
		this.#onchange?.(false);
		// The opener's pane stops being inert only once the change is drawn, so focus waits for it; focus left on an inert pane would fall to the page.
		const opener = this.#opener;
		void tick().then(() => opener?.isConnected && opener.focus({ preventScroll: true }));
	}

	/** Attachment for any element inside the dialog. Escape is caught as a keydown, because a browser lets a page cancel a dialog's own cancel only once between user clicks, so a second Escape would close the dialog; the cancel event still covers a click outside. */
	stepBack = (node: HTMLElement) => {
		this.node = node;
		const dialog = node.closest("dialog");
		const step = (event: Event) => {
			if (event.defaultPrevented || this.current === null || innermost() !== this) return;
			event.preventDefault();
			this.close();
		};
		const key = (event: KeyboardEvent) => event.key === "Escape" && !event.isComposing && step(event);
		dialog?.addEventListener("keydown", key);
		dialog?.addEventListener("cancel", step);
		return () => {
			dialog?.removeEventListener("keydown", key);
			dialog?.removeEventListener("cancel", step);
			if (open.includes(this)) open.splice(open.indexOf(this), 1);
		};
	};
}
