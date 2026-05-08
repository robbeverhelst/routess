import type { Coordinate, Waypoint, WaypointType } from "@routess/core";
import { calculatePathDistance, estimateWalkingDuration } from "@routess/core";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
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
		const initialCount = getWaypoints().length;
		saveSnapshot();

		const resolved = await resolveAddCoord(coord, type, initialCount === 0, accessToken);
		useRoutingStore.getState().addWaypoint(resolved.coord, resolved.type);

		// First routed waypoint: also try to snap it.
		if (getWaypoints().length === 1 && initialCount === 0 && type === "routed") {
			const first = getWaypoints()[0];
			const check = await checkNearRoad(first.coord, accessToken);
			if (check.isValid && check.snappedCoords) {
				setWaypoints([{ coord: check.snappedCoords, type: "routed" }]);
				return ok();
			}
			Logger.warn("[RouteDraftEditor] First routed waypoint failed checkNearRoad. Rejecting.");
			reportError("Point is too far from any road or path.");
			useRoutingStore.getState().removeWaypoint(0);
			return fail("Point is too far from any road or path.");
		}

		if (getWaypoints().length >= 2) {
			const result = await recompute();
			if (result.success) return ok();

			const last = getWaypoints().length - 1;
			const wasRawDueToFailure =
				resolved.checkNearRoadFailed &&
				last >= 0 &&
				getWaypoints()[last].coord[0] === coord[0] &&
				getWaypoints()[last].coord[1] === coord[1];

			if (wasRawDueToFailure) {
				const message = "Point is too far from any road for routing. Please click closer to a road or path.";
				reportError(message);
				useRoutingStore.getState().removeWaypoint(last);
				if (getWaypoints().length >= 2) await recompute();
				else clearComputedRouteUi();
				return fail(message);
			}

			reportError(result.message ?? "Could not calculate route.");
			return ok();
		}

		// First "direct" waypoint placed on its own — nothing to compute.
		if (getWaypoints().length === 1 && initialCount === 0 && type === "direct") {
			clearComputedRouteUi();
			return ok();
		}

		return fail("No waypoint added.");
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

		saveSnapshot();
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

		setWaypoints(setWaypointCoord(getWaypoints(), index, target));
		const result = await recompute();

		if (result.success) {
			saveSnapshot();
			return ok();
		}

		const message = result.message ?? "Failed to calculate route. Waypoint may be too far from any road or path.";
		reportError(message);
		setWaypoints(setWaypointCoord(getWaypoints(), index, oldCoord));
		saveSnapshot();
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

		setWaypoints(decision.waypoints);

		if (options?.skipRouteCalc) {
			return { success: true, newIndex: decision.insertIndex };
		}

		if (getWaypoints().length >= 2) await recompute();
		else clearComputedRouteUi();

		saveSnapshot();
		return { success: true, newIndex: decision.insertIndex };
	};

	const reverse = async (): Promise<EditResult> => {
		const current = getWaypoints();
		if (current.length < 2) return ok();

		setWaypoints(reverseWaypoints(current));
		await recompute();
		saveSnapshot();
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
		return loadWaypoints(route.waypoints, { saveSnapshot: true });
	};

	const loadFromGpx = async (gpxString: string): Promise<EditResult> => {
		const parsed = await parseGPXFile(gpxString);
		if (parsed.error) return fail(parsed.error);
		if (!parsed.waypoints || parsed.waypoints.length === 0) {
			return fail("No valid waypoints were found in the GPX file.");
		}

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
		exportGpx,
		buildShareUrl,
	};
};
