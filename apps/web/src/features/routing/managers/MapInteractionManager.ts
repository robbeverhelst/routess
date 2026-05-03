import type { Map as MapboxMap, MapLayerMouseEvent, MapMouseEvent, MapTouchEvent } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import {
	ROUTE_HOVER_LAYER_ID,
	ROUTE_LAYER_ID,
	ROUTE_SOURCE_ID,
	TEMP_DRAG_LINES_LAYER_ID,
	updateDragLinesLayer,
	WAYPOINTS_LAYER_ID,
} from "@/features/routing/managers/MapLayerManager";
import {
	addWaypoint,
	insertWaypointAtLocation,
	updateWaypointPositionAndRecalculate as updateWaypointPosition,
} from "@/features/routing/managers/WaypointManager";
import { Logger } from "@/lib/logger";
import { useRoutingStore } from "@/stores/routingStore";
import type { Coordinate } from "@/types/map";

export interface PopupInfo {
	longitude: number;
	latitude: number;
	type: "direct" | "remove" | "info" | "add_on_route";
	waypointIndex?: number;
	message?: string;
}

const LONG_PRESS_DURATION = 750;
const MAX_MOVE_THRESHOLD = 10;

type PointerPoint = { x: number; y: number };
type HitTarget = { kind: "waypoint"; index: number } | { kind: "route" } | { kind: "empty" };
type DragMode = "mouse" | "touch";

interface InteractionState {
	isDragging: boolean;
	draggedWaypointIndex: number;
	currentLngLat: Coordinate | null;
	longPressTimeoutId: number | null;
	touchStartPos: PointerPoint | null;
	currentLongPressId: number | null;
	hoveredRouteFeatureId: string | number | undefined;
}

const createInitialState = (): InteractionState => ({
	isDragging: false,
	draggedWaypointIndex: -1,
	currentLngLat: null,
	longPressTimeoutId: null,
	touchStartPos: null,
	currentLongPressId: null,
	hoveredRouteFeatureId: undefined,
});

const parseWaypointIndex = (rawIndex: unknown, waypointCount: number): number | null => {
	const index =
		typeof rawIndex === "string" ? Number.parseInt(rawIndex, 10) : typeof rawIndex === "number" ? rawIndex : Number.NaN;

	if (Number.isNaN(index) || index < 0 || index >= waypointCount) {
		return null;
	}

	return index;
};

const buildDragLineFeatures = (
	waypoints: ReturnType<typeof useRoutingStore.getState>["waypoints"],
	draggedWaypointIndex: number,
	currentLngLat: Coordinate | null,
): GeoJSON.Feature<GeoJSON.LineString>[] => {
	if (draggedWaypointIndex === -1 || !currentLngLat) {
		return [];
	}

	const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
	const previousWaypoint = waypoints[draggedWaypointIndex - 1];
	const nextWaypoint = waypoints[draggedWaypointIndex + 1];

	if (previousWaypoint) {
		features.push({
			type: "Feature",
			properties: {},
			geometry: { type: "LineString", coordinates: [previousWaypoint.coord, currentLngLat] },
		});
	}

	if (nextWaypoint) {
		features.push({
			type: "Feature",
			properties: {},
			geometry: { type: "LineString", coordinates: [currentLngLat, nextWaypoint.coord] },
		});
	}

	return features;
};

