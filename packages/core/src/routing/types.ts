import type { RouteActivity } from "../types";

export const SURFACE_TYPES = ["paved", "mixed", "unpaved"] as const;
export type SurfaceType = (typeof SURFACE_TYPES)[number];

export const SURFACE_BUCKETS = ["paved", "compacted", "unpaved", "path"] as const;
export type SurfaceBucket = (typeof SURFACE_BUCKETS)[number];

export const PROVENANCES = ["valhalla", "mapbox-legacy", "gpx-import", "generation", "external-fork"] as const;
export type Provenance = (typeof PROVENANCES)[number];

export interface RoutingPreferences {
	surfacePreference: SurfaceType;
	avoidFerries: boolean;
	avoidHighways: boolean;
}

export type RoutingDefaults = Record<RouteActivity, RoutingPreferences>;

export function isSurfaceType(value: unknown): value is SurfaceType {
	return SURFACE_TYPES.includes(value as SurfaceType);
}

export function isSurfaceBucket(value: unknown): value is SurfaceBucket {
	return SURFACE_BUCKETS.includes(value as SurfaceBucket);
}

export function isProvenance(value: unknown): value is Provenance {
	return PROVENANCES.includes(value as Provenance);
}
