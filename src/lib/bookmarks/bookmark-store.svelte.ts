import { createSubscriber } from "svelte/reactivity";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export interface BookmarkStoreOptions {
	/** The signed-in business user whose bookmarks these are; null while unknown. */
	user: () => string | null | undefined;
	storage: () => StorageLike | undefined;
	/** Where other tabs announce their writes, usually `window`. */
	events: () => EventTarget | undefined;
}

export function bookmarkKey(user: string) {
	return `meadow:bookmarks:${user}`;
}

function parse(value: string | null): string[] {
	if (!value) return [];
	try {
		const parsed: unknown = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		return [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))];
	} catch {
		return [];
	}
}

// Bookmarks belong to one user in one browser, so they live in that browser's storage rather than in shared records.
export class BookmarkStore {
	#options: BookmarkStoreOptions;
	#version = $state(0);
	#hydrated = $state(false);
	#subscribe: () => void;
	#ids = $derived.by(() => {
		void this.#version;
		return this.#hydrated ? this.#read() : [];
	});

	constructor(options: BookmarkStoreOptions) {
		this.#options = options;
		// Another tab's write arrives as a storage event; a null key means that tab cleared all storage.
		this.#subscribe = createSubscriber(() => {
			const target = this.#options.events();
			if (!target) return;
			const changed = (event: Event) => {
				const { key } = event as StorageEvent;
				if (key === null || key === this.#key() || key === `${this.#key()}:notes`) this.#version += 1;
			};
			target.addEventListener("storage", changed);
			return () => target.removeEventListener("storage", changed);
		});
	}

	#key() {
		const user = this.#options.user();
		return user ? bookmarkKey(user) : null;
	}

	#read() {
		const key = this.#key();
		if (!key) return [];
		try {
			return parse(this.#options.storage()?.getItem(key) ?? null);
		} catch {
			return [];
		}
	}

	#write(next: string[]) {
		const key = this.#key();
		const storage = this.#options.storage();
		if (!key || !storage) return;
		try {
			storage.setItem(key, JSON.stringify(next));
		} catch {
			// Storage can be full or blocked; the bookmark simply is not kept.
		}
		this.#version += 1;
	}

	/** Bookmarked opportunity ids, most recently added first. Empty until hydrated. */
	get ids(): readonly string[] {
		this.#subscribe();
		return this.#ids;
	}

	get hydrated() {
		return this.#hydrated;
	}

	/** Starts reading saved bookmarks. Call once mounted, so the server render and hydration agree on an empty list. */
	hydrate() {
		this.#hydrated = true;
	}

	has(id: string) {
		return this.ids.includes(id);
	}

	add(id: string) {
		this.#write([id, ...this.#read().filter((saved) => saved !== id)]);
	}

	remove(id: string) {
		this.#write(this.#read().filter((saved) => saved !== id));
		this.setNote(id, "");
	}

	note(id: string): string {
		this.#subscribe();
		void this.#version;
		const key = this.#key();
		if (!key) return "";
		try {
			const notes: unknown = JSON.parse(this.#options.storage()?.getItem(`${key}:notes`) ?? "{}");
			if (!notes || typeof notes !== "object" || Array.isArray(notes)) return "";
			const value = (notes as Record<string, unknown>)[id];
			return typeof value === "string" ? value : "";
		} catch {
			return "";
		}
	}

	setNote(id: string, value: string) {
		const key = this.#key();
		const storage = this.#options.storage();
		if (!key || !storage) return;
		try {
			const parsed: unknown = JSON.parse(storage.getItem(`${key}:notes`) ?? "{}");
			const notes: Record<string, unknown> =
				parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { ...parsed } : {};
			if (value.trim()) notes[id] = value.trim();
			else delete notes[id];
			storage.setItem(`${key}:notes`, JSON.stringify(notes));
			this.#version += 1;
		} catch {
			// Storage can be blocked or full; leave the saved note unchanged.
		}
	}

	/** Adds or removes the bookmark and returns whether the opportunity is bookmarked afterwards. */
	toggle(id: string) {
		const bookmarked = this.#read().includes(id);
		if (bookmarked) this.remove(id);
		else this.add(id);
		return !bookmarked;
	}
}
