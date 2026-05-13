import type { Coordinate, RouteActivity, RouteBaseline, Waypoint, WaypointType } from "@routess/core";
import { calculatePathDistance, estimateWalkingDuration } from "@routess/core";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { trackEvent } from "@/lib/analytics/track";
import type { ApiRoute } from "@/lib/api";
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
import { generateGPXString, parseGPXFile, processGPXWaypoints } from "./services/GPXService";
import {
	clearCurrentRoutePath,
	getCurrentRoutePath,
	getRoute as getRouteFromService,
	setCurrentRoutePath,
} from "./services/RouteCalculationService";
import { checkNearRoad } from "./utils/RoutingUtils";

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
		const result = await getRouteFromService(map, accessToken);
		if (result.success && result.waypointsSnapped && result.snappedWaypoints) {
			setWaypoints(result.snappedWaypoints);
		}
		return result.success ? ok() : fail(result.error ?? "Failed to calculate route.");
	};

	const addWaypoint = async (coord: Coordinate, type: WaypointType = "routed"): Promise<EditResult> => {
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

		const result = await recompute();
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

		saveSnapshot();
		useRoutingStore.getState().removeWaypoint(index);

		if (getWaypoints().length >= 2) await recompute();
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

		const oldCoord = getWaypoints()[index].coord;
		let target = coord;

		const check = await checkNearRoad(coord, accessToken);
		if (check.isValid && check.snappedCoords) target = check.snappedCoords;

		// Snapshot pre-mutation state so a single undo press reverts the move.
		saveSnapshot();
		setWaypoints(setWaypointCoord(getWaypoints(), index, target));
		const result = await recompute();

		if (result.success) return ok();

		const message = result.message ?? "Failed to calculate route. Waypoint may be too far from any road or path.";
		reportError(message);
		setWaypoints(setWaypointCoord(getWaypoints(), index, oldCoord));
		return fail(message);
	};

	const insertWaypointOnRoute = async (
		coord: Coordinate,
		options?: { skipRouteCalc?: boolean },
	): Promise<InsertEditResult> => {
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
		saveSnapshot();
		setWaypoints(decision.waypoints);

		if (options?.skipRouteCalc) {
			return { success: true, newIndex: decision.insertIndex };
		}

		if (getWaypoints().length >= 2) await recompute();
		else clearComputedRouteUi();

		return { success: true, newIndex: decision.insertIndex };
	};

	const reverse = async (): Promise<EditResult> => {
		const current = getWaypoints();
		if (current.length < 2) return ok();

		// Snapshot pre-reverse state so a single undo press restores it.
		saveSnapshot();
		setWaypoints(reverseWaypoints(current));
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
		if (getWaypoints().length < 2) return ok();
		return recompute();
	};

	const undo = async (): Promise<EditResult> => {
		const store = useRoutingStore.getState();
		if (!store.canUndo) return ok();
		store.undo();
		return recompute();
	};

	const redo = async (): Promise<EditResult> => {
		const store = useRoutingStore.getState();
		if (!store.canRedo) return ok();
		store.redo();
		return recompute();
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

	const loadFromShareLink = async (encoded: string): Promise<EditResult> => {
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
			privacy: route.privacy,
			tags: route.tags,
			description: route.description,
			waypoints: route.waypoints.map((wp) => ({ ...wp })),
		};
		const store = useRoutingStore.getState();
		store.setMode({ kind: "editing", routeId: route.id, name: route.name, baseline });
		store.setActivity(route.activity);
		// RouteDraft does not yet store the creation_source of saved routes;
		// revisit when the saved-route schema carries that field.
		trackEvent({ name: "route_loaded_into_editor", properties: { creation_source: "unknown" } });
		return loadWaypoints(route.waypoints, {
			exactRoutePath: route.geometry,
			saveSnapshot: true,
		});
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
			privacy: route.privacy,
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
			},
		});

		if (parsed.trackPoints && parsed.trackPoints.length >= 2) {
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
		const contents = generateGPXString(waypoints, effectivePath);
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
		loadWaypoints,
		unload,
		clearDraft,
		setActivity,
		applySaved,
		exportGpx,
		buildShareUrl,
	};
};
