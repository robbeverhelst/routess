import type { Coordinate } from "../types";

// Navigation domain (CONTEXT.md "Navigation", ADR 0038): a NavigationSession
// follows a RoutePath (geometry, never Waypoints) using server-derived Cues.

export const NAV_CUE_KINDS = ["maneuver", "node", "followPath"] as const;
export type NavCueKind = (typeof NAV_CUE_KINDS)[number];

/** One guidance unit, anchored to a position along the RoutePath. */
export interface NavCue {
	kind: NavCueKind;
	/** Index into the stored RoutePath the cue is anchored to. */
	shapeIndex: number;
	distanceAlongMeters: number;
	/** Localized text, server-provided. Banner and voice speak it verbatim. */
	text: string;
	streetNames?: string[];
	/** Valhalla maneuver type, when kind is "maneuver". */
	maneuverType?: number;
	nodeRef?: string;
	nodeNextRef?: string;
}

export interface PositionFix {
	coord: Coordinate;
	timestampMs: number;
	speedMps?: number | null;
	headingDeg?: number | null;
	accuracyMeters?: number | null;
}

export const NAVIGATION_STATUSES = ["following", "offRoute", "rejoining", "ended"] as const;
export type NavigationStatus = (typeof NAVIGATION_STATUSES)[number];

/**
 * Device-local session state. JSON-serializable on purpose: the resume
 * snapshot persists it verbatim. Path geometry and cues live in the
 * NavigationContext, not here.
 */
export interface NavigationSessionState {
	status: NavigationStatus;
	/** Last on-route progress along the main RoutePath. */
	distanceAlongMeters: number;
	/** Last matched segment, used as the projection search hint. */
	segmentHint: number;
	/** Index of the next not-yet-passed cue. */
	nextCueIndex: number;
	/** Highest cue index announced at the "prepare" stage. */
	preparedCueIndex: number;
	/** Highest cue index announced at the "now" stage. */
	announcedCueIndex: number;
	offRouteSinceMs: number | null;
	rejoin: {
		path: Coordinate[];
		/** Where on the main path the connector lands. */
		targetDistanceAlongMeters: number;
		segmentHint: number;
		offConnectorSinceMs: number | null;
	} | null;
	/** True when the session ended by arrival rather than manual end. */
	arrived: boolean;
}

export type NavigationEffect =
	| { type: "announceCue"; cueIndex: number; stage: "prepare" | "now" }
	| { type: "offRoute" }
	| {
			type: "requestRejoin";
			from: Coordinate;
			target: Coordinate;
			targetDistanceAlongMeters: number;
	  }
	| { type: "backOnRoute" }
	| { type: "arrived" };

export interface NavigationConfig {
	offRouteDistanceMeters: number;
	offRouteDwellMs: number;
	onRouteDistanceMeters: number;
	/** Rejoin targets this far ahead of the last on-route position. */
	rejoinAheadMeters: number;
	arrivalMinProgress: number;
	arrivalDistanceMeters: number;
	/** A cue counts as passed this far beyond its anchor. */
	cuePassedToleranceMeters: number;
	prepareSecondsAhead: number;
	nowSecondsAhead: number;
	minPrepareMeters: number;
	maxPrepareMeters: number;
	minNowMeters: number;
	maxNowMeters: number;
	/** Used when the fix carries no speed. */
	fallbackSpeedMps: number;
}

export const NAV_DEFAULT_CONFIG: NavigationConfig = {
	offRouteDistanceMeters: 50,
	offRouteDwellMs: 10_000,
	onRouteDistanceMeters: 30,
	rejoinAheadMeters: 150,
	arrivalMinProgress: 0.95,
	arrivalDistanceMeters: 30,
	cuePassedToleranceMeters: 25,
	prepareSecondsAhead: 30,
	nowSecondsAhead: 8,
	minPrepareMeters: 150,
	maxPrepareMeters: 500,
	minNowMeters: 40,
	maxNowMeters: 120,
	fallbackSpeedMps: 4,
};
