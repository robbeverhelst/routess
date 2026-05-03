import { createRoutingSelectors, createRoutingStore } from "@routess/core";
import { Logger } from "@/lib/logger";

export const useRoutingStore = createRoutingStore(Logger);

export const {
	// State selectors
	useWaypoints,
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
	useSetWaypointType,
	useUpdateWaypointCoords,
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

export type { RouteActions, RouteState, RoutingStore } from "@routess/core";
