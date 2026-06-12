import type { Coordinate } from "../types";
import { haversineDistance } from "../utils/geospatial";
import { buildPathIndex, type PathIndex, pointAtDistanceAlong, projectOntoPath } from "./path";
import {
	NAV_DEFAULT_CONFIG,
	type NavCue,
	type NavigationConfig,
	type NavigationEffect,
	type NavigationSessionState,
	type PositionFix,
} from "./types";

// The NavigationSession brain (ADR 0038): a pure reducer over position fixes.
// Hosts own the dirty edges (geolocation, speech, the rejoin API call) and
// consume the effects this emits. Everything here is testable with fabricated
// fixes; no clocks, no I/O.

export interface NavigationContext {
	main: PathIndex;
	cues: NavCue[];
	config: NavigationConfig;
}

export interface AdvanceResult {
	state: NavigationSessionState;
	effects: NavigationEffect[];
}

export function createNavigationContext(
	path: Coordinate[],
	cues: NavCue[],
	config: Partial<NavigationConfig> = {},
): NavigationContext {
	return { main: buildPathIndex(path), cues, config: { ...NAV_DEFAULT_CONFIG, ...config } };
}

export function startNavigationSession(): NavigationSessionState {
	return {
		status: "following",
		distanceAlongMeters: 0,
		segmentHint: 0,
		nextCueIndex: 0,
		preparedCueIndex: -1,
		announcedCueIndex: -1,
		offRouteSinceMs: null,
		rejoin: null,
		arrived: false,
	};
}

export function endNavigationSession(state: NavigationSessionState): NavigationSessionState {
	return { ...state, status: "ended" };
}

/** Where a Rejoin should land: ahead of the last on-route position, never behind. */
function rejoinTarget(ctx: NavigationContext, state: NavigationSessionState): { target: Coordinate; meters: number } {
	const meters = Math.min(ctx.main.totalMeters, state.distanceAlongMeters + ctx.config.rejoinAheadMeters);
	return { target: pointAtDistanceAlong(ctx.main, meters), meters };
}

/** Manual "reroute" button: skip the dwell and request a Rejoin immediately. */
export function forceRejoin(ctx: NavigationContext, state: NavigationSessionState, fix: PositionFix): AdvanceResult {
	if (state.status === "ended") return { state, effects: [] };
	const { target, meters } = rejoinTarget(ctx, state);
	return {
		state: { ...state, status: "offRoute", offRouteSinceMs: fix.timestampMs, rejoin: null },
		effects: [{ type: "requestRejoin", from: fix.coord, target, targetDistanceAlongMeters: meters }],
	};
}

/** The host resolved a Rejoin connector; start following it. */
export function applyRejoin(
	state: NavigationSessionState,
	connectorPath: Coordinate[],
	targetDistanceAlongMeters: number,
): NavigationSessionState {
	if (state.status === "ended" || connectorPath.length < 2) return state;
	return {
		...state,
		status: "rejoining",
		offRouteSinceMs: null,
		rejoin: { path: connectorPath, targetDistanceAlongMeters, segmentHint: 0, offConnectorSinceMs: null },
	};
}

/** Meters left to ride, including the connector when rejoining. */
export function remainingMeters(ctx: NavigationContext, state: NavigationSessionState, fix?: PositionFix): number {
	if (state.status === "rejoining" && state.rejoin) {
		const connector = buildPathIndex(state.rejoin.path);
		const onConnector = fix ? projectOntoPath(connector, fix.coord, state.rejoin.segmentHint) : null;
		const connectorRemaining = connector.totalMeters - (onConnector?.distanceAlongMeters ?? 0);
		return Math.max(0, connectorRemaining + ctx.main.totalMeters - state.rejoin.targetDistanceAlongMeters);
	}
	return Math.max(0, ctx.main.totalMeters - state.distanceAlongMeters);
}

