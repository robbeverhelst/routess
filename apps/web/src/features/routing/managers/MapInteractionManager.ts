import type { Map as MapboxMap, MapLayerMouseEvent, MapMouseEvent, MapTouchEvent, PointLike } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import { consumeMapPick } from "@/features/map/mapPick";
// Dispatch/SetStateAction kept for setPopup which is still a React setter.
import {
	animateWaypointSpawn,
	ROUTE_HOVER_LAYER_ID,
	ROUTE_LAYER_ID,
	ROUTE_SOURCE_ID,
	setLiftedWaypoint,
	TEMP_DRAG_LINES_LAYER_ID,
	updateDragLinesLayer,
	WAYPOINTS_LAYER_ID,
} from "@/features/routing/managers/MapLayerManager";
import type { RouteDraftEditor } from "@/features/routing/RouteDraftEditor";
import { Logger } from "@/lib/logger";
import { useRoutingStore } from "@/stores/routingStore";
import { useUiStore } from "@/stores/uiStore";
import { useWaypointDragStore } from "@/stores/waypointDragStore";
import { useWaypointHoverStore } from "@/stores/waypointHoverStore";
import type { Coordinate } from "@/types/map";

export interface PopupInfo {
	longitude: number;
	latitude: number;
	type: "direct" | "remove" | "info" | "add_on_route";
	waypointIndex?: number;
	message?: string;
}

// Touch grammar (see ADR-0028): tap = actions, long-press = grab. Mouse keeps
// its own grammar (mousedown-drag, right-click popup) and is unchanged.
const LONG_PRESS_DURATION = 500;
const MAX_MOVE_THRESHOLD = 10;
// Fingers are imprecise: hit-test a padded box instead of a single pixel so a
// tap that misses a waypoint by a few px doesn't read as "empty map".
const TOUCH_HIT_PADDING = 12;
// Ignore taps right after a pinch so a sloppy two-finger gesture never adds a
// waypoint via the click Mapbox synthesizes for the last finger.
const GESTURE_COOLDOWN_MS = 300;
// Browsers fire compatibility mouse events (mousedown/mouseup/click) right
// after a tap's touchend. Ignore mouse input this soon after touch so the
// mouse drag path can't hijack a tap; otherwise its startDrag dismisses the
// delete popup the tap just opened.
const TOUCH_MOUSE_SUPPRESS_MS = 700;

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

// One finger-down-to-finger-up episode. Resolves into exactly one of: tap
// (quick release), long-press (held still), or pan (moved — session cleared).
interface TouchSession {
	startPoint: PointerPoint;
	startLngLat: Coordinate;
	target: HitTarget;
	longPressTimeoutId: number | null;
	longPressFired: boolean;
}

interface InteractionState {
	isDragging: boolean;
	draggedWaypointIndex: number;
	currentLngLat: Coordinate | null;
	dragMoved: boolean;
	dragWasInserted: boolean;
	dragMode: DragMode | null;
	touchSession: TouchSession | null;
	lastMultiTouchAt: number;
	lastTouchAt: number;
	hoveredRouteFeatureId: string | number | undefined;
	suppressNextClick: boolean;
}

