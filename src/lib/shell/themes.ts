export const themes = [
	{ id: "pop", label: "Pop" },
	{ id: "cream", label: "Cream" },
	{ id: "evening", label: "Evening" },
	{ id: "sage", label: "Sage & clay" },
	{ id: "lilac", label: "Lilac" },
	{ id: "butter", label: "Butter" },
] as const;

export function chooseTheme(theme: (typeof themes)[number]["id"]) {
	document.documentElement.dataset.theme = theme;
	try {
		localStorage.setItem("meadow-theme", theme);
	} catch {
		/* The current view still changes when browser storage is unavailable. */
	}
}
