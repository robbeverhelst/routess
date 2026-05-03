import type { Coordinate } from "@routess/core";

export interface ElevationProvider {
	// Resolve elevation in meters for each input coordinate. Implementations
	// must preserve order and return one value per input. Return null for
	// points that could not be sampled (e.g., over ocean tiles); callers
	// will interpolate or drop them.
	sample(points: Coordinate[], signal?: AbortSignal): Promise<(number | null)[]>;
}

export interface ProfilePoint {
	// Cumulative distance along the route in meters.
	distanceMeters: number;
	// Smoothed elevation in meters above sea level.
	elevationMeters: number;
}

export interface ElevationResult {
	gainMeters: number;
	lossMeters: number;
	profile: ProfilePoint[];
}
