// Shared registry for live design variant sets. VariantPicker and variantSetting register on mount (client only, so server renders never touch this state) and VariantHost lists every live set in one shared bar.
import { onMount } from "svelte";

export interface VariantGroup {
	id: string;
	variants: string[];
	active: number;
	/** Toolbar label; defaults to the id. */
	label?: string;
	/** Buttons suit two or three short options; a select keeps longer lists compact. */
	display?: "buttons" | "select";
}

export type VariantDisplay = Pick<VariantGroup, "label" | "display">;

function storageKey(id: string) {
	return `variant-picker:${id}:index`;
}

function loadIndex(id: string, fallback: number, count: number): number {
	if (typeof sessionStorage === "undefined") return fallback;
	try {
		const saved = Number.parseInt(sessionStorage.getItem(storageKey(id)) ?? "", 10);
		if (Number.isInteger(saved) && saved >= 0 && saved < count) return saved;
	} catch {
		// Unavailable or corrupt storage keeps the fallback.
	}
	return fallback;
}

class VariantRegistry {
	sets = $state<VariantGroup[]>([]);
	hosts = $state(0);
	currentId = $state<string | null>(null);

	register(id: string, variants: string[], defaultIndex: number, display: VariantDisplay = {}) {
		const active = loadIndex(id, defaultIndex, variants.length);
		const existing = this.sets.findIndex((set) => set.id === id);
		if (existing >= 0) {
			console.warn(`[VariantPicker] duplicate id "${id}": the latest registration wins.`);
			this.sets[existing] = { id, variants, active, ...display };
		} else {
			this.sets.push({ id, variants, active, ...display });
		}
		if (this.currentId === null) this.currentId = id;
	}

	unregister(id: string) {
		this.sets = this.sets.filter((set) => set.id !== id);
		if (this.currentId === id) this.currentId = this.sets[0]?.id ?? null;
	}

	select(id: string, index: number) {
		const set = this.sets.find((entry) => entry.id === id);
		if (!set || index < 0 || index >= set.variants.length) return;
		set.active = index;
		this.currentId = id;
		if (typeof sessionStorage === "undefined") return;
		try {
			sessionStorage.setItem(storageKey(id), String(index));
		} catch {
			// Persistence is a convenience; the selection still applies.
		}
	}
}

export const variantRegistry = new VariantRegistry();

/** Registers a variant set for the calling component's lifetime and reads its active option, for settings that restyle a whole page rather than one rendered child. Call during component initialisation. */
export function variantSetting<const T extends readonly string[]>(
	id: string,
	variants: T,
	{ defaultIndex = 0, ...display }: VariantDisplay & { defaultIndex?: number } = {},
) {
	onMount(() => {
		variantRegistry.register(id, [...variants], defaultIndex, display);
		return () => variantRegistry.unregister(id);
	});
	return {
		get value(): T[number] {
			const index = variantRegistry.sets.find((set) => set.id === id)?.active ?? defaultIndex;
			return variants[index] ?? variants[defaultIndex]!;
		},
	};
}

// Number keys target the last-touched set (defaulting to the first registered), so multiple live sets never fight over keystrokes.
export function handleVariantKeys(event: KeyboardEvent) {
	if (event.metaKey || event.ctrlKey || event.altKey) return;
	const target = event.target as HTMLElement | null;
	if (!target) return;
	if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
	const num = Number.parseInt(event.key, 10);
	if (!Number.isInteger(num)) return;
	const set =
		variantRegistry.sets.find((entry) => entry.id === variantRegistry.currentId) ??
		variantRegistry.sets[0];
	if (!set || num < 1 || num > set.variants.length) return;
	variantRegistry.select(set.id, num - 1);
}
