import type { RoutingPreferences, SurfaceBucket } from "../routing/types";
import type { Coordinate, RouteActivity } from "../types";

// RouteGeneration vocabulary (see CONTEXT.md and ADR-0029). The pipeline is
// staged — anchors → candidates → routing → scoring → selection — and every
// stage in this package is a pure function; the API module owns the Valhalla
// calls and feeds the results back in.

export const HEADINGS = ["any", "north", "east", "south", "west"] as const;
export type Heading = (typeof HEADINGS)[number];

export function isHeading(value: unknown): value is Heading {
	return HEADINGS.includes(value as Heading);
}

export interface GenerationRequest {
	start: Coordinate;
	activity: RouteActivity;
	targetDistanceKm: number;
	heading: Heading;
	preferences: RoutingPreferences;
	/** Bearings already shown to the user; regenerate excludes them. */
	excludeBearings?: number[];
}

export const GENERATION_FAILURE_CODES = [
	"invalid_input",
	"start_not_routable",
	"no_candidates_routable",
	"all_candidates_low_quality",
	"all_bearings_excluded",
	"provider_unavailable",
] as const;
export type GenerationFailureCode = (typeof GENERATION_FAILURE_CODES)[number];

/** A candidate before routing: the via points the fan placed for one bearing. */
export interface CandidatePlan {
	bearingDeg: number;
	/** Via points only — the loop is start → vias… → start. */
	viaPoints: Coordinate[];
}

/** One edge of a map-matched RoutePath, in path order. */
export interface CandidateEdge {
	wayId?: number;
	lengthKm: number;
	surface?: string;
	/** Travel direction at the edge ends; lets overlap detect U-turns within one way. */
	beginHeadingDeg?: number;
	endHeadingDeg?: number;
}

/** A candidate after routing + map matching, before scoring. */
export interface RoutedCandidate {
	plan: CandidatePlan;
	geometry: Coordinate[];
	distanceKm: number;
	durationSeconds: number;
	edges: CandidateEdge[];
}

export interface CandidateScore {
	/** Weighted total, 0..1, higher is better. */
	total: number;
	/** Raw Overlap: fraction of distance traversing the same way more than once. */
	overlap: number;
	distanceMatch: number;
	surfaceFit: number;
	shapeCompactness: number;
}

/** A GenerationCandidate: scored, gate-checked, ready for selection. */
export interface ScoredCandidate extends RoutedCandidate {
	score: CandidateScore;
	metersByBucket: Record<SurfaceBucket, number>;
	/** Above the warn threshold but below the hard floor: shown with a badge. */
	lowQuality: boolean;
}
