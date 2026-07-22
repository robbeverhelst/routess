import type { Coordinate, RouteActivity, RoutingPreferences, Waypoint } from "@routess/core";
import { calculatePathDistance, defaultPreferencesForActivity, haversineDistance } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import { Logger } from "@/lib/logger";
import serviceWorkerManager from "@/lib/serviceWorker";
import { getSpeedForActivity, useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useRoutingStore } from "@/stores/routingStore";
import { useUiStore } from "@/stores/uiStore";
import { getDefaultElevationService } from "./elevation";
import { type ComputeRouteOptions, computeRoute } from "./valhallaClient";

const sameCoord = (a: Coordinate, b: Coordinate) => a[0] === b[0] && a[1] === b[1];

let elevationAbort: AbortController | null = null;

const samePath = (a: Coordinate[], b: Coordinate[]): boolean => {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (!sameCoord(a[i], b[i])) return false;
	}
	return true;
};

// Also used when a route loads with stored geometry (no Valhalla recompute),
// so the elevation profile still gets sampled for the exact path.
export const computeElevationInBackground = (routePath: Coordinate[], accessToken: string): void => {
	if (!accessToken || routePath.length < 2) {
		useRoutingStore.getState().clearElevation();
		useRoutingStore.getState().setIsComputingElevation(false);
		return;
	}

	elevationAbort?.abort();
	const controller = new AbortController();
	elevationAbort = controller;

	useRoutingStore.getState().setIsComputingElevation(true);

	// Elevation is computed for a specific RoutePath. The staleness check
	// compares against routePath in the store, not waypoints — waypoints
	// can mutate via snap-writeback after computeRoute returns without
	// invalidating the elevation result we computed for this exact path.
	getDefaultElevationService(accessToken)
		.sampleAndCompute(routePath, { signal: controller.signal })
		.then((result) => {
			if (controller.signal.aborted) return;
			if (!samePath(useRoutingStore.getState().routePath, routePath)) {
				Logger.info("[RCS/elevation] RoutePath changed during sampling; discarding stale elevation.");
				return;
			}
			useRoutingStore.getState().setElevation(result);
		})
		.catch((err) => {
			if (controller.signal.aborted) return;
			Logger.warn("[RCS/elevation] Failed to sample elevation:", err);
			useRoutingStore.getState().clearElevation();
		})
		.finally(() => {
			if (elevationAbort === controller) elevationAbort = null;
			if (!controller.signal.aborted) useRoutingStore.getState().setIsComputingElevation(false);
		});
};

// Reads the prefs that should drive this route's computation: prefer the
// draft's own routingPreferences (per ADR-0023); fall back to the user's
// per-Activity defaults; final fallback is the activity's built-in default.
function resolvePreferencesForDraft(activity: RouteActivity): RoutingPreferences {
	const draftPrefs = useRoutingStore.getState().routingPreferences;
	if (draftPrefs) return draftPrefs;
	const userDefaults = useRedesignSettingsStore.getState().routingDefaults;
	return userDefaults?.[activity] ?? defaultPreferencesForActivity(activity);
}

function buildComputeOptions(activity: RouteActivity): {
	prefs: RoutingPreferences;
	options: ComputeRouteOptions;
} {
	const settings = useRedesignSettingsStore.getState();
	const speedKmh = getSpeedForActivity(activity, settings.sportSpeeds);
	const prefs = resolvePreferencesForDraft(activity);
	// Valhalla's pedestrian costing accepts walking_speed in km/h (default
	// 5.1 km/h), matching how users configure it in settings.
	const walkingSpeedKmh = activity !== "cycle" ? speedKmh : undefined;
	return {
		prefs,
		options: {
			snap: settings.autoSnap,
			speedKmh,
			walkingSpeedKmh,
		},
	};
}

const sameWaypoint = (a: Waypoint, b: Waypoint) => sameCoord(a.coord, b.coord) && a.type === b.type;

const routeInputsMatch = (waypoints: Waypoint[]): boolean => {
	const state = useRoutingStore.getState();
	return (
		state.waypoints.length === waypoints.length && state.waypoints.every((wp, i) => sameWaypoint(wp, waypoints[i]))
	);
};

const staleRouteResult = (): RouteResult => ({
	success: true,
	waypointsSnapped: false,
	error: "Route inputs changed during calculation.",
});

export interface RouteResult {
	success: boolean;
	waypointsSnapped: boolean;
	snappedWaypoints?: Waypoint[];
	error?: string;
	failedSegment?: { from: number; to: number };
}

