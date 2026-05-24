import type { RouteActivity } from "../types";
import type { RoutingPreferences, SurfaceType } from "./types";

export type ValhallaCostingModel = "bicycle" | "pedestrian";

export interface ValhallaBicycleOptions {
	use_ferry: number;
	use_roads: number;
	use_tracks: number;
	avoid_bad_surfaces: number;
}

export interface ValhallaPedestrianOptions {
	use_ferry: number;
	use_tracks: number;
	walking_speed?: number;
}

export interface ValhallaCostingRequest {
	costing: ValhallaCostingModel;
	costing_options: { bicycle: ValhallaBicycleOptions } | { pedestrian: ValhallaPedestrianOptions };
}

export function valhallaCostingModelForActivity(activity: RouteActivity): ValhallaCostingModel {
	return activity === "cycle" ? "bicycle" : "pedestrian";
}

// HillPreference + use_hills were removed from the vocabulary because the
// effect in practice was imperceptible across most road networks we tested.
// Valhalla's hill penalty is small relative to distance, so even with the
// full 0..1 spread the engine still preferred the shorter route over any
// detour to skip a moderate climb. Revisit if we ever add explicit elevation
// routing (e.g. via a custom Valhalla profile or a different engine):
//   - Add HillPreference back to RoutingPreferences (flat | mixed | hilly).
//   - Map to use_hills: { flat: 0.0, mixed: 0.5, hilly: 1.0 }.
//   - Send it on both `bicycle` and `pedestrian` costing.
//   - Restore the UI segmented control in RoutingModal.tsx.

const SURFACE_USE_TRACKS_BIKE: Record<SurfaceType, number> = {
	paved: 0.0,
	mixed: 0.3,
	unpaved: 0.8,
};

const SURFACE_AVOID_BAD_BIKE: Record<SurfaceType, number> = {
	paved: 1.0,
	mixed: 0.25,
	unpaved: 0.0,
};

const SURFACE_USE_TRACKS_PED: Record<SurfaceType, number> = {
	paved: 0.0,
	mixed: 0.5,
	unpaved: 1.0,
};

export function valhallaCostingFromPreferences(
	activity: RouteActivity,
	prefs: RoutingPreferences,
	options?: { walkingSpeedMps?: number },
): ValhallaCostingRequest {
	if (activity === "cycle") {
		// Valhalla defaults bicycle_type to Hybrid when omitted; that's fine for
		// our small vocabulary which doesn't model bike type.
		const bicycle: ValhallaBicycleOptions = {
			use_ferry: prefs.avoidFerries ? 0.0 : 0.5,
			use_roads: prefs.avoidHighways ? 0.2 : 0.5,
			use_tracks: SURFACE_USE_TRACKS_BIKE[prefs.surfacePreference],
			avoid_bad_surfaces: SURFACE_AVOID_BAD_BIKE[prefs.surfacePreference],
		};
		return {
			costing: "bicycle",
			costing_options: { bicycle },
		};
	}

	const pedestrian: ValhallaPedestrianOptions = {
		use_ferry: prefs.avoidFerries ? 0.0 : 0.5,
		use_tracks: SURFACE_USE_TRACKS_PED[prefs.surfacePreference],
	};
	if (typeof options?.walkingSpeedMps === "number" && options.walkingSpeedMps > 0) {
		pedestrian.walking_speed = options.walkingSpeedMps;
	}
	return {
		costing: "pedestrian",
		costing_options: { pedestrian },
	};
}
