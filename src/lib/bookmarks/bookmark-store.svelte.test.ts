import { describe, expect, it } from "vite-plus/test";
import { BookmarkStore, bookmarkKey } from "./bookmark-store.svelte.ts";

function setup(user: string | null = "business-realtor") {
	const saved = new Map<string, string>();
	const storage = {
		getItem: (key: string) => saved.get(key) ?? null,
		setItem: (key: string, value: string) => void saved.set(key, value),
	};
	const state = { user };
	const store = new BookmarkStore({
		user: () => state.user,
		storage: () => storage,
		events: () => new EventTarget(),
	});
	return { store, saved, state };
}

// Svelte resolves to its server build under Vitest, where effects never run; the browser suite covers syncing between tabs.
describe("bookmark store", () => {
	it("stays empty until hydrated so the server render and hydration agree", () => {
		const { store, saved } = setup();
		saved.set(bookmarkKey("business-realtor"), JSON.stringify(["a"]));
		expect(store.ids).toEqual([]);
		store.hydrate();
		expect(store.ids).toEqual(["a"]);
	});

	it("keeps the most recently added bookmark first without duplicates", () => {
		const { store, saved } = setup();
		store.hydrate();
		store.add("a");
		store.add("b");
		store.add("a");
		expect(store.ids).toEqual(["a", "b"]);
		expect(JSON.parse(saved.get(bookmarkKey("business-realtor"))!)).toEqual(["a", "b"]);
	});

	it("removes and toggles bookmarks", () => {
		const { store } = setup();
		store.hydrate();
		store.add("a");
		store.add("b");
		store.remove("a");
		expect(store.ids).toEqual(["b"]);
		expect(store.has("b")).toBe(true);
		expect(store.toggle("b")).toBe(false);
		expect(store.has("b")).toBe(false);
		expect(store.toggle("c")).toBe(true);
		expect(store.ids).toEqual(["c"]);
	});

	it("never overwrites saved bookmarks when added to before hydration", () => {
		const { store, saved } = setup();
		saved.set(bookmarkKey("business-realtor"), JSON.stringify(["a"]));
		store.add("b");
		store.hydrate();
		expect(store.ids).toEqual(["b", "a"]);
	});

	it("keeps each user's bookmarks separate", () => {
		const { store, state } = setup();
		store.hydrate();
		store.add("a");
		state.user = "business-assistant";
		store.add("b");
		expect(store.ids).toEqual(["b"]);
		state.user = "business-realtor";
		store.remove("missing");
		expect(store.ids).toEqual(["a"]);
	});

	it("ignores corrupt or foreign saved values", () => {
		const { store, saved } = setup();
		store.hydrate();
		saved.set(bookmarkKey("business-realtor"), "{not json");
		store.remove("none");
		expect(store.ids).toEqual([]);
		saved.set(bookmarkKey("business-realtor"), JSON.stringify(["a", 4, "", "a", null, "b"]));
		store.remove("none");
		expect(store.ids).toEqual(["a", "b"]);
	});

	it("does nothing without a known user", () => {
		const { store, saved } = setup(null);
		store.hydrate();
		store.add("a");
		expect(store.ids).toEqual([]);
		expect(saved.size).toBe(0);
	});
});
