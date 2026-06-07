import { createRoutingStore, formatDuration } from "@routess/core";
import { Logger } from "@/lib/logger";
import { formatDistance, type UnitSystem } from "@/lib/units";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";

export const useRoutingStore = createRoutingStore(Logger);

// State selectors
export const useWaypoints = () => useRoutingStore((s) => s.waypoints);
export const useRoutePath = () => useRoutingStore((s) => s.routePath);
export const useDistanceMeters = () => useRoutingStore((s) => s.distanceMeters);
export const useDurationSeconds = () => useRoutingStore((s) => s.durationSeconds);
export const useIsOfflineRoute = () => useRoutingStore((s) => s.isOfflineRoute);
export const useHasRoute = () => useRoutingStore((s) => s.hasRoute);
export const useElevationGain = () => useRoutingStore((s) => s.elevationGain);
export const useElevationLoss = () => useRoutingStore((s) => s.elevationLoss);
export const useElevationProfile = () => useRoutingStore((s) => s.elevationProfile);
export const useIsComputingElevation = () => useRoutingStore((s) => s.isComputingElevation);
export const useIsComputingRoute = () => useRoutingStore((s) => s.isComputingRoute);
export const useIsMapLocked = () => useRoutingStore((s) => s.isMapLocked);
export const useCanUndo = () => useRoutingStore((s) => s.canUndo);
export const useCanRedo = () => useRoutingStore((s) => s.canRedo);
export const useDraftMode = () => useRoutingStore((s) => s.mode);
export const useDraftActivity = () => useRoutingStore((s) => s.activity);
export const useDraftRoutingPreferences = () => useRoutingStore((s) => s.routingPreferences);
export const useDraftCreationSource = () => useRoutingStore((s) => s.creationSource);
export const useSetRoutingPreferences = () => useRoutingStore((s) => s.setRoutingPreferences);

// Display-formatted selectors derived from canonical numeric state. Consumers
// that need raw numbers use useDistanceMeters/useDurationSeconds instead.
export const useRouteDistance = (): string => {
	const meters = useDistanceMeters();
	const isOffline = useIsOfflineRoute();
	const units = useRedesignSettingsStore((s) => s.units) as UnitSystem;
	if (meters == null) return "";
	const formatted = formatDistance(meters / 1000, units);
	return isOffline ? `${formatted} (offline)` : formatted;
};

export const useRouteDuration = (): string => {
	const seconds = useDurationSeconds();
	const isOffline = useIsOfflineRoute();
	if (seconds == null) return "";
	const formatted = formatDuration(seconds / 60);
	return isOffline ? `${formatted} (estimated)` : formatted;
};

// Action selectors (Zustand action references are stable across renders)
export const useAddWaypoint = () => useRoutingStore((s) => s.addWaypoint);
export const useRemoveWaypoint = () => useRoutingStore((s) => s.removeWaypoint);
export const useSetWaypoints = () => useRoutingStore((s) => s.setWaypoints);
export const useSetWaypointType = () => useRoutingStore((s) => s.setWaypointType);
export const useSetWaypointName = () => useRoutingStore((s) => s.setWaypointName);
export const useUpdateWaypointCoords = () => useRoutingStore((s) => s.updateWaypointCoords);
export const useClearWaypoints = () => useRoutingStore((s) => s.clearWaypoints);
export const useSetRoutePath = () => useRoutingStore((s) => s.setRoutePath);
export const useClearRoutePath = () => useRoutingStore((s) => s.clearRoutePath);
export const useSetRouteMetrics = () => useRoutingStore((s) => s.setRouteMetrics);
export const useClearRouteMetrics = () => useRoutingStore((s) => s.clearRouteMetrics);
export const useSetHasRoute = () => useRoutingStore((s) => s.setHasRoute);
export const useSetIsMapLocked = () => useRoutingStore((s) => s.setIsMapLocked);
export const useSaveSnapshot = () => useRoutingStore((s) => s.saveSnapshot);
export const useUndo = () => useRoutingStore((s) => s.undo);
export const useRedo = () => useRoutingStore((s) => s.redo);
export const useClearHistory = () => useRoutingStore((s) => s.clearHistory);
export const useSetMode = () => useRoutingStore((s) => s.setMode);
export const useSetEditingName = () => useRoutingStore((s) => s.setEditingName);
export const useSetBaseline = () => useRoutingStore((s) => s.setBaseline);
export const useSetActivity = () => useRoutingStore((s) => s.setActivity);

export type {
	RouteActions,
	RouteBaseline,
	RouteDraftMode,
	RouteMetrics,
	RouteState,
	RoutingStore,
} from "@routess/core";
