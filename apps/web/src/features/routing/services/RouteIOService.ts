import { calculatePathDistance, estimateWalkingDuration, formatDistance, formatDuration } from "@routess/core";
import type { ApiRoute } from "@/lib/api";
import { Logger } from "@/lib/logger";
import { decompressAndParse } from "@/lib/shareUtils";
import { validateCoordinate } from "@/lib/utils/route-validation";
import { useRoutingStore } from "@/stores/routingStore";
import type { Coordinate } from "@/types/map";
import {
	clearKilometerMarkersLayer,
	clearRouteLayer,
	updateRouteLayer,
	updateWaypointsLayer,
} from "../managers/MapLayerManager";
import { generateGPXString, parseGPXFile, processGPXWaypoints } from "./GPXService";
import {
	loadMapLockStateFromLocalStorage,
	saveMapLockStateToLocalStorage,
	saveWaypointsToLocalStorage,
} from "./LocalStorageService";
import { getCurrentRoutePath, getRoute, setCurrentRoutePath } from "./RouteCalculationService";

type RouteStateSetter = React.Dispatch<React.SetStateAction<string>>;
type HasRouteSetter = React.Dispatch<React.SetStateAction<boolean>>;

interface RouteUiStateSetters {
	setRouteDistance: RouteStateSetter;
	setRouteDuration: RouteStateSetter;
	setHasRoute: HasRouteSetter;
}

interface LoadRouteOptions extends RouteUiStateSetters {
	map: mapboxgl.Map;
	accessToken: string;
	waypoints: Coordinate[];
	directFlags: boolean[];
	exactRoutePath?: Coordinate[];
	isMapLocked?: boolean;
	saveSnapshot?: boolean;
}

interface SharedRouteOptions extends RouteUiStateSetters {
	map: mapboxgl.Map;
	accessToken: string;
	encodedRoute: string;
}

interface GpxImportOptions extends RouteUiStateSetters {
	map: mapboxgl.Map;
	accessToken: string;
	gpxString: string;
}

interface RouteIoResult {
	success: boolean;
	message?: string;
}

const routeHasValidShape = (waypoints: Coordinate[], directFlags: boolean[]): boolean => {
	if (waypoints.length !== directFlags.length) {
		return false;
	}

	return waypoints.every((waypoint) => validateCoordinate(waypoint).isValid);
};

const clearRouteState = ({ map, setRouteDistance, setRouteDuration, setHasRoute }: LoadRouteOptions) => {
	clearRouteLayer(map);
	clearKilometerMarkersLayer(map);
	setCurrentRoutePath([]);
	setRouteDistance("");
	setRouteDuration("");
	setHasRoute(false);
};

const applyExactRoutePath = ({
	map,
	waypoints,
	directFlags,
	exactRoutePath,
	setRouteDistance,
	setRouteDuration,
	setHasRoute,
	isMapLocked,
}: LoadRouteOptions & { exactRoutePath: Coordinate[]; isMapLocked: boolean }) => {
	useRoutingStore.getState().setWaypoints(waypoints, directFlags);
	updateWaypointsLayer(map, waypoints, isMapLocked);
	saveWaypointsToLocalStorage(waypoints, directFlags);

	setCurrentRoutePath(exactRoutePath);
	updateRouteLayer(map, exactRoutePath);
	clearKilometerMarkersLayer(map);

	const routeDistanceKm = calculatePathDistance(exactRoutePath);
	const routeDurationMinutes = estimateWalkingDuration(routeDistanceKm);

	setRouteDistance(formatDistance(routeDistanceKm));
	setRouteDuration(formatDuration(routeDurationMinutes));
	setHasRoute(exactRoutePath.length >= 2);
};

