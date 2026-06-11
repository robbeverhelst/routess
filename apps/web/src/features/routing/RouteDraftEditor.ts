import type { ApiExternalRoute } from "@routess/api-client";
import type { Coordinate, RouteActivity, RouteBaseline, Waypoint, WaypointType } from "@routess/core";
import {
	buildRouteGpx,
	calculatePathDistance,
	densifyWaypointsAlongPath,
	estimateWalkingDuration,
	IMPORTED_DENSIFY_MAX_TOTAL_WAYPOINTS,
	IMPORTED_DENSIFY_THRESHOLDS,
	selectSmartWaypoints,
} from "@routess/core";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { trackEvent } from "@/lib/analytics/track";
import { type ApiRoute, apiService } from "@/lib/api";
import { Logger } from "@/lib/logger";
import { decompressAndParse, serializeAndCompress } from "@/lib/shareUtils";
import { validateCoordinate } from "@/lib/utils/route-validation";
import { useRoutingStore } from "@/stores/routingStore";
import {
	insertWaypointOnRoute as insertWaypointOnRouteDecision,
	resolveAddCoord,
	reverseWaypoints,
	setWaypointCoord,
} from "./managers/WaypointCoordinator";
import { parseGPXFile, processGPXWaypoints } from "./services/GPXService";
import {
	capturePreEditState,
	clearCurrentRoutePath,
	computeElevationInBackground,
	getCurrentRoutePath,
	getRoute as getRouteFromService,
	type PreEditState,
	patchRoute,
	setCurrentRoutePath,
} from "./services/RouteCalculationService";

// The deep RouteDraft editor module: the single seam over the routingStore for
// every RouteDraft mutation. Construction captures the Mapbox map, access
// token, and an optional error reporter; the resulting object exposes a small
// interface for adding/removing/moving Waypoints, undo/redo, and loading or
// exporting Routes. Implementation reaches into `useRoutingStore.getState()`,
// but callers never do (ADR-0002 stays — Zustand remains the implementation).

export interface EditResult {
	success: boolean;
	message?: string;
}

export interface InsertEditResult extends EditResult {
	newIndex?: number;
}

export interface ShareResult extends EditResult {
	url?: string;
}

export interface LoadOptions {
	exactRoutePath?: Coordinate[];
	isMapLocked?: boolean;
	saveSnapshot?: boolean;
}

export interface RouteDraftEditorDeps {
	map: MapboxMap;
	accessToken: string;
	onError?: (message: string) => void;
}

export interface RouteDraftEditor {
	addWaypoint(coord: Coordinate, type?: WaypointType): Promise<EditResult>;
	insertWaypointOnRoute(coord: Coordinate, options?: { skipRouteCalc?: boolean }): Promise<InsertEditResult>;
	removeWaypoint(index: number): Promise<EditResult>;
	moveWaypoint(index: number, coord: Coordinate): Promise<EditResult>;
	reverse(): Promise<EditResult>;
	reset(): Promise<EditResult>;
	recalculate(): Promise<EditResult>;
	undo(): Promise<EditResult>;
	redo(): Promise<EditResult>;
	loadFromApiRoute(route: ApiRoute): Promise<EditResult>;
	loadFromExternalRoute(route: ApiExternalRoute): Promise<EditResult>;
	loadFromShareLink(encoded: string): Promise<EditResult>;
	loadFromGpx(gpxString: string): Promise<EditResult>;
	loadWaypoints(waypoints: Waypoint[], options?: LoadOptions): Promise<EditResult>;
	unload(): void;
	clearDraft(): Promise<EditResult>;
	setActivity(activity: RouteActivity): void;
	// Reset baseline + mode to a freshly-saved snapshot. Called by save/update
	// flows on API success so the next dirty check compares against what the
	// server has, not against the pre-save state.
	applySaved(route: ApiRoute): void;
	exportGpx(filename?: string): EditResult;
	buildShareUrl(): ShareResult;
}

const ok = (): EditResult => ({ success: true });
const fail = (message: string): EditResult => ({ success: false, message });

