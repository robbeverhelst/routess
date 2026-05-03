import { createRoutingStore } from "@routess/core";
import { Logger } from "@/lib/logger";

export const useRoutingStore = createRoutingStore(Logger);

// State selectors
export const useWaypoints = () => useRoutingStore((s) => s.waypoints);
export const useRoutePath = () => useRoutingStore((s) => s.routePath);
export const useRouteDistance = () => useRoutingStore((s) => s.routeDistance);
export const useRouteDuration = () => useRoutingStore((s) => s.routeDuration);
export const useHasRoute = () => useRoutingStore((s) => s.hasRoute);
export const useIsMapLocked = () => useRoutingStore((s) => s.isMapLocked);
export const useCanUndo = () => useRoutingStore((s) => s.canUndo);
export const useCanRedo = () => useRoutingStore((s) => s.canRedo);
export const useShareNotification = () => useRoutingStore((s) => s.shareNotification);
export const useDisplayedShareUrl = () => useRoutingStore((s) => s.displayedShareUrl);
export const useShowRouteInfoError = () => useRoutingStore((s) => s.showRouteInfoError);
export const useRouteInfoErrorMessage = () => useRoutingStore((s) => s.routeInfoErrorMessage);

// Action selectors (Zustand action references are stable across renders)
export const useAddWaypoint = () => useRoutingStore((s) => s.addWaypoint);
export const useRemoveWaypoint = () => useRoutingStore((s) => s.removeWaypoint);
export const useSetWaypoints = () => useRoutingStore((s) => s.setWaypoints);
export const useSetWaypointType = () => useRoutingStore((s) => s.setWaypointType);
export const useUpdateWaypointCoords = () => useRoutingStore((s) => s.updateWaypointCoords);
export const useClearWaypoints = () => useRoutingStore((s) => s.clearWaypoints);
export const useSetRoutePath = () => useRoutingStore((s) => s.setRoutePath);
export const useClearRoutePath = () => useRoutingStore((s) => s.clearRoutePath);
export const useSetRouteDistance = () => useRoutingStore((s) => s.setRouteDistance);
export const useSetRouteDuration = () => useRoutingStore((s) => s.setRouteDuration);
export const useSetHasRoute = () => useRoutingStore((s) => s.setHasRoute);
export const useSetIsMapLocked = () => useRoutingStore((s) => s.setIsMapLocked);
export const useSaveSnapshot = () => useRoutingStore((s) => s.saveSnapshot);
export const useUndo = () => useRoutingStore((s) => s.undo);
export const useRedo = () => useRoutingStore((s) => s.redo);
export const useClearHistory = () => useRoutingStore((s) => s.clearHistory);
export const useSetShareNotification = () => useRoutingStore((s) => s.setShareNotification);
export const useSetDisplayedShareUrl = () => useRoutingStore((s) => s.setDisplayedShareUrl);
export const useSetShowRouteInfoError = () => useRoutingStore((s) => s.setShowRouteInfoError);
export const useSetRouteInfoErrorMessage = () => useRoutingStore((s) => s.setRouteInfoErrorMessage);
export const useClearShareState = () => useRoutingStore((s) => s.clearShareState);

export type { RouteActions, RouteState, RoutingStore } from "@routess/core";
