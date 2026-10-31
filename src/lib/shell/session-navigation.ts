export const identityChangeKey = "meadow:identity-change";
export const loginEntryKey = "meadow:login-entry";

/** Ends an impersonation session and returns to the support admin's user choice. Resolves false when the server refuses, so the caller can say so. */
export async function exitImpersonation() {
	try {
		const response = await fetch("/api/support/exit", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{}",
		});
		if (!response.ok) return false;
	} catch {
		return false;
	}
	replaceSession("/support");
	return true;
}

export function replaceSession(destination: string) {
	try {
		localStorage.setItem(identityChangeKey, crypto.randomUUID());
	} catch {
		/* Navigation still clears this document's caches when storage is unavailable. */
	}
	window.location.replace(destination);
}

/**
 * Marks the next document as a login entrance so the dashboard plays the coordinated login entry motion instead of a plain load. Kept in sessionStorage so it survives the full navigation but never leaves the tab; the dashboard consumes and clears it on mount, so a reload or identity-change refresh never replays the entrance or flashes stale cross-account data.
 */
export function markLoginEntry(destination: string) {
	try {
		sessionStorage.setItem(loginEntryKey, destination);
	} catch {
		/* Without storage the dashboard simply plays its normal load motion. */
	}
}
