import type { RouteActivity } from "../types";
import type { BikeType, HillPreference, RoutingPreferences, SurfaceType } from "./types";

export type ValhallaCostingModel = "bicycle" | "pedestrian";

export interface ValhallaBicycleOptions {
	bicycle_type: "Road" | "Hybrid" | "Cross" | "Mountain";
	use_hills: number;
	use_ferry: number;
	use_roads: number;
	use_tracks: number;
	avoid_bad_surfaces: number;
}

export interface ValhallaPedestrianOptions {
	use_hills: number;
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

const HILL_USE: Record<HillPreference, number> = {
	flat: 0.1,
	mixed: 0.5,
	hilly: 0.9,
};

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

const BIKE_TYPE_TO_VALHALLA: Record<BikeType, ValhallaBicycleOptions["bicycle_type"]> = {
	road: "Road",
	hybrid: "Hybrid",
	gravel: "Cross",
	mountain: "Mountain",
};

export function valhallaCostingFromPreferences(
	activity: RouteActivity,
	prefs: RoutingPreferences,
	options?: { walkingSpeedMps?: number },
): ValhallaCostingRequest {
	if (activity === "cycle") {
		const bikeType = prefs.bikeType ?? "hybrid";
		const bicycle: ValhallaBicycleOptions = {
			bicycle_type: BIKE_TYPE_TO_VALHALLA[bikeType],
			use_hills: HILL_USE[prefs.hillPreference],
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
		use_hills: HILL_USE[prefs.hillPreference],
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
