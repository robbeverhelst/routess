import type { Map as MapboxMap } from "mapbox-gl";
import { useCallback } from "react";
import type { PopupInfo as MapPopupInfo } from "@/features/routing/managers/MapInteractionManager";
import {
	addWaypoint,
	insertWaypointAtLocation,
	redoRouteChange,
	removeWaypoint,
	resetRoute,
	reverseRoute,
	undoRouteChange,
} from "@/features/routing/managers/WaypointManager";
import { getCurrentRoutePath } from "@/features/routing/services/RouteCalculationService";
import { zoomToRoute } from "@/features/routing/utils/RoutingUtils";
import { Logger } from "@/lib/logger";
import { serializeAndCompress } from "@/lib/shareUtils";
import { useRoutingStore } from "@/stores/routingStore";

interface UseRouteActionsProps {
	mapRef: React.RefObject<MapboxMap | null>;
	mapboxToken: string;
	hasRoute: boolean;
	popup: MapPopupInfo | null;
	setPopup: React.Dispatch<React.SetStateAction<MapPopupInfo | null>>;
	setRouteDistance: React.Dispatch<React.SetStateAction<string>>;
	setRouteDuration: React.Dispatch<React.SetStateAction<string>>;
	setHasRoute: React.Dispatch<React.SetStateAction<boolean>>;
	handleWaypointError: (message: string | null) => void;
	handleRouteInfoError: (message: string) => void;
	clearShareState: () => void;
	setShareNotification: React.Dispatch<React.SetStateAction<string>>;
}

