import { Logger } from "@/lib/logger";
import { checkVersionChange, getStoredVersionInfo } from "@/lib/version";

// Ad-hoc localStorage keys that have no per-key version or shape validator.
// On a build version bump these can carry forward a stale shape from a prior
// release and poison a fresh client (auth bounce-back, wrong "current" location
// from a cached fix, zoomToRoute fitting to a degenerate bounds, etc).
//
// Zustand-persisted stores ("routess.*", "routess-redesign-ui", "maps-settings")
// have their own version + migrate and are deliberately excluded.
const VERSION_BUMPED_PURGE_KEYS = ["access_token", "user", "lastKnownLocation", "mapWaypoints"] as const;

function purgeStaleAdHocKeys(): void {
	for (const key of VERSION_BUMPED_PURGE_KEYS) {
		try {
			localStorage.removeItem(key);
		} catch (error) {
			Logger.warn(`[bootstrap] Failed to remove ${key}:`, error);
		}
	}
}

export function runBootstrap(): void {
	const previousInfo = getStoredVersionInfo();
	const versionChanged = checkVersionChange();

	// Only purge when we've actually rolled forward from a known prior build.
	// First-ever boot (no stored info) leaves the user's existing data alone.
	if (versionChanged && previousInfo) {
		Logger.info(
			`[bootstrap] App version changed (${previousInfo.current} -> current); clearing unversioned client state`,
		);
		purgeStaleAdHocKeys();
	}
}