const createInitialState = (): InteractionState => ({
	isDragging: false,
	draggedWaypointIndex: -1,
	currentLngLat: null,
	dragMoved: false,
	dragWasInserted: false,
	dragMode: null,
	touchSession: null,
	lastMultiTouchAt: 0,
	lastTouchAt: 0,
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
	popupRef: { current: PopupInfo | null },
): (() => void) => {
	const mapCanvas = map.getCanvas();
	const state = createInitialState();

	const clearTouchSession = () => {
		const session = state.touchSession;
		if (session?.longPressTimeoutId != null) {
			clearTimeout(session.longPressTimeoutId);
			session.longPressTimeoutId = null;
		}
		state.touchSession = null;
	};

	const clearRouteHover = () => {
		mapCanvas.style.cursor = "";
		if (state.hoveredRouteFeatureId === "main_route_line" && map.getSource(ROUTE_SOURCE_ID)) {
			map.removeFeatureState({ source: ROUTE_SOURCE_ID, id: state.hoveredRouteFeatureId }, "hover");
		}
		state.hoveredRouteFeatureId = undefined;
	};

	const resetDragState = () => {
		if (state.draggedWaypointIndex !== -1 && state.dragMode === "touch") {
			setLiftedWaypoint(map, state.draggedWaypointIndex, null);
		}
		state.isDragging = false;
		state.draggedWaypointIndex = -1;
		state.currentLngLat = null;
		state.dragMoved = false;
		state.dragWasInserted = false;
		state.dragMode = null;
		updateDragLinesLayer(map, []);
		useWaypointDragStore.getState().endTouchDrag();
		mapCanvas.style.cursor = "";
		map.dragPan.enable();
		map.touchZoomRotate.enable();
	};

	// DOM overlays (the popup is a Marker inside Mapbox's canvas container)
	// bubble their pointer events into the map's handlers, and React's
	// delegated stopPropagation runs too late to stop that. Events whose
	// real target isn't the canvas belong to the overlay: without this
	// guard, a tap on the popup's delete button is read as "tap with popup
	// open", which dismisses the popup before its click can fire.
	const isOverlayEvent = (event: MapMouseEvent | MapTouchEvent): boolean => {
		const target = event.originalEvent?.target;
		return target instanceof Node && target !== mapCanvas;
	};

	const getEventPoint = (event: MapMouseEvent | MapTouchEvent): PointerPoint | null => {
		// Both MapMouseEvent and MapTouchEvent carry `point` (for touch it is the
		// centroid), so there is no second shape to fall back to.
		return event.point ?? null;
	};

	const getHitTarget = (point: PointerPoint, padding = 0): HitTarget => {
		const queryGeometry: PointLike | [PointLike, PointLike] =
			padding > 0
				? [
						[point.x - padding, point.y - padding],
						[point.x + padding, point.y + padding],
					]
				: [point.x, point.y];

		const waypointFeatures = map.queryRenderedFeatures(queryGeometry, {
			layers: [WAYPOINTS_LAYER_ID],
		});
		const waypointCount = useRoutingStore.getState().waypoints.length;

		// The padded box can cover several waypoints; pick the one closest to
		// the actual pointer position.
		let nearest: { index: number; distance: number } | null = null;
		for (const feature of waypointFeatures) {
			const index = parseWaypointIndex(feature.properties?.waypointIndex, waypointCount);
			if (index === null) {
				Logger.error(
					"[MapInteractionManager] Invalid waypoint index on feature query:",
					feature.properties?.waypointIndex,
				);
				continue;
			}
			const coords = (feature.geometry as GeoJSON.Point).coordinates;
			const projected = map.project([coords[0], coords[1]]);
			const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
			if (!nearest || distance < nearest.distance) {
				nearest = { index, distance };
			}
		}
		if (nearest) {
			return { kind: "waypoint", index: nearest.index };
		}

		const routeFeatures = map.queryRenderedFeatures(queryGeometry, {
			layers: [ROUTE_HOVER_LAYER_ID, ROUTE_LAYER_ID],
		});
		if (routeFeatures.length > 0 && waypointCount >= 1) {
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
		state.dragMoved = false;
		state.dragMode = mode;
		map.dragPan.disable();
		if (mode === "touch") {
			map.touchZoomRotate.disable();
			// Visual lift: the marker grows so the grab is acknowledged.
			setLiftedWaypoint(map, null, index);
			// Shows the drop-to-delete trash zone overlay.
			useWaypointDragStore.getState().startTouchDrag();
		}
		mapCanvas.style.cursor = "grabbing";
		clearRouteHover();
		setPopup(null);
	};

	// Tracks whether the dragged finger is over the trash drop zone (rect is
	// registered in client coords by the WaypointDragTrash overlay).
	const updateTrashHover = (point: PointerPoint) => {
		const dragStore = useWaypointDragStore.getState();
		const rect = dragStore.trashRect;
		if (!rect) {
			if (dragStore.isOverTrash) dragStore.setOverTrash(false);
			return;
		}
		const canvasRect = mapCanvas.getBoundingClientRect();
		const clientX = canvasRect.left + point.x;
		const clientY = canvasRect.top + point.y;
		const over = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
		if (over !== dragStore.isOverTrash) {
			dragStore.setOverTrash(over);
		}
	};

	const renderDragPreview = (nextCoord: Coordinate) => {
		state.currentLngLat = nextCoord;
		state.dragMoved = true;
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

		// Dropped on the trash zone: delete instead of moving. For a waypoint
		// inserted for this drag, reverting the insert is the deletion.
		if (state.dragMode === "touch" && useWaypointDragStore.getState().isOverTrash) {
			const wasInserted = state.dragWasInserted;
			const waypointIndex = state.draggedWaypointIndex;
			resetDragState();
			if (wasInserted) {
				await editor.undo();
			} else {
				await editor.removeWaypoint(waypointIndex);
			}
			return;
		}

		// Releasing without moving an existing waypoint: nothing to commit.
		// A just-inserted waypoint still needs the recompute its insert skipped.
		if (!state.dragMoved && !state.dragWasInserted) {
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

	// Abort a drag without dropping. If the dragged waypoint was inserted for
	// this drag, revert the insert too (it never had its route computed).
	const cancelDrag = async () => {
		const undoInsert = state.dragWasInserted;
		resetDragState();
		if (undoInsert) {
			await editor.undo();
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
		state.dragWasInserted = true;
	};

	// Long-press resolved: grab what's under the finger, or offer the direct
	// waypoint popup on empty map.
	const fireLongPress = async (session: TouchSession) => {
		// The click Mapbox synthesizes after the eventual touchend must not
		// add a waypoint or dismiss the popup this gesture produced.
		state.suppressNextClick = true;

		if (session.target.kind === "waypoint") {
			const waypoint = useRoutingStore.getState().waypoints[session.target.index];
			startDrag(session.target.index, waypoint ? waypoint.coord : session.startLngLat, "touch");
			return;
		}

		if (session.target.kind === "route") {
			const result = await editor.insertWaypointOnRoute(session.startLngLat, { skipRouteCalc: true });
			if (!result.success || typeof result.newIndex !== "number") {
				Logger.warn("[MapInteractionManager] Failed to insert waypoint on route for dragging.", result.message);
				return;
			}
			if (state.touchSession !== session) {
				// Finger lifted while the insert was in flight; revert it.
				await editor.undo();
				return;
			}
			const insertedWaypoint = useRoutingStore.getState().waypoints[result.newIndex];
			startDrag(result.newIndex, insertedWaypoint ? insertedWaypoint.coord : session.startLngLat, "touch");
			state.dragWasInserted = true;
			return;
		}

		setPopup({
			longitude: session.startLngLat[0],
			latitude: session.startLngLat[1],
			type: "direct",
		});
	};

	// Quick release without movement. Taps only ever act on one thing:
	// dismiss an open popup, open a waypoint's popup, or (via the synthesized
	// click) add a waypoint on empty map.
	const handleTouchTap = (session: TouchSession) => {
		if (popupRef.current !== null) {
			state.suppressNextClick = true;
			setPopup(null);
			return;
		}

		if (session.target.kind === "waypoint") {
			state.suppressNextClick = true;
			const waypoint = useRoutingStore.getState().waypoints[session.target.index];
			setPopup({
				longitude: waypoint ? waypoint.coord[0] : session.startLngLat[0],
				latitude: waypoint ? waypoint.coord[1] : session.startLngLat[1],
				type: "remove",
				waypointIndex: session.target.index,
			});
			return;
		}

		if (session.target.kind === "route") {
			// Inserting on the route goes through long-press; a tap is inert.
			state.suppressNextClick = true;
			return;
		}

		if (Date.now() - state.lastMultiTouchAt < GESTURE_COOLDOWN_MS) {
			state.suppressNextClick = true;
		}
	};

	const handleMapClick = async (event: MapMouseEvent) => {
		if (isMapLockedRef.current || isOverlayEvent(event)) return;

		// Discover is a browsing surface: clicks belong to its markers/popups,
		// never to the planner's add-waypoint grammar.
		if (useUiStore.getState().context === "discover") return;

		if (state.suppressNextClick) {
			state.suppressNextClick = false;
			return;
		}

		if (event.defaultPrevented) {
			Logger.info("[MapInteractionManager] Click event default prevented, likely due to drag. Ignoring.");
			return;
		}

		// A pending one-shot pick (e.g. "choose the loop start") wins over the
		// normal add-waypoint grammar.
		if (consumeMapPick([event.lngLat.lng, event.lngLat.lat])) return;

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
			return;
		}

		animateWaypointSpawn(map, useRoutingStore.getState().waypoints.length - 1);
	};

	const handleContextMenu = (event: MapMouseEvent | MapTouchEvent) => {
		if (isMapLockedRef.current || isOverlayEvent(event)) return;
		// Android fires contextmenu on long-press; the touch session owns
		// that gesture, so only honor contextmenu for real right-clicks.
		if (state.touchSession || state.isDragging) return;

		const point = getEventPoint(event);
		if (!point) {
			Logger.error("[MapInteractionManager] Could not determine event point for context menu.");
			return;
		}

		event.preventDefault();
		setPopup(getPopupInfo(event.lngLat, point));
	};

	const handleMouseDown = async (event: MapMouseEvent) => {
		if (isMapLockedRef.current || event.originalEvent.button !== 0 || isOverlayEvent(event)) return;
		// Compatibility mouse event synthesized from a recent touch: the
		// touch handlers already resolved this gesture.
		if (Date.now() - state.lastTouchAt < TOUCH_MOUSE_SUPPRESS_MS) return;

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

	const handleTouchStart = (event: MapTouchEvent) => {
		if (isMapLockedRef.current) return;
		state.lastTouchAt = Date.now();
		// A touch starting on the popup is the popup's gesture; creating a
		// session here would dismiss it on touchend before its button fires.
		if (isOverlayEvent(event)) return;

		if (event.points.length !== 1) {
			state.lastMultiTouchAt = Date.now();
			clearTouchSession();
			if (state.isDragging) {
				void cancelDrag();
			}
			return;
		}

		state.suppressNextClick = false;

		// Note: no preventDefault and no drag here. The finger may be about
		// to pan the map even if it landed on a waypoint; only a completed
		// long-press grabs.
		const point = event.points[0];
		const session: TouchSession = {
			startPoint: point,
			startLngLat: wrappedLngLat(event.lngLat),
			target: getHitTarget(point, TOUCH_HIT_PADDING),
			longPressTimeoutId: null,
			longPressFired: false,
		};
		state.touchSession = session;
		session.longPressTimeoutId = window.setTimeout(() => {
			session.longPressTimeoutId = null;
			if (state.touchSession !== session) return;
			session.longPressFired = true;
			void fireLongPress(session);
		}, LONG_PRESS_DURATION);
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
		state.lastTouchAt = Date.now();

		if (event.points.length !== 1) {
			state.lastMultiTouchAt = Date.now();
			clearTouchSession();
			if (state.isDragging) {
				void cancelDrag();
			}
			return;
		}

		if (state.isDragging) {
			event.preventDefault();
			renderDragPreview(wrappedLngLat(event.lngLat));
			updateTrashHover(event.points[0]);
			return;
		}

		const session = state.touchSession;
		if (!session) return;

		const currentPoint = event.points[0];
		const deltaX = Math.abs(currentPoint.x - session.startPoint.x);
		const deltaY = Math.abs(currentPoint.y - session.startPoint.y);
		if (deltaX > MAX_MOVE_THRESHOLD || deltaY > MAX_MOVE_THRESHOLD) {
			// The finger is panning the map. Mapbox can still synthesize a
			// click for a small pan; swallow it so it never adds a waypoint.
			state.suppressNextClick = true;
			clearTouchSession();
		}
	};

	const handleTouchEnd = async () => {
		state.lastTouchAt = Date.now();
		const session = state.touchSession;
		clearTouchSession();

		if (state.isDragging) {
			state.suppressNextClick = true;
			await commitDrag();
			return;
		}

		mapCanvas.style.cursor = "";
		map.dragPan.enable();
		map.touchZoomRotate.enable();

		if (!session || session.longPressFired) return;
		handleTouchTap(session);
	};

	const handleTouchCancel = () => {
		state.lastTouchAt = Date.now();
		clearTouchSession();
		if (state.isDragging) {
			void cancelDrag();
			return;
		}
		mapCanvas.style.cursor = "";
		map.dragPan.enable();
		map.touchZoomRotate.enable();
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
	map.on("touchcancel", handleTouchCancel);
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
		map.off("touchcancel", handleTouchCancel);
		map.off("mouseenter", ROUTE_LAYER_ID, handleRouteMouseEnter);
		map.off("mouseleave", ROUTE_LAYER_ID, handleRouteMouseLeave);
		map.off("mouseenter", WAYPOINTS_LAYER_ID, handleWaypointMouseEnter);
		map.off("mousemove", WAYPOINTS_LAYER_ID, handleWaypointMouseMove);
		map.off("mouseleave", WAYPOINTS_LAYER_ID, handleWaypointMouseLeave);
		window.removeEventListener("mouseup", handleWindowMouseUp);
		useWaypointHoverStore.getState().clearHover();
		clearTouchSession();
		clearRouteHover();
		resetDragState();
	};
};
