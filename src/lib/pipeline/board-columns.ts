import { stageLabels } from "./labels.js";

type Stage = keyof typeof stageLabels;
export type CollapsedStages = Partial<Record<Stage, boolean>>;

// Collapsed stages last for the browser session, so a new session recomputes the default once.
export const collapsedStagesKey = "meadow:pipeline:collapsed-stages";

/**
 * The default for a new session: collapse columns from the rightmost until every column fits the board without scrolling, always keeping the leftmost expanded. The sizes mirror the column and rail widths in `BoardColumn.svelte`.
 *
 * Self-contained on purpose: the inline board script serializes it, so it must not reference anything outside its own body.
 */
export function fitCollapsedStages(width: number, rem: number, count: number): boolean[] {
	const column = 17 * rem;
	const rail = 3 * rem;
	const gap = 0.75 * rem;
	const collapsed: boolean[] = Array.from({ length: count }, () => false);
	let used = count * column + (count - 1) * gap;
	for (let index = count - 1; index > 0 && used > width; index--) {
		collapsed[index] = true;
		used -= column - rail;
	}
	return collapsed;
}

export function readCollapsedStages(): CollapsedStages | null {
	try {
		const value = JSON.parse(sessionStorage.getItem(collapsedStagesKey) ?? "null");
		return value && typeof value === "object" ? (value as CollapsedStages) : null;
	} catch {
		return null;
	}
}

export function storeCollapsedStages(value: CollapsedStages) {
	try {
		sessionStorage.setItem(collapsedStagesKey, JSON.stringify(value));
	} catch {
		// Storage can be unavailable (private modes, quotas); collapsing still works for this view.
	}
}

/** Measures a rendered board row and returns the new-session default for its stage columns. */
export function measureCollapsedStages(
	row: HTMLElement,
	stages: readonly Stage[],
): CollapsedStages {
	const style = getComputedStyle(row);
	const width =
		(row.parentElement?.clientWidth ?? row.clientWidth) -
		parseFloat(style.paddingLeft) -
		parseFloat(style.paddingRight);
	const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
	const fit = fitCollapsedStages(width, rem, stages.length);
	return Object.fromEntries(stages.map((stage, index) => [stage, fit[index]!]));
}

/**
 * Runs inline right after the server-rendered board, before first paint and hydration, so a reload never flashes columns that the session keeps collapsed. It applies the stored state or computes and stores the new-session default; the component then reads the same stored value when it hydrates.
 */
export const collapsedStagesScript =
	`<script>(() => {
	try {
		const row = document.currentScript.previousElementSibling.firstElementChild;
		const columns = [...row.querySelectorAll(":scope > [data-stage]")];
		let state = JSON.parse(sessionStorage.getItem(${JSON.stringify(collapsedStagesKey)}) || "null");
		if (!state || typeof state !== "object") {
			const style = getComputedStyle(row);
			const width = row.parentElement.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
			const fit = (${fitCollapsedStages.toString()})(width, parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, columns.length);
			state = Object.fromEntries(columns.map((column, index) => [column.dataset.stage, fit[index]]));
			sessionStorage.setItem(${JSON.stringify(collapsedStagesKey)}, JSON.stringify(state));
		}
		for (const column of columns) {
			const collapsed = !!state[column.dataset.stage];
			column.dataset.collapsed = String(collapsed);
			column.querySelector("[data-stage-body]").inert = collapsed;
			column.querySelector("[data-stage-rail]").inert = !collapsed;
		}
	} catch {}
})();</` + `script>`;
