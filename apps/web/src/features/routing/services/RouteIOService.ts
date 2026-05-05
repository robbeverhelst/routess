import type { Waypoint } from "@routess/core";
import { calculatePathDistance, estimateWalkingDuration, formatDistance, formatDuration } from "@routess/core";
import type { ApiRoute } from "@/lib/api";
import { Logger } from "@/lib/logger";
import { decompressAndParse } from "@/lib/shareUtils";
import { validateCoordinate } from "@/lib/utils/route-validation";
import { useRoutingStore } from "@/stores/routingStore";
import type { Coordinate } from "@/types/map";
import { generateGPXString, parseGPXFile, processGPXWaypoints } from "./GPXService";
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
	waypoints: Waypoint[];
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

const routeHasValidShape = (waypoints: Waypoint[]): boolean =>
	waypoints.every((wp) => validateCoordinate(wp.coord).isValid);

const clearRouteState = ({ setRouteDistance, setRouteDuration, setHasRoute }: LoadRouteOptions) => {
	setCurrentRoutePath([]);
	setRouteDistance("");
	setRouteDuration("");
	setHasRoute(false);
};

const applyExactRoutePath = ({
	waypoints,
	exactRoutePath,
	setRouteDistance,
	setRouteDuration,
	setHasRoute,
}: LoadRouteOptions & { exactRoutePath: Coordinate[]; isMapLocked: boolean }) => {
	useRoutingStore.getState().setWaypoints(waypoints);
	setCurrentRoutePath(exactRoutePath);

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
		exactRoutePath,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
		saveSnapshot = false,
	} = options;
	const isMapLocked = options.isMapLocked ?? useRoutingStore.getState().isMapLocked;

	if (!routeHasValidShape(waypoints)) {
		return { success: false, message: "The route data is invalid or corrupted." };
	}

	const store = useRoutingStore.getState();

	if (saveSnapshot) {
		store.saveSnapshot();
	}

	store.setIsMapLocked(isMapLocked);

	clearRouteState({ ...options, isMapLocked });

	if (waypoints.length === 0) {
		store.clearWaypoints();
		return { success: true };
	}

	store.setWaypoints(waypoints);

	if (exactRoutePath && exactRoutePath.length >= 2) {
		applyExactRoutePath({ ...options, exactRoutePath, isMapLocked });
		return { success: true };
	}

	if (waypoints.length < 2) {
		return { success: true };
	}

	const routeResult = await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);

	if (!routeResult.success) {
		return { success: false, message: routeResult.error || "Failed to calculate the route." };
	}

	if (routeResult.waypointsSnapped && routeResult.snappedWaypoints) {
		store.setWaypoints(routeResult.snappedWaypoints);
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

	if (!parsed || !routeHasValidShape(parsed.waypoints)) {
		return {
			success: false,
			message: "Failed to read shared route data. The link may be invalid or corrupted.",
		};
	}

	return loadRouteIntoMap({
		map,
		accessToken,
		waypoints: parsed.waypoints,
		isMapLocked: parsed.isLocked,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
	});
};

export const loadApiRouteIntoMap = async (
	route: ApiRoute,
	options: Omit<LoadRouteOptions, "waypoints">,
): Promise<RouteIoResult> => {
	const waypoints: Waypoint[] = route.waypoints.map((wp) => ({
		coord: [wp.lng, wp.lat],
		type: wp.type === "direct" ? "direct" : "routed",
		...(wp.name ? { name: wp.name } : {}),
	}));

	return loadRouteIntoMap({ ...options, waypoints, saveSnapshot: true });
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

	if (parsed.error) return { success: false, message: parsed.error };

	if (!parsed.waypoints || parsed.waypoints.length === 0) {
		return { success: false, message: "No valid waypoints were found in the GPX file." };
	}

	if (parsed.trackPoints && parsed.trackPoints.length >= 2) {
		const waypoints: Waypoint[] = parsed.waypoints.map((coord) => ({ coord, type: "routed" }));
		return loadRouteIntoMap({
			map,
			accessToken,
			waypoints,
			exactRoutePath: parsed.trackPoints,
			setRouteDistance,
			setRouteDuration,
			setHasRoute,
			saveSnapshot: true,
		});
	}

	const processed = await processGPXWaypoints(parsed.waypoints, accessToken);

	if (processed.error || !processed.finalWaypoints) {
		return { success: false, message: processed.error || "Failed to import the GPX route." };
	}

	return loadRouteIntoMap({
		map,
		accessToken,
		waypoints: processed.finalWaypoints,
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
		return { success: false, message: "No route available to export." };
	}

	const effectiveRoutePath = routePath.length >= 2 ? routePath : waypoints.map((wp) => wp.coord);
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
		return { success: false, message: "Failed to export the GPX file." };
	} finally {
		URL.revokeObjectURL(objectUrl);
	}

	return { success: true };
};