export const getRoute = async (map: MapboxMap, accessToken: string): Promise<RouteResult> => {
	if (!map) {
		Logger.warn("[RCS/getRoute] Map is not available. Aborting.");
		return { success: false, waypointsSnapped: false };
	}

	const store = useRoutingStore.getState();
	const waypoints = store.waypoints;
	if (waypoints.length < 2) {
		store.setRoutePath([]);
		store.clearRouteMetrics();
		store.setHasRoute(false);
		elevationAbort?.abort();
		store.clearElevation();
		store.setIsComputingElevation(false);
		return { success: true, waypointsSnapped: false };
	}

	const activity = store.activity ?? useUiStore.getState().activityType;
	const { prefs, options } = buildComputeOptions(activity);
	const outcome = await computeRoute(waypoints, activity, prefs, options);

	if (!routeInputsMatch(waypoints)) {
		Logger.info("[RCS/getRoute] Route inputs changed during calculation. Discarding stale result.");
		return staleRouteResult();
	}

	if (!outcome.ok) {
		const after = useRoutingStore.getState();
		after.setHasRoute(false);
		after.setRoutePath([]);
		elevationAbort?.abort();
		after.clearElevation();
		after.setIsComputingElevation(false);
		return {
			success: false,
			waypointsSnapped: false,
			error: outcome.error,
			failedSegment: outcome.failedSegment,
		};
	}

	const after = useRoutingStore.getState();
	after.setRoutePath(outcome.routePath);

	after.setRouteMetrics({
		distanceMeters: outcome.distanceKm * 1000,
		durationSeconds: outcome.durationMinutes * 60,
		isOffline: !!outcome.offline,
	});
	after.setHasRoute(true);

	// First successful computation on this draft commits the prefs that
	// produced it (per ADR-0023). Subsequent recalcs respect whatever's
	// currently in the draft (e.g. user changed prefs via the modal).
	if (!after.routingPreferences) {
		after.setRoutingPreferences(prefs);
	}

	// Elevation runs async — distance/duration display immediately while we
	// sample terrain. Offline routes skip sampling since we can't reach the
	// terrain tileset anyway.
	if (outcome.offline) {
		useRoutingStore.getState().clearElevation();
		useRoutingStore.getState().setIsComputingElevation(false);
	} else {
		computeElevationInBackground(outcome.routePath, accessToken);
	}

	if (!outcome.offline && "serviceWorker" in navigator) {
		try {
			void serviceWorkerManager.precacheRoute({
				waypoints: waypoints.map((wp) => wp.coord),
				geometry: outcome.routePath,
				distance: outcome.distanceKm * 1000,
				duration: outcome.durationMinutes * 60,
				url: `valhalla_request_${Date.now()}`,
			});
		} catch (error) {
			Logger.warn("[RCS/getRoute] Failed to precache route:", error);
		}
	}

	return {
		success: true,
		waypointsSnapped: !!outcome.snappedWaypoints,
		snappedWaypoints: outcome.snappedWaypoints,
	};
};

// Route-path getters / setters: thin proxies to the Zustand store, which
// is the single source of truth for the active RoutePath. The MapViewAdapter
// observes routePath and reconciles route + km-marker layers automatically.
export const getCurrentRoutePath = (): Coordinate[] => [...useRoutingStore.getState().routePath];

export const clearCurrentRoutePath = (): void => {
	useRoutingStore.getState().clearRoutePath();
};

export const setCurrentRoutePath = (coordinates: Coordinate[]): void => {
	useRoutingStore.getState().setRoutePath([...coordinates]);
};

// ============================================================================
// EDIT-LOCAL RECOMPUTATION (patchRoute)
//
// Untouched legs never re-route. A waypoint mutation diffs the previous and
// current waypoint lists, keeps the path slices of the common prefix/suffix
// verbatim, routes only the changed middle (one small call), and splices.
// This is what preserves imported/external/generated geometry across edits:
// the engine cannot re-route a foreign track faithfully (e.g. a crossing it
// refuses), so it must not get the chance on legs the user did not touch.
// Densify insertions are recognized as pure on-path insertions and change
// nothing at all. Any anomaly falls back to a full getRoute().
// ============================================================================

export interface PreEditState {
	waypoints: Waypoint[];
	routePath: Coordinate[];
	distanceMeters: number;
	durationSeconds: number;
}

export const capturePreEditState = (): PreEditState => {
	const state = useRoutingStore.getState();
	return {
		waypoints: state.waypoints.map((wp) => ({ ...wp })),
		routePath: [...state.routePath],
		distanceMeters: state.distanceMeters,
		durationSeconds: state.durationSeconds,
	};
};

// A waypoint participating in the splice must sit on the previous path;
// beyond this it is not a faithful control point and we recompute fully.
const ANCHOR_TOLERANCE_KM = 0.1;

