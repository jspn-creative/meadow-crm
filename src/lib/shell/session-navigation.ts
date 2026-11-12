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
	replaceSession("/login");
	return true;
}

export function notifyIdentityChange() {
	try {
		localStorage.setItem(identityChangeKey, crypto.randomUUID());
	} catch {
		/* Navigation still clears this document's caches when storage is unavailable. */
	}
}

export function replaceSession(destination: string) {
	// Keep the outgoing authorization on this document; the destination consumes sessionStorage before its first paint.
	document.documentElement.dataset.sessionDestination = destination;
	markLoginEntry(destination);
	notifyIdentityChange();
	window.location.replace(destination);
}

/**
 * Marks an explicit identity navigation, including returning to the support admin's choice. app.html consumes it before first paint; reloads and unrelated navigations never replay it.
 */
export function markLoginEntry(destination: string) {
	try {
		sessionStorage.setItem(loginEntryKey, destination);
	} catch {
		/* Without storage the dashboard simply plays its normal load motion. */
	}
}
