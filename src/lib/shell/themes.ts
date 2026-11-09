export const themes = [
	{ id: "pop", label: "Pop" },
	{ id: "cream", label: "Cream" },
	{ id: "evening", label: "Evening" },
	{ id: "sage", label: "Sage & clay" },
	{ id: "lilac", label: "Lilac" },
	{ id: "butter", label: "Butter" },
] as const;

// app.html loads every font's faces in one stylesheet; the browser downloads only the faces in use.
export const fonts = [
	{
		id: "bricolage",
		label: "Bricolage",
		display: "Bricolage Grotesque",
		body: "Bricolage Grotesque",
	},
	{ id: "fraunces", label: "Fraunces", display: "Fraunces", body: "Figtree" },
	{ id: "young-serif", label: "Young Serif", display: "Young Serif", body: "Work Sans" },
] as const;

export type ThemeId = (typeof themes)[number]["id"];
export type FontId = (typeof fonts)[number]["id"];
type Setting = "theme" | "font";
type Origin = { x: number; y: number };

const keys = { theme: "meadow-theme", font: "meadow-font" } as const;

/** Where the next theme reveal grows from. Previews set it to the pointer or the focused row; ending a preview reuses the last one. */
let origin: Origin | undefined;

/** Applies a theme or font to the whole app in a view transition: a theme grows from `origin` as a circle, and a font crossfades so its reflow does not jump. A new change mid-transition skips the running one and continues from wherever it had reached. */
function apply(setting: Setting, value: string, previewing: boolean) {
	const root = document.documentElement;
	// The flag changes with the value, so observers never read a previewed value as saved.
	const update = () => {
		if (previewing) root.dataset[`${setting}Preview`] = "";
		else delete root.dataset[`${setting}Preview`];
		root.dataset[setting] = value;
	};
	if (root.dataset[setting] === value) return update();
	if (
		!("types" in (globalThis.ViewTransition?.prototype ?? {})) ||
		matchMedia("(prefers-reduced-motion: reduce)").matches
	)
		return update();
	const { x, y } = origin ?? { x: innerWidth / 2, y: innerHeight / 2 };
	root.style.setProperty("--reveal-x", `${x}px`);
	root.style.setProperty("--reveal-y", `${y}px`);
	root.style.setProperty(
		"--reveal-radius",
		`${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`,
	);
	document.startViewTransition({ update, types: [setting] });
}

/** Draws the whole app in a theme or font without saving it. Observers skip changes while the matching preview flag (data-theme-preview or data-font-preview) is set. */
export function preview(setting: Setting, value: string, from?: Origin) {
	if (from) origin = from;
	apply(setting, value, true);
}

export function endPreview(setting: Setting, value: string, from?: Origin) {
	if (from) origin = from;
	apply(setting, value, false);
}

function choose(setting: Setting, value: string) {
	endPreview(setting, value);
	try {
		localStorage.setItem(keys[setting], value);
	} catch {
		/* The current view still changes when browser storage is unavailable. */
	}
}

export function chooseTheme(theme: ThemeId) {
	choose("theme", theme);
}

export function chooseFont(font: FontId) {
	choose("font", font);
}