export const initializeMapInteractions = (
	map: MapboxMap,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
	setPopup: Dispatch<SetStateAction<PopupInfo | null>>,
	handleWaypointError: (message: string | null) => void,
	isMapLockedRef: { current: boolean },
): (() => void) => {
	const mapCanvas = map.getCanvas();
	const state = createInitialState();

	const resetLongPress = () => {
		if (state.longPressTimeoutId !== null) {
			clearTimeout(state.longPressTimeoutId);
			state.longPressTimeoutId = null;
		}
		state.touchStartPos = null;
		state.currentLongPressId = null;
	};

	const clearRouteHover = () => {
		mapCanvas.style.cursor = "";
		if (state.hoveredRouteFeatureId === "main_route_line" && map.getSource(ROUTE_SOURCE_ID)) {
			map.removeFeatureState({ source: ROUTE_SOURCE_ID, id: state.hoveredRouteFeatureId }, "hover");
		}
		state.hoveredRouteFeatureId = undefined;
	};

	const resetDragState = () => {
		state.isDragging = false;
		state.draggedWaypointIndex = -1;
		state.currentLngLat = null;
		updateDragLinesLayer(map, []);
		mapCanvas.style.cursor = "";
		map.dragPan.enable();
		map.touchZoomRotate.enable();
	};

	const getEventPoint = (event: MapMouseEvent | MapTouchEvent): PointerPoint | null => {
		if ("point" in event) {
			return event.point;
		}
		if ("points" in event && event.points.length > 0) {
			return event.points[0];
		}
		return null;
	};

	const getHitTarget = (point: PointerPoint): HitTarget => {
		const waypointFeature = map.queryRenderedFeatures([point.x, point.y], {
			layers: [WAYPOINTS_LAYER_ID],
		})[0];

		if (waypointFeature) {
			const waypointIndex = parseWaypointIndex(
				waypointFeature.properties?.waypointIndex,
				useRoutingStore.getState().waypoints.length,
			);
			if (waypointIndex !== null) {
				return { kind: "waypoint", index: waypointIndex };
			}

			Logger.error(
				"[MapInteractionManager] Invalid waypoint index on feature query:",
				waypointFeature.properties?.waypointIndex,
			);
			return { kind: "empty" };
		}

		const routeFeatures = map.queryRenderedFeatures([point.x, point.y], {
			layers: [ROUTE_HOVER_LAYER_ID, ROUTE_LAYER_ID],
		});
		if (routeFeatures.length > 0 && useRoutingStore.getState().waypoints.length >= 1) {
			return { kind: "route" };
		}

		return { kind: "empty" };
	};

	const getPopupInfo = (lngLat: { lng: number; lat: number }, point: PointerPoint): PopupInfo => {
		const hitTarget = getHitTarget(point);
		if (hitTarget.kind === "waypoint") {
			return {
				longitude: lngLat.lng,
				latitude: lngLat.lat,
				type: "remove",
				waypointIndex: hitTarget.index,
			};
		}

		if (hitTarget.kind === "route") {
			return {
				longitude: lngLat.lng,
				latitude: lngLat.lat,
				type: "add_on_route",
			};
		}

		return {
			longitude: lngLat.lng,
			latitude: lngLat.lat,
			type: "direct",
		};
	};

	const startDrag = (index: number, startCoord: Coordinate, mode: DragMode) => {
		state.isDragging = true;
		state.draggedWaypointIndex = index;
		state.currentLngLat = [...startCoord] as Coordinate;
		map.dragPan.disable();
		if (mode === "touch") {
			map.touchZoomRotate.disable();
		}
		mapCanvas.style.cursor = "grabbing";
		clearRouteHover();
		setPopup(null);
	};

	const renderDragPreview = (nextCoord: Coordinate) => {
		state.currentLngLat = nextCoord;
		const dragLineFeatures = buildDragLineFeatures(
			useRoutingStore.getState().waypoints,
			state.draggedWaypointIndex,
			state.currentLngLat,
		);
		updateDragLinesLayer(map, dragLineFeatures);
	};

	const commitDrag = async () => {
		if (!state.isDragging || state.draggedWaypointIndex === -1 || !state.currentLngLat) {
			resetDragState();
			return;
		}

		const waypointIndex = state.draggedWaypointIndex;
		const nextCoord = [...state.currentLngLat] as Coordinate;

		try {
			await updateWaypointPosition(
				map,
				waypointIndex,
				nextCoord,
				accessToken,
				setRouteDistance,
				setRouteDuration,
				setHasRoute,
				handleWaypointError,
				isMapLockedRef.current,
			);
		} finally {
			resetDragState();
		}
	};

	const insertAndStartDrag = async (coord: Coordinate, mode: DragMode) => {
		const result = await insertWaypointAtLocation(
			map,
			coord,
			accessToken,
			setRouteDistance,
			setRouteDuration,
			setHasRoute,
			handleWaypointError,
			isMapLockedRef.current,
			{ skipRouteCalcAndSnapshot: true },
		);

		if (!result.success || typeof result.newIndex !== "number") {
			Logger.warn("[MapInteractionManager] Failed to insert waypoint on route for dragging.", result.error);
			return;
		}

		const insertedWaypoint = useRoutingStore.getState().waypoints[result.newIndex];
		startDrag(result.newIndex, insertedWaypoint ? insertedWaypoint.coord : coord, mode);
	};

	const scheduleLongPress = (lngLat: { lng: number; lat: number }, point: PointerPoint) => {
		resetLongPress();
		state.touchStartPos = point;
		const pressId = Date.now();
		state.currentLongPressId = pressId;
		state.longPressTimeoutId = window.setTimeout(() => {
			if (state.currentLongPressId === pressId && state.touchStartPos) {
				setPopup(getPopupInfo(lngLat, state.touchStartPos));
			}
			state.longPressTimeoutId = null;
		}, LONG_PRESS_DURATION);
	};

	const handleMapClick = async (event: MapMouseEvent) => {
		if (isMapLockedRef.current) return;
		resetLongPress();

		if (event.defaultPrevented) {
			Logger.info("[MapInteractionManager] Click event default prevented, likely due to drag. Ignoring.");
			return;
		}

		const features = map.queryRenderedFeatures(event.point, {
			layers: [WAYPOINTS_LAYER_ID, ROUTE_LAYER_ID, TEMP_DRAG_LINES_LAYER_ID, ROUTE_HOVER_LAYER_ID],
		});
		if (features.length > 0) {
			setPopup(null);
			return;
		}

		setPopup(null);
		const success = await addWaypoint(
			map,
			[event.lngLat.lng, event.lngLat.lat],
			"routed",
			accessToken,
			setRouteDistance,
			setRouteDuration,
			setHasRoute,
			handleWaypointError,
			isMapLockedRef.current,
		);

		if (!success) {
			Logger.warn("[MapInteractionManager] Waypoint addition failed - action cancelled");
		}
	};

	const handleContextMenu = (event: MapMouseEvent | MapTouchEvent) => {
		if (isMapLockedRef.current) return;

		const point = getEventPoint(event);
		if (!point) {
			Logger.error("[MapInteractionManager] Could not determine event point for context menu.");
			return;
		}

		event.preventDefault();
		setPopup(getPopupInfo(event.lngLat, point));
	};

	const handleMouseDown = async (event: MapMouseEvent) => {
		if (isMapLockedRef.current || event.originalEvent.button !== 0) return;

		const hitTarget = getHitTarget(event.point);
		if (hitTarget.kind === "empty") {
			return;
		}

		event.preventDefault();
		if (hitTarget.kind === "waypoint") {
			startDrag(hitTarget.index, [event.lngLat.lng, event.lngLat.lat], "mouse");
			return;
		}

		await insertAndStartDrag([event.lngLat.lng, event.lngLat.lat], "mouse");
	};

	const handleTouchStart = async (event: MapTouchEvent) => {
		if (isMapLockedRef.current || event.points.length !== 1) return;

		const point = event.points[0];
		const hitTarget = getHitTarget(point);

		if (hitTarget.kind === "waypoint") {
			event.preventDefault();
			startDrag(hitTarget.index, [event.lngLat.lng, event.lngLat.lat], "touch");
			return;
		}

		if (hitTarget.kind === "route") {
			event.preventDefault();
			await insertAndStartDrag([event.lngLat.lng, event.lngLat.lat], "touch");
			return;
		}

		scheduleLongPress({ lng: event.lngLat.lng, lat: event.lngLat.lat }, point);
	};

	const handleMouseMove = (event: MapMouseEvent) => {
		if (isMapLockedRef.current || !state.isDragging) return;

		event.preventDefault();
		renderDragPreview([event.lngLat.lng, event.lngLat.lat]);
	};

	const handleWindowMouseUp = async () => {
		if (isMapLockedRef.current || !state.isDragging) return;
		await commitDrag();
	};

	const handleTouchMove = (event: MapTouchEvent) => {
		if (isMapLockedRef.current) return;

		if (state.isDragging) {
			if (event.points.length !== 1) {
				resetDragState();
				return;
			}

			event.preventDefault();
			renderDragPreview([event.lngLat.lng, event.lngLat.lat]);
			return;
		}

		if (!state.touchStartPos || state.longPressTimeoutId === null) {
			return;
		}

		if (event.points.length !== 1) {
			resetLongPress();
			return;
		}

		const currentPoint = event.points[0];
		const deltaX = Math.abs(currentPoint.x - state.touchStartPos.x);
		const deltaY = Math.abs(currentPoint.y - state.touchStartPos.y);
		if (deltaX > MAX_MOVE_THRESHOLD || deltaY > MAX_MOVE_THRESHOLD) {
			resetLongPress();
		}
	};

	const handleTouchEnd = async () => {
		resetLongPress();
		if (!state.isDragging) {
			map.dragPan.enable();
			map.touchZoomRotate.enable();
			mapCanvas.style.cursor = "";
			return;
		}

		await commitDrag();
	};

	const handleRouteMouseEnter = (event: MapLayerMouseEvent) => {
		if (isMapLockedRef.current || state.isDragging) return;
		if (map.dragPan.isActive() || event.originalEvent.buttons !== 0) return;

		const feature = event.features?.[0];
		const currentFeatureId = feature?.id ?? "main_route_line";
		if (feature?.source !== ROUTE_SOURCE_ID || currentFeatureId !== "main_route_line") {
			return;
		}

		mapCanvas.style.cursor = "pointer";
		if (state.hoveredRouteFeatureId === currentFeatureId) {
			return;
		}

		clearRouteHover();
		state.hoveredRouteFeatureId = currentFeatureId;
		map.setFeatureState({ source: ROUTE_SOURCE_ID, id: currentFeatureId }, { hover: true });
	};

	const handleRouteMouseLeave = () => {
		if (isMapLockedRef.current) return;
		clearRouteHover();
	};

	map.on("click", handleMapClick);
	map.on("contextmenu", handleContextMenu);
	map.on("mousedown", handleMouseDown);
	map.on("mousemove", handleMouseMove);
	map.on("touchstart", handleTouchStart);
	map.on("touchmove", handleTouchMove);
	map.on("touchend", handleTouchEnd);
	map.on("touchcancel", handleTouchEnd);
	map.on("mouseenter", ROUTE_LAYER_ID, handleRouteMouseEnter);
	map.on("mouseleave", ROUTE_LAYER_ID, handleRouteMouseLeave);
	window.addEventListener("mouseup", handleWindowMouseUp);

	return () => {
		Logger.info("[MapInteractionManager] Disposing map interaction listeners.");
		map.off("click", handleMapClick);
		map.off("contextmenu", handleContextMenu);
		map.off("mousedown", handleMouseDown);
		map.off("mousemove", handleMouseMove);
		map.off("touchstart", handleTouchStart);
		map.off("touchmove", handleTouchMove);
		map.off("touchend", handleTouchEnd);
		map.off("touchcancel", handleTouchEnd);
		map.off("mouseenter", ROUTE_LAYER_ID, handleRouteMouseEnter);
		map.off("mouseleave", ROUTE_LAYER_ID, handleRouteMouseLeave);
		window.removeEventListener("mouseup", handleWindowMouseUp);
		resetLongPress();
		clearRouteHover();
		resetDragState();
	};
};
