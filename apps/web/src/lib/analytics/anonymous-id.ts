// Per-device pseudonymous id for ProductEvents (ADR-0020). Random, never
// derived from anything about the person, and minted only once analytics is
// allowed. Signed-in events carry it next to user_id_hash, which is what links
// a device's anonymous history to the account it later signs up as.

const ANONYMOUS_ID_KEY = "routess.anon_id";

export function getAnonymousId(): string | null {
	try {
		const existing = localStorage.getItem(ANONYMOUS_ID_KEY);
		if (existing) return existing;
		const id = crypto.randomUUID();
		localStorage.setItem(ANONYMOUS_ID_KEY, id);
		return id;
	} catch {
		return null;
	}
}

// Called on opt-out (stop identifying the device) and on sign-out (so the
// next person on a shared device is not linked to the previous account).
export function resetAnonymousId(): void {
	try {
		localStorage.removeItem(ANONYMOUS_ID_KEY);
	} catch {
		// Storage unavailable means there is nothing stored to remove.
	}
}
