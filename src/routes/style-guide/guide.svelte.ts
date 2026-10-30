// Sections of the development-only style guide. The root layout swaps them into the rail while /style-guide is open, so the rail and the page share this state.
import { tick } from "svelte";
import { replaceState } from "$app/navigation";
import {
	AppWindow,
	ClipboardList,
	CircleCheck,
	Layers,
	LayoutGrid,
	MessageSquareText,
	MousePointerClick,
	Palette,
	Tags,
	TextCursorInput,
	Type,
} from "@lucide/svelte";

export const guideSections = [
	{
		id: "foundations",
		label: "Foundations",
		note: "Production themes, semantic tokens and typography",
		icon: Palette,
	},
	{ id: "surfaces", label: "Surfaces", note: "Layering, elevation and corner radii", icon: Layers },
	{
		id: "buttons",
		label: "Buttons",
		note: "Every kind in every state, plus menus and tabs",
		icon: MousePointerClick,
	},
	{
		id: "fields",
		label: "Fields",
		note: "Text, select, date and pill selects",
		icon: TextCursorInput,
	},
	{
		id: "choices",
		label: "Choices",
		note: "Round checks, radios and segmented choices",
		icon: CircleCheck,
	},
	{ id: "chips", label: "Chips", note: "Stage, type, due, tag and client chips", icon: Tags },
	{
		id: "overlays",
		label: "Overlays",
		note: "Menus, context actions and previews",
		icon: AppWindow,
	},
	{
		id: "patterns",
		label: "Patterns",
		note: "Cards, opportunity compositions, forms and feedback",
		icon: LayoutGrid,
	},
] as const;
export type GuideSectionId = (typeof guideSections)[number]["id"];

const storageKey = "style-guide-collapsed";

class Guide {
	active = $state<GuideSectionId>(guideSections[0].id);
	collapsed = $state<GuideSectionId[]>([]);

	isOpen(id: GuideSectionId) {
		return !this.collapsed.includes(id);
	}
	setOpen(id: GuideSectionId, open: boolean) {
		if (open === this.isOpen(id)) return;
		this.collapsed = open ? this.collapsed.filter((entry) => entry !== id) : [...this.collapsed, id];
		this.#save();
	}
	setAll(open: boolean) {
		this.collapsed = open ? [] : guideSections.map((section) => section.id);
		this.#save();
	}
	restore() {
		try {
			const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]") as string[];
			this.collapsed = guideSections.map((section) => section.id).filter((id) => saved.includes(id));
		} catch {
			// Unavailable storage just starts with every section open.
		}
	}
	// Opens a section before scrolling to it, so a rail link never lands on a collapsed header.
	async reveal(id: GuideSectionId) {
		this.setOpen(id, true);
		this.active = id;
		await tick();
		const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
		document
			.getElementById(id)
			?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
		replaceState(`#${id}`, {});
	}
	#save() {
		try {
			sessionStorage.setItem(storageKey, JSON.stringify(this.collapsed));
		} catch {
			// Nonfatal: the choice just does not survive a refresh.
		}
	}
}

export const guide = new Guide();
