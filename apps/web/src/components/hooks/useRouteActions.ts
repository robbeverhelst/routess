import type { Map as MapboxMap } from "mapbox-gl";
import { useCallback } from "react";
import type { PopupInfo as MapPopupInfo } from "@/features/routing/managers/MapInteractionManager";
import type { RouteDraftEditor } from "@/features/routing/RouteDraftEditor";
import { getCurrentRoutePath } from "@/features/routing/services/RouteCalculationService";
import { zoomToRoute } from "@/features/routing/utils/RoutingUtils";
import { Logger } from "@/lib/logger";
import { useToastStore } from "@/stores/toastStore";

interface UseRouteActionsProps {
	editor: RouteDraftEditor | null;
	mapRef: React.RefObject<MapboxMap | null>;
	hasRoute: boolean;
	popup: MapPopupInfo | null;
	setPopup: React.Dispatch<React.SetStateAction<MapPopupInfo | null>>;
	handleWaypointError: (message: string | null) => void;
}

// Thin React-binding layer over the RouteDraftEditor. Each handler reads the
// editor (null while the map mounts), translates popup state to the editor's
// small interface, and pushes share/copy feedback through the shared toast
// store.
export const useRouteActions = ({
	editor,
	mapRef,
	popup,
	setPopup,
	hasRoute,
	handleWaypointError,
}: UseRouteActionsProps) => {
	const pushToast = useToastStore((s) => s.push);

	const handleUndo = useCallback(async () => {
		await editor?.undo();
	}, [editor]);

	const handleRedo = useCallback(async () => {
		await editor?.redo();
	}, [editor]);

	const handleReverseRoute = useCallback(async () => {
		await editor?.reverse();
	}, [editor]);

	const handleReset = useCallback(async () => {
		await editor?.reset();
	}, [editor]);

	const handleRecalculateRoute = useCallback(async () => {
		await editor?.recalculate();
	}, [editor]);

	const handleSelectLocation = useCallback(
		(location: { lng: number; lat: number; name: string }) => {
			if (!mapRef.current) return;
			Logger.info(`[useRouteActions] Moving camera to selected location: ${location.name}`);
			mapRef.current.flyTo({ center: [location.lng, location.lat], zoom: 14, duration: 1500 });
		},
		[mapRef],
	);

	const handleGenerateAtoB = useCallback(async () => {
		handleWaypointError("Route generation functionality is not yet implemented.");
	}, [handleWaypointError]);

	const handleGenerateLoop = useCallback(async () => {
		handleWaypointError("Route generation functionality is not yet implemented.");
	}, [handleWaypointError]);

	const handleAddDirectWaypoint = useCallback(async () => {
		if (!editor || !popup || popup.type !== "direct") return;
		const result = await editor.addWaypoint([popup.longitude, popup.latitude], "direct");
		if (result.success) {
			setPopup(null);
		} else {
			Logger.warn("[useRouteActions] Direct waypoint addition failed - popup remains open");
		}
	}, [editor, popup, setPopup]);

	const handleRemoveWaypoint = useCallback(async () => {
		if (!editor || !popup || popup.type !== "remove" || popup.waypointIndex === undefined) return;
		await editor.removeWaypoint(popup.waypointIndex);
		setPopup(null);
	}, [editor, popup, setPopup]);

	const handleAddWaypointOnRoute = useCallback(async () => {
		if (!editor || !popup || popup.type !== "add_on_route") return;
		const result = await editor.insertWaypointOnRoute([popup.longitude, popup.latitude]);
		if (!result.success) {
			Logger.warn("[useRouteActions] Waypoint insertion on route failed:", result.message);
			return;
		}
		setPopup(null);
	}, [editor, popup, setPopup]);

	const handleZoomToRoute = useCallback(() => {
		if (!mapRef.current || !hasRoute) return;
		const coords = getCurrentRoutePath();
		if (coords && coords.length > 0) zoomToRoute(mapRef.current, coords);
		else Logger.warn("[useRouteActions] No route path coordinates available to zoom to.");
	}, [hasRoute, mapRef]);

	const handleCopyShareLinkToClipboard = useCallback(() => {
		if (!editor) return;
		const result = editor.buildShareUrl();
		if (!result.success || !result.url) {
			pushToast({ kind: "danger", title: result.message ?? "Could not generate shareable link." });
			return;
		}
		navigator.clipboard
			.writeText(result.url)
			.then(() => {
				pushToast({ kind: "success", title: "Link copied to clipboard!" });
			})
			.catch((err) => {
				Logger.error("[useRouteActions] Failed to copy share link:", err);
				pushToast({ kind: "danger", title: "Failed to copy link. Please try again." });
			});
	}, [editor, pushToast]);

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
		handleRecalculateRoute,
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
