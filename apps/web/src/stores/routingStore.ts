import { createRoutingSelectors, createRoutingStore } from "@maps/core";
import { Logger } from "@/lib/logger";

// Create the routing store with web-specific logger
export const useRoutingStore = createRoutingStore(Logger);

// Create and export all selectors
export const {
	// State selectors
	useWaypoints,
	useDirectFlags,
	useRoutePath,
	useRouteDistance,
	useRouteDuration,
	useHasRoute,
	useIsMapLocked,
	useCanUndo,
	useCanRedo,
	useShareNotification,
	useDisplayedShareUrl,
	useShowRouteInfoError,
	useRouteInfoErrorMessage,
	// Action selectors
	useAddWaypoint,
	useRemoveWaypoint,
	useSetWaypoints,
	useClearWaypoints,
	useSetRoutePath,
	useClearRoutePath,
	useSetRouteDistance,
	useSetRouteDuration,
	useSetHasRoute,
	useSetIsMapLocked,
	useSaveSnapshot,
	useUndo,
	useRedo,
	useClearHistory,
	useSetShareNotification,
	useSetDisplayedShareUrl,
	useSetShowRouteInfoError,
	useSetRouteInfoErrorMessage,
	useClearShareState,
} = createRoutingSelectors(useRoutingStore);

// Export types for compatibility
export type { RouteActions, RouteState, RoutingStore } from "@maps/core";
