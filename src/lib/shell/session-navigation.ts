export const identityChangeKey = "meadow:identity-change";

export function replaceSession(destination: string) {
	try {
		localStorage.setItem(identityChangeKey, crypto.randomUUID());
	} catch {
		/* Navigation still clears this document's caches when storage is unavailable. */
	}
	window.location.replace(destination);
}
