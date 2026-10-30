import { browser } from "$app/env";
import { page } from "$app/state";
import { BookmarkStore } from "./bookmark-store.svelte.js";

export type { BookmarkStore } from "./bookmark-store.svelte.js";

// Keyed by the effective business user, so impersonating the realtor shows the realtor's bookmarks in this browser.
export const bookmarks = new BookmarkStore({
	user: () =>
		(page.data.identity as { effectiveUserId?: string } | null | undefined)?.effectiveUserId,
	storage: () => (browser ? localStorage : undefined),
	events: () => (browser ? window : undefined),
});