const creationSourceFromProvenance = (provenance: ApiRoute["provenance"]): "manual" | "generated" | "imported" => {
	if (provenance === "generation") return "generated";
	if (provenance === "gpx-import") return "imported";
	return "manual";
};

const getWaypoints = (): Waypoint[] => useRoutingStore.getState().waypoints;
const setWaypoints = (waypoints: Waypoint[]) => useRoutingStore.getState().setWaypoints(waypoints);
const saveSnapshot = () => useRoutingStore.getState().saveSnapshot();
const clearComputedRouteUi = () => {
	const store = useRoutingStore.getState();
	store.clearRouteMetrics();
	store.setHasRoute(false);
	clearCurrentRoutePath();
};

const routeHasValidShape = (waypoints: Waypoint[]): boolean =>
	waypoints.every((wp) => validateCoordinate(wp.coord).isValid);

export const createRouteDraftEditor = (deps: RouteDraftEditorDeps): RouteDraftEditor => {
	const { map, accessToken, onError } = deps;
	const reportError = (message: string) => onError?.(message);

	const recompute = async (): Promise<EditResult> => {
		const store = useRoutingStore.getState();
		store.setIsComputingRoute(true);
		try {
			const result = await getRouteFromService(map, accessToken);
			if (result.success && result.waypointsSnapped && result.snappedWaypoints) {
				setWaypoints(result.snappedWaypoints);
			}
			return result.success ? ok() : fail(result.error ?? "Failed to calculate route.");
		} finally {
			store.setIsComputingRoute(false);
		}
	};

	// Edit-local recompute: routes only the legs the edit touched, keeping
	// every other leg's geometry verbatim (patchRoute falls back to a full
	// recompute on any anomaly). `prev` must be captured AFTER
	// ensureEditableShape and BEFORE the store mutation, so the diff is just
	// the edit itself.
	const recomputeLocal = async (prev: PreEditState, options?: { restore?: boolean }): Promise<EditResult> => {
		const store = useRoutingStore.getState();
		store.setIsComputingRoute(true);
		try {
			const result = await patchRoute(map, accessToken, prev, options);
			if (result.success && result.waypointsSnapped && result.snappedWaypoints) {
				setWaypoints(result.snappedWaypoints);
			}
			return result.success ? ok() : fail(result.error ?? "Failed to calculate route.");
		} finally {
			store.setIsComputingRoute(false);
		}
	};

	// Generated, imported, and external drafts carry more shape in their
	// geometry than their sparse control waypoints reproduce: recalculating
	// from just those would unravel the route into plain shortest paths.
	// Before the first mutating edit, densify: insert smart waypoints along
	// the CURRENT RoutePath so every leg is short enough to recalculate
	// faithfully and edits stay local. Only hand-placed (manual) drafts skip
	// this; their waypoints ARE the shape. Runs before the edit's own
	// snapshot (undo restores the densified, shape-faithful state) and is
	// idempotent once segments are short. Returns the original→new index map
	// for callers holding an index.
	const ensureEditableShape = (): number[] => {
		const store = useRoutingStore.getState();
		const identity = store.waypoints.map((_, i) => i);
		if (store.creationSource === "manual") return identity;
		const routePath = getCurrentRoutePath();
		if (store.waypoints.length < 2 || routePath.length < 2) return identity;

		// Imported/external tracks need much denser pins than generated drafts:
		// the engine reproduces its own geometry between sparse pins, but not a
		// foreign track's.
		const imported = store.creationSource === "imported";
		const { waypoints, indexMap, insertedCount } = densifyWaypointsAlongPath(
			store.waypoints,
			routePath,
			imported ? IMPORTED_DENSIFY_THRESHOLDS : undefined,
			imported ? IMPORTED_DENSIFY_MAX_TOTAL_WAYPOINTS : undefined,
		);
		if (insertedCount === 0) return identity;
		Logger.info(`[RouteDraftEditor] Densified ${store.creationSource} draft: +${insertedCount} waypoints before edit`);
		setWaypoints(waypoints);
		return indexMap;
	};

	const addWaypoint = async (coord: Coordinate, type: WaypointType = "routed"): Promise<EditResult> => {
		ensureEditableShape();
		const prev = capturePreEditState();
		saveSnapshot();

		const resolved = await resolveAddCoord(coord, type, accessToken);
		useRoutingStore.getState().addWaypoint(resolved.coord, resolved.type);

		// Single Waypoint: nothing to route yet. The first Waypoint can't be
		// validated against the road network until the second one arrives;
		// any rejection happens at the first Directions call below.
		if (getWaypoints().length < 2) {
			clearComputedRouteUi();
			return ok();
		}

		const result = await recomputeLocal(prev);
		if (result.success) return ok();

		// Directions could not compute a route. Roll back the just-added
		// Waypoint so the route stays in a valid state, and surface a clear
		// error. This is uniform: same behavior whether the offending
		// Waypoint is the first or the Nth.
		const last = getWaypoints().length - 1;
		const message = resolved.checkNearRoadFailed
			? "Point is too far from any road for routing. Please click closer to a road or path."
			: (result.message ?? "Could not calculate route.");
		reportError(message);
		useRoutingStore.getState().removeWaypoint(last);
		if (getWaypoints().length >= 2) await recompute();
		else clearComputedRouteUi();
		return fail(message);
	};

	const removeWaypoint = async (index: number): Promise<EditResult> => {
		const count = getWaypoints().length;
		if (index < 0 || index >= count) {
			const message = "Invalid waypoint index. Waypoint may no longer exist.";
			reportError(message);
			return fail(message);
		}

		const mappedIndex = ensureEditableShape()[index];
		const prev = capturePreEditState();
		saveSnapshot();
		useRoutingStore.getState().removeWaypoint(mappedIndex);

		if (getWaypoints().length >= 2) await recomputeLocal(prev);
		else clearComputedRouteUi();

		return ok();
	};

	const moveWaypoint = async (index: number, coord: Coordinate): Promise<EditResult> => {
		const count = getWaypoints().length;
		if (index < 0 || index >= count) {
			const message = "Invalid waypoint index for update.";
			reportError(message);
			return fail(message);
		}

		const mappedIndex = ensureEditableShape()[index];
		const oldCoord = getWaypoints()[mappedIndex].coord;
		const prev = capturePreEditState();

		// Apply the raw coord immediately so the marker lands without waiting
		// on the network; the recompute below snaps it onto the road via the
		// returned leg shapes (a Mapbox pre-check here doubled the latency of
		// every move for the same end state).
		// Snapshot pre-mutation state so a single undo press reverts the move.
		saveSnapshot();
		setWaypoints(setWaypointCoord(getWaypoints(), mappedIndex, coord));
		const result = await recomputeLocal(prev);

		if (result.success) return ok();

		const message = result.message ?? "Failed to calculate route. Waypoint may be too far from any road or path.";
		reportError(message);
		setWaypoints(setWaypointCoord(getWaypoints(), mappedIndex, oldCoord));
		return fail(message);
	};

	const insertWaypointOnRoute = async (
		coord: Coordinate,
		options?: { skipRouteCalc?: boolean },
	): Promise<InsertEditResult> => {
		ensureEditableShape();
		const current = getWaypoints();
		if (current.length < 1) {
			const message = "Cannot add waypoint: No existing route segment.";
			reportError(message);
			return { success: false, message };
		}

		const routeSource = map.getSource("route") as GeoJSONSource | undefined;
		const routeData = routeSource?._data as GeoJSON.Feature<GeoJSON.LineString> | undefined;
		const routePath: Coordinate[] =
			routeData?.geometry?.coordinates && routeData.geometry.coordinates.length > 0
				? routeData.geometry.coordinates.map((p) => [p[0], p[1]] as Coordinate)
				: getCurrentRoutePath();

		if (routePath.length < 2) {
			const message = "Cannot add waypoint: Route path is not defined or too short.";
			reportError(message);
			return { success: false, message };
		}

		const decision = insertWaypointOnRouteDecision(current, routePath, coord);
		if (!decision) {
			const message = "Cannot add waypoint: Click too far from route.";
			reportError(message);
			return { success: false, message };
		}

		// Snapshot pre-mutation state so a single undo press reverts the
		// insert. With skipRouteCalc the caller (drag handler) owns the
		// commit; the snapshot still belongs to the insert itself.
		const prev = capturePreEditState();
		saveSnapshot();
		setWaypoints(decision.waypoints);

		if (options?.skipRouteCalc) {
			return { success: true, newIndex: decision.insertIndex };
		}

		if (getWaypoints().length >= 2) await recomputeLocal(prev);
		else clearComputedRouteUi();

		return { success: true, newIndex: decision.insertIndex };
	};

	const reverse = async (): Promise<EditResult> => {
		if (getWaypoints().length < 2) return ok();

		ensureEditableShape();
		// Snapshot pre-reverse state so a single undo press restores it.
		saveSnapshot();
		setWaypoints(reverseWaypoints(getWaypoints()));
		await recompute();
		return ok();
	};

	const reset = async (): Promise<EditResult> => {
		saveSnapshot();
		useRoutingStore.getState().clearWaypoints();
		await recompute();
		return ok();
	};

	const recalculate = async (): Promise<EditResult> => {
		// With fewer than 2 waypoints there's nothing to route. Drop any stale
		// routePath/metrics so the map doesn't keep showing a polyline that no
		// longer corresponds to the current waypoint set (the per-waypoint
		// trash in PlanPanel goes through this path after going from 2→1).
		if (getWaypoints().length < 2) {
			clearComputedRouteUi();
			return ok();
		}
		// Explicit recalcs (preference changes etc.) also rebuild from
		// waypoints, so a generated draft must densify first too.
		ensureEditableShape();
		return recompute();
	};

	const undo = async (): Promise<EditResult> => {
		const store = useRoutingStore.getState();
		if (!store.canUndo) return ok();
		const prev = capturePreEditState();
		store.undo();
		if (getWaypoints().length < 2) {
			clearComputedRouteUi();
			return ok();
		}
		return recomputeLocal(prev, { restore: true });
	};

	const redo = async (): Promise<EditResult> => {
		const store = useRoutingStore.getState();
		if (!store.canRedo) return ok();
		const prev = capturePreEditState();
		store.redo();
		if (getWaypoints().length < 2) {
			clearComputedRouteUi();
			return ok();
		}
		return recomputeLocal(prev, { restore: true });
	};

	const applyExactRoutePath = (waypoints: Waypoint[], exactRoutePath: Coordinate[]) => {
		setWaypoints(waypoints);
		setCurrentRoutePath(exactRoutePath);

		const distanceKm = calculatePathDistance(exactRoutePath);
		const durationMinutes = estimateWalkingDuration(distanceKm);
		const store = useRoutingStore.getState();
		store.setRouteMetrics({
			distanceMeters: distanceKm * 1000,
			durationSeconds: durationMinutes * 60,
			isOffline: false,
		});
		store.setHasRoute(exactRoutePath.length >= 2);

		// Stored geometry skips the Valhalla recompute, which is what normally
		// kicks off elevation sampling. Sample the exact path directly.
		computeElevationInBackground(exactRoutePath, accessToken);
	};

	const loadWaypoints = async (waypoints: Waypoint[], options: LoadOptions = {}): Promise<EditResult> => {
		const { exactRoutePath, isMapLocked, saveSnapshot: snapshot = false } = options;

		if (!routeHasValidShape(waypoints)) return fail("The route data is invalid or corrupted.");

		const store = useRoutingStore.getState();
		if (snapshot) store.saveSnapshot();
		store.setIsMapLocked(isMapLocked ?? store.isMapLocked);

		clearComputedRouteUi();

		if (waypoints.length === 0) {
			store.clearWaypoints();
			return ok();
		}

		setWaypoints(waypoints);

		if (exactRoutePath && exactRoutePath.length >= 2) {
			applyExactRoutePath(waypoints, exactRoutePath);
			return ok();
		}

		if (waypoints.length < 2) return ok();

		return recompute();
	};

	// ?route= carries either a route ref (numeric id or 32-hex share token,
	// from the public route page's "Open in routess") or the legacy
	// compressed-waypoints payload (ShareModal links). A ref payload can never
	// look like compressed data and vice versa, so dispatch on shape.
	const ROUTE_REF_PATTERN = /^(\d+|[0-9a-f]{32})$/;

	const loadFromRouteRef = async (ref: string): Promise<EditResult> => {
		let route: ApiRoute;
		try {
			route = await apiService.getRoute(ref);
		} catch (error) {
			Logger.warn("[RouteDraftEditor] Failed to fetch shared route", error);
			return fail("This route is no longer available.");
		}
		// A visitor's draft, not an editing session: the route belongs to
		// someone else, so it loads unbound and saves as a new route.
		useRoutingStore.getState().setActivity(route.activity);
		useRoutingStore.getState().setCreationSource(creationSourceFromProvenance(route.provenance));
		return loadWaypoints(route.waypoints, {
			exactRoutePath: route.geometry && route.geometry.length >= 2 ? route.geometry : undefined,
			saveSnapshot: true,
		});
	};

	const loadFromShareLink = async (encoded: string): Promise<EditResult> => {
		if (ROUTE_REF_PATTERN.test(encoded)) return loadFromRouteRef(encoded);
		const parsed = decompressAndParse(encoded);
		if (!parsed || !routeHasValidShape(parsed.waypoints)) {
			return fail("Failed to read shared route data. The link may be invalid or corrupted.");
		}
		return loadWaypoints(parsed.waypoints, { isMapLocked: parsed.isLocked });
	};

	const loadFromApiRoute = async (route: ApiRoute): Promise<EditResult> => {
		const baseline: RouteBaseline = {
			name: route.name,
			activity: route.activity,
			visibility: route.visibility,
			tags: route.tags,
			description: route.description,
			waypoints: route.waypoints.map((wp) => ({ ...wp })),
		};
		const store = useRoutingStore.getState();
		store.setMode({ kind: "editing", routeId: route.id, name: route.name, baseline });
		store.setActivity(route.activity);
		// Carry the origin onto the draft: a saved generated route must
		// densify before its first edit just like a fresh generated draft.
		store.setCreationSource(creationSourceFromProvenance(route.provenance));
		trackEvent({
			name: "route_loaded_into_editor",
			properties: { creation_source: creationSourceFromProvenance(route.provenance) },
		});
		return loadWaypoints(route.waypoints, {
			exactRoutePath: route.geometry,
			saveSnapshot: true,
		});
	};

	// Opens a seeded ExternalRoute (ADR 0035) in the planner as a fresh
	// unsaved draft: the official geometry is pinned exactly; smart waypoints
	// make it editable. Saving creates the user's own copy (the fork), never
	// touches the ExternalRoute.
	const loadFromExternalRoute = async (route: ApiExternalRoute): Promise<EditResult> => {
		const store = useRoutingStore.getState();
		store.setMode({ kind: "unsaved" });
		if (route.activity) store.setActivity(route.activity);
		store.setCreationSource("imported");
		trackEvent({
			name: "route_loaded_into_editor",
			properties: { creation_source: "external" },
		});
		const waypoints: Waypoint[] = selectSmartWaypoints(route.geometry).map((coord) => ({
			coord,
			type: "routed" as const,
		}));
		return loadWaypoints(waypoints, { exactRoutePath: route.geometry, saveSnapshot: true });
	};

	const unload = (): void => {
		useRoutingStore.getState().setMode({ kind: "unsaved" });
	};

	const clearDraft = async (): Promise<EditResult> => {
		const store = useRoutingStore.getState();
		store.clearWaypoints();
		store.clearHistory();
		clearCurrentRoutePath();
		return ok();
	};

	const setActivity = (activity: RouteActivity): void => {
		useRoutingStore.getState().setActivity(activity);
	};

	const applySaved = (route: ApiRoute): void => {
		const baseline: RouteBaseline = {
			name: route.name,
			activity: route.activity,
			visibility: route.visibility,
			tags: route.tags,
			description: route.description,
			waypoints: route.waypoints.map((wp) => ({ ...wp })),
		};
		const store = useRoutingStore.getState();
		store.setMode({ kind: "editing", routeId: route.id, name: route.name, baseline });
		if (route.activity !== undefined) store.setActivity(route.activity);
	};

	const loadFromGpx = async (gpxString: string): Promise<EditResult> => {
		const parsed = await parseGPXFile(gpxString);
		if (parsed.error) return fail(parsed.error);
		if (!parsed.waypoints || parsed.waypoints.length === 0) {
			return fail("No valid waypoints were found in the GPX file.");
		}

		const hadNames = parsed.waypoints.some((wp) => !!wp.name);
		const trackDistanceKm =
			parsed.trackPoints && parsed.trackPoints.length >= 2 ? calculatePathDistance(parsed.trackPoints) : 0;
		trackEvent({
			name: "gpx_imported",
			properties: {
				waypoint_count: parsed.waypoints.length,
				distance_m: Math.round(trackDistanceKm * 1000),
				had_names: hadNames,
				source: "file_upload",
				target: "draft",
			},
		});

		useRoutingStore.getState().setCreationSource("imported");

		if (parsed.trackPoints && parsed.trackPoints.length >= 2 && !parsed.waypointsDerivedFromTrack) {
			const waypoints: Waypoint[] = parsed.waypoints.map((wp) => ({
				coord: wp.coord,
				type: wp.type ?? "routed",
				...(wp.name ? { name: wp.name } : {}),
			}));
			return loadWaypoints(waypoints, { exactRoutePath: parsed.trackPoints, saveSnapshot: true });
		}

		const processed = await processGPXWaypoints(parsed.waypoints, accessToken);
		if (processed.error || !processed.finalWaypoints) {
			return fail(processed.error ?? "Failed to import the GPX route.");
		}
		return loadWaypoints(processed.finalWaypoints, { saveSnapshot: true });
	};

	const exportGpx = (filename = "routess-route.gpx"): EditResult => {
		const waypoints = getWaypoints();
		if (waypoints.length === 0) return fail("No route available to export.");

		const routePath = getCurrentRoutePath();
		const effectivePath = routePath.length >= 2 ? routePath : waypoints.map((wp) => wp.coord);
		const contents = buildRouteGpx({ waypoints, geometry: effectivePath });
		const blob = new Blob([contents], { type: "application/gpx+xml;charset=utf-8" });
		const url = URL.createObjectURL(blob);

		try {
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			link.click();
		} catch (error) {
			Logger.error("[RouteDraftEditor] Failed to export GPX file:", error);
			return fail("Failed to export the GPX file.");
		} finally {
			URL.revokeObjectURL(url);
		}

		const store = useRoutingStore.getState();
		const distanceKm = calculatePathDistance(effectivePath);
		trackEvent({
			name: "gpx_exported",
			properties: {
				waypoint_count: waypoints.length,
				distance_m: Math.round(distanceKm * 1000),
				route_was_saved: store.mode.kind === "editing",
			},
		});

		return ok();
	};

	const buildShareUrl = (): ShareResult => {
		const { waypoints, isMapLocked } = useRoutingStore.getState();
		if (waypoints.length === 0) return { success: false, message: "Cannot share an empty route." };

		const encoded = serializeAndCompress(waypoints, isMapLocked);
		if (!encoded) return { success: false, message: "Could not generate shareable link." };

		const url = `${window.location.origin}${window.location.pathname}?route=${encoded}`;
		return { success: true, url };
	};

	return {
		addWaypoint,
		insertWaypointOnRoute,
		removeWaypoint,
		moveWaypoint,
		reverse,
		reset,
		recalculate,
		undo,
		redo,
		loadFromApiRoute,
		loadFromShareLink,
		loadFromGpx,
		loadFromExternalRoute,
		loadWaypoints,
		unload,
		clearDraft,
		setActivity,
		applySaved,
		exportGpx,
		buildShareUrl,
	};
};