function anchorIndices(waypoints: Waypoint[], path: Coordinate[]): number[] | null {
	const anchors: number[] = [];
	let cursor = 0;
	for (const wp of waypoints) {
		let best = cursor;
		let bestKm = Infinity;
		for (let i = cursor; i < path.length; i++) {
			const km = haversineDistance(wp.coord, path[i]);
			if (km < bestKm) {
				bestKm = km;
				best = i;
			}
		}
		if (bestKm > ANCHOR_TOLERANCE_KM) return null;
		anchors.push(best);
		cursor = best;
	}
	return anchors;
}

function commonPrefixLength(a: Waypoint[], b: Waypoint[]): number {
	const max = Math.min(a.length, b.length);
	let n = 0;
	while (n < max && sameWaypoint(a[n], b[n])) n++;
	return n;
}

function commonSuffixLength(a: Waypoint[], b: Waypoint[], prefix: number): number {
	const max = Math.min(a.length, b.length) - prefix;
	let n = 0;
	while (n < max && sameWaypoint(a[a.length - 1 - n], b[b.length - 1 - n])) n++;
	return n;
}

// True when every previous waypoint appears in order in `next` and every
// inserted one is interior (between two surviving neighbours) and lies on the
// previous path within its neighbours' span: the densify signature. The path
// is already correct; nothing needs routing. A waypoint appended at either
// end is a user edit whose leg must be routed, even when it lands within
// anchor tolerance of the existing path (closely-spaced clicks, loop
// closings, out-and-backs).
function isPureOnPathInsertion(prev: Waypoint[], next: Waypoint[], path: Coordinate[]): boolean {
	if (next.length <= prev.length) return false;
	const prevAnchors = anchorIndices(prev, path);
	if (!prevAnchors) return false;
	let pi = 0;
	const inserted: { wp: Waypoint; slot: number }[] = [];
	for (const wp of next) {
		if (pi < prev.length && sameWaypoint(wp, prev[pi])) pi++;
		else inserted.push({ wp, slot: pi });
	}
	if (pi !== prev.length) return false;
	for (const { wp, slot } of inserted) {
		if (slot === 0 || slot === prev.length) return false;
		const from = prevAnchors[slot - 1] as number;
		const to = prevAnchors[slot] as number;
		let bestKm = Infinity;
		for (let i = from; i <= to; i++) {
			const km = haversineDistance(wp.coord, path[i]);
			if (km < bestKm) bestKm = km;
		}
		if (bestKm > ANCHOR_TOLERANCE_KM) return false;
	}
	return true;
}

export interface PatchRouteOptions {
	// Restore semantics (undo/redo): when every remaining waypoint still lies
	// on the previous path, trim/keep that path instead of routing anything.
	// An edit-removal must NOT do this: deleting a via is a request to
	// re-route that span.
	restore?: boolean;
}