export const loadRouteIntoMap = async (options: LoadRouteOptions): Promise<RouteIoResult> => {
	const {
		map,
		accessToken,
		waypoints,
		directFlags,
		exactRoutePath,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
		saveSnapshot = false,
	} = options;
	const isMapLocked = options.isMapLocked ?? loadMapLockStateFromLocalStorage();

	if (!routeHasValidShape(waypoints, directFlags)) {
		return {
			success: false,
			message: "The route data is invalid or corrupted.",
		};
	}

	const store = useRoutingStore.getState();

	if (saveSnapshot) {
		store.saveSnapshot();
	}

	store.setIsMapLocked(isMapLocked);
	saveMapLockStateToLocalStorage(isMapLocked);

	clearRouteState({ ...options, isMapLocked });

	if (waypoints.length === 0) {
		store.clearWaypoints();
		return { success: true };
	}

	store.setWaypoints(waypoints, directFlags);
	updateWaypointsLayer(map, waypoints, isMapLocked);
	saveWaypointsToLocalStorage(waypoints, directFlags);

	if (exactRoutePath && exactRoutePath.length >= 2) {
		applyExactRoutePath({
			...options,
			exactRoutePath,
			isMapLocked,
		});
		return { success: true };
	}

	if (waypoints.length < 2) {
		return { success: true };
	}

	const routeResult = await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);

	if (!routeResult.success) {
		return {
			success: false,
			message: routeResult.error || "Failed to calculate the route.",
		};
	}

	if (routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
		store.setWaypoints(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
		updateWaypointsLayer(map, routeResult.snappedWaypoints, isMapLocked);
		saveWaypointsToLocalStorage(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
	}

	return { success: true };
};

export const loadSharedRouteIntoMap = async ({
	map,
	accessToken,
	encodedRoute,
	setRouteDistance,
	setRouteDuration,
	setHasRoute,
}: SharedRouteOptions): Promise<RouteIoResult> => {
	const parsed = decompressAndParse(encodedRoute);

	if (!parsed || !routeHasValidShape(parsed.w, parsed.f)) {
		return {
			success: false,
			message: "Failed to read shared route data. The link may be invalid or corrupted.",
		};
	}

	return loadRouteIntoMap({
		map,
		accessToken,
		waypoints: parsed.w,
		directFlags: parsed.f,
		isMapLocked: parsed.l,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
	});
};

export const loadApiRouteIntoMap = async (
	route: ApiRoute,
	options: Omit<LoadRouteOptions, "waypoints" | "directFlags">,
): Promise<RouteIoResult> => {
	const waypoints: Coordinate[] = route.waypoints.map((waypoint) => [waypoint.lng, waypoint.lat]);
	const directFlags = route.waypoints.map((waypoint) => waypoint.type === "direct");

	return loadRouteIntoMap({
		...options,
		waypoints,
		directFlags,
		saveSnapshot: true,
	});
};

export const importRouteFromGPXString = async ({
	map,
	accessToken,
	gpxString,
	setRouteDistance,
	setRouteDuration,
	setHasRoute,
}: GpxImportOptions): Promise<RouteIoResult> => {
	const parsed = await parseGPXFile(gpxString);

	if (parsed.error) {
		return { success: false, message: parsed.error };
	}

	if (!parsed.waypoints || parsed.waypoints.length === 0) {
		return { success: false, message: "No valid waypoints were found in the GPX file." };
	}

	if (parsed.trackPoints && parsed.trackPoints.length >= 2) {
		return loadRouteIntoMap({
			map,
			accessToken,
			waypoints: parsed.waypoints,
			directFlags: new Array(parsed.waypoints.length).fill(false),
			exactRoutePath: parsed.trackPoints,
			setRouteDistance,
			setRouteDuration,
			setHasRoute,
			saveSnapshot: true,
		});
	}

	const processed = await processGPXWaypoints(parsed.waypoints, accessToken);

	if (processed.error || !processed.finalWaypoints || !processed.finalDirectFlags) {
		return { success: false, message: processed.error || "Failed to import the GPX route." };
	}

	return loadRouteIntoMap({
		map,
		accessToken,
		waypoints: processed.finalWaypoints,
		directFlags: processed.finalDirectFlags,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
		saveSnapshot: true,
	});
};

export const exportCurrentRouteToGPXFile = (filename = "routess-route.gpx"): RouteIoResult => {
	const { waypoints } = useRoutingStore.getState();
	const routePath = getCurrentRoutePath();

	if (waypoints.length === 0) {
		return {
			success: false,
			message: "No route available to export.",
		};
	}

	const effectiveRoutePath = routePath.length >= 2 ? routePath : waypoints;
	const gpxContents = generateGPXString(waypoints, effectiveRoutePath);
	const blob = new Blob([gpxContents], { type: "application/gpx+xml;charset=utf-8" });
	const objectUrl = URL.createObjectURL(blob);

	try {
		const link = document.createElement("a");
		link.href = objectUrl;
		link.download = filename;
		link.click();
	} catch (error) {
		Logger.error("[RouteIOService] Failed to export GPX file:", error);
		return {
			success: false,
			message: "Failed to export the GPX file.",
		};
	} finally {
		URL.revokeObjectURL(objectUrl);
	}

	return { success: true };
};
