import { useEffect, useRef, useState } from "react";
import { useMapViewPersistence } from "@/components/hooks/useMapViewPersistence";
import { useRouteActions } from "@/components/hooks/useRouteActions";
import { useWaypointError } from "@/components/hooks/useWaypointError";
import { useMapInteraction } from "@/components/providers/MapInteractionProvider";
import type { PopupInfo as MapPopupInfo } from "@/features/routing/managers/MapInteractionManager";
import {
	loadLanguageFromLocalStorage,
	saveLanguageToLocalStorage,
} from "@/features/routing/services/LocalStorageService";
import { useRouteData } from "@/hooks/useRouteData";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useUndoRedoState } from "@/hooks/useUndoRedoState";
import type { SupportedLanguage } from "@/lib/i18n";

interface UseMapWithRoutingStateOptions {
	mapboxToken: string;
}

export const useMapWithRoutingState = ({ mapboxToken }: UseMapWithRoutingStateOptions) => {
	const mapRef = useRef<mapboxgl.Map | null>(null);
	const [popup, setPopup] = useState<MapPopupInfo | null>(null);
	const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(loadLanguageFromLocalStorage());
	const { waypointError, handleWaypointError } = useWaypointError();
	const {
		routeDistance,
		routeDuration,
		hasRoute,
		shareNotification,
		displayedShareUrl,
		showRouteInfoError,
		routeInfoErrorMessage,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
		handleShareRoute,
		handleCopySharedUrl,
		handleRouteInfoError,
		clearShareState,
		setShareNotification,
	} = useRouteData();
	const { canUndo, canRedo } = useUndoRedoState();
	const { isOnline } = useServiceWorker();
	const { handleKeyboardShortcuts } = useMapInteraction();

	useEffect(() => {
		saveLanguageToLocalStorage(currentLanguage);
	}, [currentLanguage]);

	const routeActions = useRouteActions({
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
		currentLanguage,
		setCurrentLanguage,
		waypointError,
		handleWaypointError,
		routeDistance,
		routeDuration,
		hasRoute,
		shareNotification,
		displayedShareUrl,
		showRouteInfoError,
		routeInfoErrorMessage,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
		handleShareRoute,
		handleCopySharedUrl,
		handleRouteInfoError,
		clearShareState,
		setShareNotification,
		canUndo,
		canRedo,
		isOnline,
		...routeActions,
	};
};