/* eslint-disable react-hooks/exhaustive-deps */
export const useRouteActions = ({
	mapRef,
	mapboxToken,
	hasRoute,
	popup,
	setPopup,
	setRouteDistance,
	setRouteDuration,
	setHasRoute,
	handleWaypointError,
	handleRouteInfoError,
	clearShareState,
	setShareNotification,
}: UseRouteActionsProps) => {
	// Undo handler
	const handleUndo = useCallback(async () => {
		if (!mapRef.current || !mapboxToken) return;
		await undoRouteChange(mapRef.current, mapboxToken, setRouteDistance, setRouteDuration, setHasRoute);
	}, [mapboxToken, setRouteDistance, setRouteDuration, setHasRoute, mapRef]);

	// Redo handler
	const handleRedo = useCallback(async () => {
		if (!mapRef.current || !mapboxToken) return;
		await redoRouteChange(mapRef.current, mapboxToken, setRouteDistance, setRouteDuration, setHasRoute);
	}, [mapboxToken, setRouteDistance, setRouteDuration, setHasRoute, mapRef]);

	// Reverse route handler
	const handleReverseRoute = useCallback(async () => {
		if (!mapRef.current || !mapboxToken) return;
		await reverseRoute(mapRef.current, mapboxToken, setRouteDistance, setRouteDuration, setHasRoute);
	}, [mapboxToken, setRouteDistance, setRouteDuration, setHasRoute, mapRef]);

	// Reset handler
	const handleReset = useCallback(async () => {
		if (!mapRef.current || !mapboxToken) return;
		await resetRoute(mapRef.current, mapboxToken, setRouteDistance, setRouteDuration, setHasRoute);
	}, [mapboxToken, setRouteDistance, setRouteDuration, setHasRoute, mapRef]);

	// Select location handler - moves camera to location instead of adding waypoint
	const handleSelectLocation = useCallback(
		(location: { lng: number; lat: number; name: string }) => {
			if (!mapRef.current) return;

			Logger.info(`[useRouteActions] Moving camera to selected location: ${location.name}`);

			// Move the camera to the selected location with a smooth animation
			mapRef.current.flyTo({
				center: [location.lng, location.lat],
				zoom: 14, // Zoom to a reasonable level to see the location
				duration: 1500, // 1.5 second animation
			});
		},
		[mapRef],
	);

	// Route generation handlers
	const handleGenerateAtoB = useCallback(async () => {
		handleWaypointError("Route generation functionality is not yet implemented.");
	}, [handleWaypointError]);

	const handleGenerateLoop = useCallback(async () => {
		handleWaypointError("Route generation functionality is not yet implemented.");
	}, [handleWaypointError]);

	const handleAddDirectWaypoint = useCallback(async () => {
		if (!mapRef.current || !popup || popup.type !== "direct" || !mapboxToken) return;

		Logger.info("[useRouteActions] Adding direct waypoint at:", [popup.longitude, popup.latitude]);
		const success = await addWaypoint(
			mapRef.current,
			[popup.longitude, popup.latitude],
			"direct",
			mapboxToken,
			setRouteDistance,
			setRouteDuration,
			setHasRoute,
			handleWaypointError,
			useRoutingStore.getState().isMapLocked,
		);

		if (success) {
			setPopup(null);
		} else {
			Logger.warn("[useRouteActions] Direct waypoint addition failed - popup remains open");
		}
	}, [
		popup,
		mapboxToken,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
		handleWaypointError,
		setPopup,
		mapRef.current,
	]);

	const handleRemoveWaypoint = useCallback(async () => {
		if (!mapRef.current || !popup || popup.type !== "remove" || popup.waypointIndex === undefined || !mapboxToken)
			return;

		Logger.info("[useRouteActions] Removing waypoint at index:", popup.waypointIndex);
		await removeWaypoint(
			mapRef.current,
			popup.waypointIndex,
			mapboxToken,
			setRouteDistance,
			setRouteDuration,
			setHasRoute,
			handleWaypointError,
			useRoutingStore.getState().isMapLocked,
		);

		setPopup(null);
	}, [popup, mapboxToken, setRouteDistance, setRouteDuration, setHasRoute, handleWaypointError, setPopup, mapRef]);

	const handleAddWaypointOnRoute = useCallback(async () => {
		if (!mapRef.current || !popup || popup.type !== "add_on_route" || !mapboxToken) return;

		Logger.info("[useRouteActions] Adding waypoint on route at:", [popup.longitude, popup.latitude]);
		const result = await insertWaypointAtLocation(
			mapRef.current,
			[popup.longitude, popup.latitude],
			mapboxToken,
			setRouteDistance,
			setRouteDuration,
			setHasRoute,
			handleWaypointError,
			useRoutingStore.getState().isMapLocked,
		);

		if (!result.success) {
			Logger.warn("[useRouteActions] Waypoint insertion on route failed:", result.error);
			return;
		}

		setPopup(null);
	}, [
		popup,
		mapboxToken,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
		handleWaypointError,
		setPopup,
		mapRef.current,
	]);

	// Zoom to route handler
	const handleZoomToRoute = useCallback(() => {
		if (mapRef.current && hasRoute) {
			const currentRouteCoords = getCurrentRoutePath();
			if (currentRouteCoords && currentRouteCoords.length > 0) {
				zoomToRoute(mapRef.current, currentRouteCoords);
			} else {
				Logger.warn("[useRouteActions] No route path coordinates available to zoom to.");
			}
		}
	}, [hasRoute, mapRef]);

	// Share link handler
	const handleCopyShareLinkToClipboard = useCallback(() => {
		const { waypoints, isMapLocked } = useRoutingStore.getState();

		if (waypoints.length === 0) {
			handleRouteInfoError("Cannot share an empty route.");
			return;
		}

		const encodedData = serializeAndCompress(waypoints, isMapLocked);

		if (encodedData) {
			const shareUrl = `${window.location.origin}${window.location.pathname}?route=${encodedData}`;
			navigator.clipboard
				.writeText(shareUrl)
				.then(() => {
					clearShareState();
					setShareNotification("Link copied to clipboard!");
					setTimeout(() => setShareNotification(""), 2000);
				})
				.catch((err) => {
					Logger.error("[useRouteActions] Failed to copy share link:", err);
					handleRouteInfoError("Failed to copy link. Please try again.");
				});
		} else {
			handleRouteInfoError("Could not generate shareable link.");
		}
	}, [handleRouteInfoError, setShareNotification, clearShareState]);

	// Import error handler
	const handleImportError = useCallback(
		(message: string) => {
			handleWaypointError(`Import Error: ${message}`);
		},
		[handleWaypointError],
	);

	return {
		handleUndo,
		handleRedo,
		handleReverseRoute,
		handleReset,
		handleSelectLocation,
		handleGenerateAtoB,
		handleGenerateLoop,
		handleAddDirectWaypoint,
		handleRemoveWaypoint,
		handleAddWaypointOnRoute,
		handleZoomToRoute,
		handleCopyShareLinkToClipboard,
		handleImportError,
	};
};