function speedMps(ctx: NavigationContext, fix: PositionFix): number {
	return fix.speedMps != null && fix.speedMps > 0 ? fix.speedMps : ctx.config.fallbackSpeedMps;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function announceCues(
	ctx: NavigationContext,
	state: NavigationSessionState,
	fix: PositionFix,
	effects: NavigationEffect[],
): NavigationSessionState {
	const { config, cues } = ctx;
	let { nextCueIndex, preparedCueIndex, announcedCueIndex } = state;

	while (
		nextCueIndex < cues.length &&
		cues[nextCueIndex].distanceAlongMeters < state.distanceAlongMeters - config.cuePassedToleranceMeters
	) {
		nextCueIndex++;
	}

	if (nextCueIndex < cues.length) {
		const speed = speedMps(ctx, fix);
		const nowMeters = clamp(speed * config.nowSecondsAhead, config.minNowMeters, config.maxNowMeters);
		const prepareMeters = clamp(speed * config.prepareSecondsAhead, config.minPrepareMeters, config.maxPrepareMeters);
		const toCue = cues[nextCueIndex].distanceAlongMeters - state.distanceAlongMeters;
		if (toCue <= nowMeters && announcedCueIndex < nextCueIndex) {
			effects.push({ type: "announceCue", cueIndex: nextCueIndex, stage: "now" });
			announcedCueIndex = nextCueIndex;
			preparedCueIndex = Math.max(preparedCueIndex, nextCueIndex);
		} else if (toCue <= prepareMeters && preparedCueIndex < nextCueIndex) {
			effects.push({ type: "announceCue", cueIndex: nextCueIndex, stage: "prepare" });
			preparedCueIndex = nextCueIndex;
		}
	}

	return { ...state, nextCueIndex, preparedCueIndex, announcedCueIndex };
}

function checkArrival(
	ctx: NavigationContext,
	state: NavigationSessionState,
	fix: PositionFix,
	effects: NavigationEffect[],
): NavigationSessionState {
	const { main, config } = ctx;
	if (main.totalMeters <= 0 || main.path.length === 0) return state;
	// Progress-gated on purpose: on a loop the endpoint is the start point, so
	// proximity alone would end the session the moment it begins.
	const progress = state.distanceAlongMeters / main.totalMeters;
	if (progress < config.arrivalMinProgress) return state;
	const end = main.path[main.path.length - 1];
	if (haversineDistance(fix.coord, end) * 1000 > config.arrivalDistanceMeters) return state;
	effects.push({ type: "arrived" });
	return { ...state, status: "ended", arrived: true };
}

export function advanceNavigation(
	ctx: NavigationContext,
	state: NavigationSessionState,
	fix: PositionFix,
): AdvanceResult {
	if (state.status === "ended") return { state, effects: [] };
	const { config, main } = ctx;
	const effects: NavigationEffect[] = [];

	if (state.status === "rejoining" && state.rejoin) {
		const onMain = projectOntoPath(main, fix.coord, state.segmentHint);
		if (onMain.distanceFromPathMeters <= config.onRouteDistanceMeters) {
			effects.push({ type: "backOnRoute" });
			let next: NavigationSessionState = {
				...state,
				status: "following",
				rejoin: null,
				offRouteSinceMs: null,
				distanceAlongMeters: onMain.distanceAlongMeters,
				segmentHint: onMain.segmentIndex,
			};
			next = announceCues(ctx, next, fix, effects);
			next = checkArrival(ctx, next, fix, effects);
			return { state: next, effects };
		}

		const connector = buildPathIndex(state.rejoin.path);
		const onConnector = projectOntoPath(connector, fix.coord, state.rejoin.segmentHint);
		if (onConnector.distanceFromPathMeters <= config.offRouteDistanceMeters) {
			return {
				state: {
					...state,
					rejoin: { ...state.rejoin, segmentHint: onConnector.segmentIndex, offConnectorSinceMs: null },
				},
				effects,
			};
		}
		// Strayed from the connector too: dwell, then ask for a fresh one.
		const since = state.rejoin.offConnectorSinceMs ?? fix.timestampMs;
		if (fix.timestampMs - since >= config.offRouteDwellMs) {
			const { target, meters } = rejoinTarget(ctx, state);
			effects.push({ type: "requestRejoin", from: fix.coord, target, targetDistanceAlongMeters: meters });
			return {
				state: { ...state, status: "offRoute", rejoin: null, offRouteSinceMs: fix.timestampMs },
				effects,
			};
		}
		return {
			state: { ...state, rejoin: { ...state.rejoin, offConnectorSinceMs: since } },
			effects,
		};
	}

	const projection = projectOntoPath(main, fix.coord, state.segmentHint);

	if (projection.distanceFromPathMeters > config.offRouteDistanceMeters) {
		if (state.status === "offRoute") return { state, effects };
		const since = state.offRouteSinceMs ?? fix.timestampMs;
		if (fix.timestampMs - since >= config.offRouteDwellMs) {
			const { target, meters } = rejoinTarget(ctx, state);
			effects.push({ type: "offRoute" });
			effects.push({ type: "requestRejoin", from: fix.coord, target, targetDistanceAlongMeters: meters });
			return { state: { ...state, status: "offRoute", offRouteSinceMs: since }, effects };
		}
		return { state: { ...state, offRouteSinceMs: since }, effects };
	}

	if (state.status === "offRoute") effects.push({ type: "backOnRoute" });
	let next: NavigationSessionState = {
		...state,
		status: "following",
		offRouteSinceMs: null,
		distanceAlongMeters: projection.distanceAlongMeters,
		segmentHint: projection.segmentIndex,
	};
	next = announceCues(ctx, next, fix, effects);
	next = checkArrival(ctx, next, fix, effects);
	return { state: next, effects };
}
