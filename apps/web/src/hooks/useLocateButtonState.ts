import { useEffect, useState } from "react";
import { locationService } from "@/services/LocationService";

export type LocateUnavailableReason = "denied" | "unsupported" | null;

export interface LocateButtonState {
	// A manual locate request is in flight (show a spinner).
	isLocating: boolean;
	// Why the button is inactive, or null when it can be used.
	unavailable: LocateUnavailableReason;
}

function computeState(): LocateButtonState {
	const state = locationService.getState();
	if (!("geolocation" in navigator)) {
		return { isLocating: false, unavailable: "unsupported" };
	}
	// With a last-known (or current) location we can still recentre even when
	// permission is blocked, so only disable when there's nothing to fall back to.
	const hasFallback = locationService.hasLastKnownLocation() || state.location !== null;
	const unavailable = state.permissionState === "denied" && !hasFallback ? "denied" : null;
	return { isLocating: state.manualLocating, unavailable };
}

// Read-only view of the locate button's state, driven by the LocationService
// singleton so it works outside the UserLocationProvider subtree (the toolbar
// lives in AppShell).
export function useLocateButtonState(): LocateButtonState {
	const [state, setState] = useState<LocateButtonState>(computeState);

	useEffect(() => {
		const sync = () => setState(computeState());
		const unsubscribe = locationService.subscribe({
			onLocationUpdate: sync,
			onError: sync,
			onPermissionChange: sync,
		});
		sync();
		return unsubscribe;
	}, []);

	return state;
}
