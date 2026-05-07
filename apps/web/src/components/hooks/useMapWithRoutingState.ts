import { useEffect, useRef, useState } from "react";
import { useMapViewPersistence } from "@/components/hooks/useMapViewPersistence";
import { useRouteActions } from "@/components/hooks/useRouteActions";
import { useWaypointError } from "@/components/hooks/useWaypointError";
import { useMapInteraction } from "@/components/providers/MapInteractionProvider";
import type { PopupInfo as MapPopupInfo } from "@/features/routing/managers/MapInteractionManager";
import type { RouteDraftEditor } from "@/features/routing/RouteDraftEditor";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useUndoRedoState } from "@/hooks/useUndoRedoState";
import { useHasRoute, useRouteDistance, useRouteDuration } from "@/stores/routingStore";
import { useUiStore } from "@/stores/uiStore";

interface UseMapWithRoutingStateOptions {
	mapboxToken: string;
}

export const useMapWithRoutingState = ({ mapboxToken: _mapboxToken }: UseMapWithRoutingStateOptions) => {
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const [popup, setPopup] = useState<MapPopupInfo | null>(null);
	const [editor, setEditor] = useState<RouteDraftEditor | null>(null);
	const currentLanguage = useUiStore((s) => s.language);
	const setCurrentLanguage = useUiStore((s) => s.setLanguage);
	const { waypointError, handleWaypointError } = useWaypointError();
	const routeDistance = useRouteDistance();
	const routeDuration = useRouteDuration();
	const hasRoute = useHasRoute();
	const { canUndo, canRedo } = useUndoRedoState();
	const { isOnline } = useServiceWorker();
	const { handleKeyboardShortcuts } = useMapInteraction();

	const routeActions = useRouteActions({
		editor,
		mapRef,
		hasRoute,
		popup,
		setPopup,
		handleWaypointError,
	});

	useMapViewPersistence(mapRef);

	useEffect(() => {
		const cleanup = handleKeyboardShortcuts(canUndo, canRedo, routeActions.handleUndo, routeActions.handleRedo);
		return cleanup;
	}, [canUndo, canRedo, handleKeyboardShortcuts, routeActions.handleRedo, routeActions.handleUndo]);

	return {
		mapRef,
		popup,
		setPopup,
		editor,
		setEditor,
		currentLanguage,
		setCurrentLanguage,
		waypointError,
		handleWaypointError,
		routeDistance,
		routeDuration,
		hasRoute,
		canUndo,
		canRedo,
		isOnline,
		...routeActions,
	};
};
