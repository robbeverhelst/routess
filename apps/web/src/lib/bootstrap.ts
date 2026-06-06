import { hasStoredUser, notifyAuthStateChange, storeUser } from "@/lib/auth-state";
import { Logger } from "@/lib/logger";
import { checkVersionChange, getStoredVersionInfo } from "@/lib/version";

// Ad-hoc localStorage keys that have no per-key version or shape validator.
// On a build version bump these can carry forward a stale shape from a prior
// release and poison a fresh client (wrong "current" location from a cached
// fix, zoomToRoute fitting to a degenerate bounds, etc).
//
// The "user" auth key is deliberately NOT purged: the session cookie
// survives a deploy, so wiping it only forces a needless re-login.
// Stale user shape is handled by refreshStoredUser() instead.
//
// Zustand-persisted stores ("routess.*", "routess-redesign-ui", "maps-settings")
// have their own version + migrate and are deliberately excluded.
const VERSION_BUMPED_PURGE_KEYS = ["lastKnownLocation", "mapWaypoints"] as const;

// Older builds persisted the Bearer JWT in localStorage. Auth is cookie-only
// now, so any leftover token is a live credential sitting where XSS or
// third-party scripts can read it. Always remove it.
const LEGACY_ACCESS_TOKEN_KEY = "access_token";

function purgeLegacyAccessToken(): void {
	try {
		localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
	} catch (error) {
		Logger.warn("[bootstrap] Failed to remove legacy access token:", error);
	}
}

function purgeStaleAdHocKeys(): void {
	for (const key of VERSION_BUMPED_PURGE_KEYS) {
		try {
			localStorage.removeItem(key);
		} catch (error) {
			Logger.warn(`[bootstrap] Failed to remove ${key}:`, error);
		}
	}
}

// Re-fetch the profile so the stored user matches the new build's shape.
// A real 401 already clears auth state inside the ApiClient; transient
// failures keep the stored user so returning users aren't bounced to login.
async function refreshStoredUser(): Promise<void> {
	if (!hasStoredUser()) return;
	try {
		const { apiService } = await import("@/lib/api");
		const user = await apiService.getProfile();
		storeUser(user);
		notifyAuthStateChange();
	} catch (error) {
		Logger.warn("[bootstrap] Could not refresh stored user after version bump:", error);
	}
}

export function runBootstrap(): void {
	purgeLegacyAccessToken();

	const previousInfo = getStoredVersionInfo();
	const versionChanged = checkVersionChange();

	// Only purge when we've actually rolled forward from a known prior build.
	// First-ever boot (no stored info) leaves the user's existing data alone.
	if (versionChanged && previousInfo) {
		Logger.info(
			`[bootstrap] App version changed (${previousInfo.current} -> current); clearing unversioned client state`,
		);
		purgeStaleAdHocKeys();
		void refreshStoredUser();
	}
}