export const patchRoute = async (
	map: MapboxMap,
	accessToken: string,
	prev: PreEditState,
	patchOptions: PatchRouteOptions = {},
): Promise<RouteResult> => {
	const store = useRoutingStore.getState();
	const next = store.waypoints;

	const fullRecompute = (reason: string): Promise<RouteResult> => {
		Logger.info(`[RCS/patchRoute] Falling back to full recompute: ${reason}`);
		return getRoute(map, accessToken);
	};

	if (next.length < 2 || prev.waypoints.length < 2 || prev.routePath.length < 2) {
		return fullRecompute("no previous route to patch");
	}
	if (store.isOfflineRoute) return fullRecompute("offline route");

	if (isPureOnPathInsertion(prev.waypoints, next, prev.routePath)) {
		Logger.info("[RCS/patchRoute] Pure on-path insertion; path unchanged.");
		return { success: true, waypointsSnapped: false };
	}

	if (patchOptions.restore) {
		const anchors = anchorIndices(next, prev.routePath);
		if (anchors && anchors.length > 0) {
			const first = anchors[0] as number;
			const last = anchors[anchors.length - 1] as number;
			const restored = prev.routePath.slice(first, last + 1);
			// Undoing an ADD removes a via, and removing a via never takes the
			// survivors off the old path — so anchoring `next` alone would keep
			// the dead via's detour rendered (waypoint gone, route line stays).
			// Trimming is only sound when every removed waypoint sits OUTSIDE
			// the kept span (the appended-then-undone case); a mid-route
			// removal falls through to the boundary patch, which re-routes
			// exactly the dead via's span.
			const prevAnchors = anchorIndices(prev.waypoints, prev.routePath);
			const deadViaInsideKeptSpan = (() => {
				if (!prevAnchors) return true; // cannot prove safety: patch instead
				let ni = 0;
				for (let pi = 0; pi < prev.waypoints.length; pi++) {
					if (ni < next.length && sameWaypoint(prev.waypoints[pi], next[ni])) {
						ni++;
						continue;
					}
					const at = prevAnchors[pi] as number;
					if (at > first && at < last) return true;
				}
				return false;
			})();
			if (!deadViaInsideKeptSpan && restored.length >= 2) {
				Logger.info("[RCS/patchRoute] Restore: trimmed previous path, no routing.");
				const restoredKm = calculatePathDistance(restored);
				const prevKm = prev.distanceMeters / 1000;
				const share = prevKm > 0 ? restoredKm / prevKm : 1;
				const after = useRoutingStore.getState();
				after.setRoutePath(restored);
				after.setRouteMetrics({
					distanceMeters: restoredKm * 1000,
					durationSeconds: Math.max(0, Math.round(prev.durationSeconds * share)),
					isOffline: false,
				});
				after.setHasRoute(true);
				computeElevationInBackground(restored, accessToken);
				return { success: true, waypointsSnapped: false };
			}
		}
		// A moved/foreign waypoint in the restored state: patch it like an edit.
	}

	const prefix = commonPrefixLength(prev.waypoints, next);
	const suffix = commonSuffixLength(prev.waypoints, next, prefix);
	if (prefix + suffix === prev.waypoints.length && prefix + suffix === next.length) {
		return { success: true, waypointsSnapped: false };
	}

	// Boundary waypoints bracketing the change; the legs outside them keep
	// their existing geometry verbatim.
	const boundaryFrom = Math.max(0, prefix - 1);
	const boundaryToPrev = prev.waypoints.length - Math.max(0, suffix - 1) - 1;
	const boundaryToNext = next.length - Math.max(0, suffix - 1) - 1;
	const segment = next.slice(boundaryFrom, boundaryToNext + 1);
	if (segment.length < 2) return fullRecompute("degenerate segment");

	// Anchor the FULL previous list (forward walk): anchoring only the two
	// boundary waypoints would let a loop's closing waypoint match the path
	// START instead of its end.
	const anchors = anchorIndices(prev.waypoints, prev.routePath);
	if (!anchors) return fullRecompute("boundary waypoint off the previous path");
	const keepUntil = anchors[boundaryFrom] as number;
	const keepFrom = anchors[boundaryToPrev] as number;

	const activity = store.activity ?? useUiStore.getState().activityType;
	const { prefs, options } = buildComputeOptions(activity);
	const outcome = await computeRoute(segment, activity, prefs, options);

	if (!routeInputsMatch(next)) {
		Logger.info("[RCS/patchRoute] Route inputs changed during patch. Discarding stale result.");
		return staleRouteResult();
	}
	if (!outcome.ok) return fullRecompute(`segment routing failed (${outcome.error ?? "unknown"})`);

	// Keep the boundary coordinates from the previous path verbatim and trim
	// the new leg's duplicated endpoints (polyline decoding rounds them, and a
	// rounded twin would creep into the kept geometry on every edit). When a
	// side has no kept legs (edit at an end), the leg keeps that endpoint.
	const hasPrefix = prefix > 0;
	const hasSuffix = suffix > 0;
	const prefixPath = hasPrefix ? prev.routePath.slice(0, keepUntil + 1) : [];
	const suffixPath = hasSuffix ? prev.routePath.slice(keepFrom) : [];
	let middle = outcome.routePath;
	if (hasPrefix) middle = middle.slice(1);
	if (hasSuffix) middle = middle.slice(0, -1);
	const newPath = [...prefixPath, ...middle, ...suffixPath];

	// Distance is exact (recomputed over the spliced path). Duration is the
	// previous total minus the replaced slice's share plus the new segment's
	// routed time; an explicit recalculate trues it up.
	const replacedKm = calculatePathDistance(prev.routePath.slice(keepUntil, keepFrom + 1));
	if (newPath.length < 2) return fullRecompute("patched path degenerate");
	const prevKm = prev.distanceMeters / 1000;
	const replacedShare = prevKm > 0 ? Math.min(1, replacedKm / prevKm) : 0;
	const newDistanceKm = calculatePathDistance(newPath);
	const newDurationSeconds = Math.max(
		0,
		Math.round(prev.durationSeconds * (1 - replacedShare) + outcome.durationMinutes * 60),
	);

	const after = useRoutingStore.getState();
	after.setRoutePath(newPath);
	after.setRouteMetrics({
		distanceMeters: newDistanceKm * 1000,
		durationSeconds: newDurationSeconds,
		isOffline: false,
	});
	after.setHasRoute(true);
	if (!after.routingPreferences) after.setRoutingPreferences(prefs);
	computeElevationInBackground(newPath, accessToken);

	// Snap-writeback for the recomputed segment only.
	if (outcome.snappedWaypoints) {
		const merged = [...next];
		outcome.snappedWaypoints.forEach((wp, i) => {
			merged[boundaryFrom + i] = wp;
		});
		return { success: true, waypointsSnapped: true, snappedWaypoints: merged };
	}
	return { success: true, waypointsSnapped: false };
};
