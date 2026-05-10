import type { Map as MapboxMap, MapLayerMouseEvent, MapMouseEvent, MapTouchEvent } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
// Dispatch/SetStateAction kept for setPopup which is still a React setter.
import {
	ROUTE_HOVER_LAYER_ID,
	ROUTE_LAYER_ID,
	ROUTE_SOURCE_ID,
	TEMP_DRAG_LINES_LAYER_ID,
	updateDragLinesLayer,
	WAYPOINTS_LAYER_ID,
} from "@/features/routing/managers/MapLayerManager";
import type { RouteDraftEditor } from "@/features/routing/RouteDraftEditor";
import { Logger } from "@/lib/logger";
import { useRoutingStore } from "@/stores/routingStore";
import { useWaypointHoverStore } from "@/stores/waypointHoverStore";
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

// Mapbox doesn't auto-wrap event.lngLat — panning the world east a few
// times yields lng > 180, which the Directions API rejects with 422.
// Normalize before any coord leaves this manager.
const wrappedLngLat = (lngLat: { lng: number; lat: number }): Coordinate => {
	const wrappedLng = ((((lngLat.lng + 180) % 360) + 360) % 360) - 180;
	return [wrappedLng, lngLat.lat];
};

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
	suppressNextClick: boolean;
}

const createInitialState = (): InteractionState => ({
	isDragging: false,
	draggedWaypointIndex: -1,
	currentLngLat: null,
	longPressTimeoutId: null,
	touchStartPos: null,
	currentLongPressId: null,
	hoveredRouteFeatureId: undefined,
	suppressNextClick: false,
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
	editor: RouteDraftEditor,
	setPopup: Dispatch<SetStateAction<PopupInfo | null>>,
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
			await editor.moveWaypoint(waypointIndex, nextCoord);
		} finally {
			resetDragState();
		}
	};

	const insertAndStartDrag = async (coord: Coordinate, mode: DragMode) => {
		const result = await editor.insertWaypointOnRoute(coord, { skipRouteCalc: true });

		if (!result.success || typeof result.newIndex !== "number") {
			Logger.warn("[MapInteractionManager] Failed to insert waypoint on route for dragging.", result.message);
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
				// Touch end after a long-press can synthesize a click on the
				// canvas. Swallow that one click so we don't add a stray
				// `routed` waypoint at the spot the user opened the popup.
				state.suppressNextClick = true;
			}
			state.longPressTimeoutId = null;
		}, LONG_PRESS_DURATION);
	};

	const handleMapClick = async (event: MapMouseEvent) => {
		if (isMapLockedRef.current) return;
		resetLongPress();

		if (state.suppressNextClick) {
			state.suppressNextClick = false;
			return;
		}

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
		const result = await editor.addWaypoint(wrappedLngLat(event.lngLat), "routed");

		if (!result.success) {
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

		state.suppressNextClick = false;

		const hitTarget = getHitTarget(event.point);
		if (hitTarget.kind === "empty") {
			return;
		}

		event.preventDefault();
		if (hitTarget.kind === "waypoint") {
			startDrag(hitTarget.index, wrappedLngLat(event.lngLat), "mouse");
			return;
		}

		await insertAndStartDrag(wrappedLngLat(event.lngLat), "mouse");
	};

	const handleTouchStart = async (event: MapTouchEvent) => {
		if (isMapLockedRef.current || event.points.length !== 1) return;

		state.suppressNextClick = false;

		const point = event.points[0];
		const hitTarget = getHitTarget(point);

		if (hitTarget.kind === "waypoint") {
			event.preventDefault();
			startDrag(hitTarget.index, wrappedLngLat(event.lngLat), "touch");
			return;
		}

		if (hitTarget.kind === "route") {
			event.preventDefault();
			await insertAndStartDrag(wrappedLngLat(event.lngLat), "touch");
			return;
		}

		scheduleLongPress({ lng: event.lngLat.lng, lat: event.lngLat.lat }, point);
	};

	const handleMouseMove = (event: MapMouseEvent) => {
		if (isMapLockedRef.current || !state.isDragging) return;

		event.preventDefault();
		renderDragPreview(wrappedLngLat(event.lngLat));
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
			renderDragPreview(wrappedLngLat(event.lngLat));
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

	// Pulls the hovered waypoint index from a layer-bound event's preloaded
	// `features` array. Avoids calling queryRenderedFeatures, which throws
	// "The layer 'points' does not exist" if a style swap has briefly torn
	// the layer down.
	const setWaypointHoverFromEvent = (event: MapLayerMouseEvent) => {
		if (state.isDragging) return;
		const feature = event.features?.[0];
		const index = feature
			? parseWaypointIndex(feature.properties?.waypointIndex, useRoutingStore.getState().waypoints.length)
			: null;
		const current = useWaypointHoverStore.getState().hoveredWaypointIndex;
		if (current !== index) {
			useWaypointHoverStore.getState().setHover(index);
		}
	};

	const handleWaypointMouseEnter = (event: MapLayerMouseEvent) => {
		if (isMapLockedRef.current || state.isDragging) return;
		mapCanvas.style.cursor = "pointer";
		setWaypointHoverFromEvent(event);
	};

	const handleWaypointMouseMove = (event: MapLayerMouseEvent) => {
		if (isMapLockedRef.current || state.isDragging) return;
		setWaypointHoverFromEvent(event);
	};

	const handleWaypointMouseLeave = () => {
		if (useWaypointHoverStore.getState().hoveredWaypointIndex !== null) {
			useWaypointHoverStore.getState().clearHover();
		}
		if (!state.isDragging && state.hoveredRouteFeatureId === undefined) {
			mapCanvas.style.cursor = "";
		}
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
	map.on("mouseenter", WAYPOINTS_LAYER_ID, handleWaypointMouseEnter);
	map.on("mousemove", WAYPOINTS_LAYER_ID, handleWaypointMouseMove);
	map.on("mouseleave", WAYPOINTS_LAYER_ID, handleWaypointMouseLeave);
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
		map.off("mouseenter", WAYPOINTS_LAYER_ID, handleWaypointMouseEnter);
		map.off("mousemove", WAYPOINTS_LAYER_ID, handleWaypointMouseMove);
		map.off("mouseleave", WAYPOINTS_LAYER_ID, handleWaypointMouseLeave);
		window.removeEventListener("mouseup", handleWindowMouseUp);
		useWaypointHoverStore.getState().clearHover();
		resetLongPress();
		clearRouteHover();
		resetDragState();
	};
};
