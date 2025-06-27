import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Coordinate, WaypointHistory, Logger } from "../types";

// ===== MINIMAL TYPES =====

export interface RouteState {
  // Basic waypoint data
  waypoints: Coordinate[];
  directFlags: boolean[];

  // Route path data
  routePath: Coordinate[];

  // Basic route info
  routeDistance: string;
  routeDuration: string;
  hasRoute: boolean;

  // Map configuration state
  isMapLocked: boolean;

  // Basic history state
  undoStack: WaypointHistory[];
  redoStack: WaypointHistory[];
  canUndo: boolean;
  canRedo: boolean;

  shareNotification: string;
  displayedShareUrl: string | null;
  showRouteInfoError: boolean;
  routeInfoErrorMessage: string;
}

export interface RouteActions {
  // Basic waypoint actions
  addWaypoint: (coords: Coordinate, isDirect: boolean) => void;
  removeWaypoint: (index: number) => void;
  setWaypoints: (waypoints: Coordinate[], directFlags: boolean[]) => void;
  updateWaypoints: (waypoints: Coordinate[]) => void;
  updateDirectFlags: (directFlags: boolean[]) => void;
  clearWaypoints: () => void;

  // Route path actions
  setRoutePath: (routePath: Coordinate[]) => void;
  clearRoutePath: () => void;

  // Basic route info actions
  setRouteDistance: (distance: string) => void;
  setRouteDuration: (duration: string) => void;
  setHasRoute: (hasRoute: boolean) => void;

  // Map configuration actions
  setIsMapLocked: (isLocked: boolean) => void;

  // Basic history actions
  saveSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  setShareNotification: (message: string) => void;
  setDisplayedShareUrl: (url: string | null) => void;
  setShowRouteInfoError: (show: boolean) => void;
  setRouteInfoErrorMessage: (message: string) => void;
  clearShareState: () => void;
}

export type RoutingStore = RouteState & RouteActions;

// ===== INITIAL STATE =====

const initialState: RouteState = {
  waypoints: [],
  directFlags: [],
  routePath: [],
  routeDistance: "",
  routeDuration: "",
  hasRoute: false,
  isMapLocked: false,
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  shareNotification: "",
  displayedShareUrl: null,
  showRouteInfoError: false,
  routeInfoErrorMessage: "",
};

// ===== STORE FACTORY =====

export function createRoutingStore(logger: Logger) {
  return create<RoutingStore>()(
    persist(
      (set) => ({
        ...initialState,

        // === BASIC WAYPOINT MANAGEMENT ===
        addWaypoint: (coords: Coordinate, isDirect: boolean) => {
          logger.info("[RoutingStore] Adding waypoint:", coords, "isDirect:", isDirect);
          set((state) => ({
            waypoints: [...state.waypoints, coords],
            directFlags: [...state.directFlags, isDirect],
          }));
        },

        removeWaypoint: (index: number) => {
          logger.info("[RoutingStore] Removing waypoint at index:", index);
          set((state) => ({
            waypoints: state.waypoints.filter((_, i) => i !== index),
            directFlags: state.directFlags.filter((_, i) => i !== index),
          }));
        },

        setWaypoints: (waypoints: Coordinate[], directFlags: boolean[]) => {
          logger.info("[RoutingStore] Setting waypoints:", waypoints.length, "waypoints");
          set({ waypoints, directFlags });
        },

        clearWaypoints: () => {
          logger.info("[RoutingStore] Clearing waypoints");
          set({
            waypoints: [],
            directFlags: [],
            routePath: [],
            routeDistance: "",
            routeDuration: "",
            hasRoute: false,
          });
        },

        // === ROUTE PATH MANAGEMENT ===
        setRoutePath: (routePath: Coordinate[]) => {
          set({ routePath });
        },

        clearRoutePath: () => {
          set({ routePath: [] });
        },

        updateWaypoints: (waypoints: Coordinate[]) => {
          logger.info("[RoutingStore] Updating waypoints:", waypoints.length);
          set({ waypoints });
        },

        updateDirectFlags: (directFlags: boolean[]) => {
          logger.info("[RoutingStore] Updating directFlags:", directFlags.length);
          set({ directFlags });
        },

        // === BASIC ROUTE INFO MANAGEMENT ===
        setRouteDistance: (distance: string) => {
          set({ routeDistance: distance });
        },

        setRouteDuration: (duration: string) => {
          set({ routeDuration: duration });
        },

        setHasRoute: (hasRoute: boolean) => {
          set({ hasRoute });
        },

        // === MAP CONFIGURATION MANAGEMENT ===
        setIsMapLocked: (isLocked: boolean) => {
          set({ isMapLocked: isLocked });
        },

        // === BASIC HISTORY MANAGEMENT ===
        saveSnapshot: () => {
          set((state) => {
            const snapshot: WaypointHistory = {
              waypoints: [...state.waypoints],
              directFlags: [...state.directFlags],
              timestamp: Date.now(),
            };

            logger.info("[RoutingStore] Saving snapshot:", snapshot.waypoints.length, "waypoints");

            return {
              undoStack: [...state.undoStack, snapshot],
              redoStack: [], // Clear redo stack when new action is performed
              canUndo: true,
              canRedo: false,
            };
          });
        },

        undo: () => {
          set((state) => {
            if (state.undoStack.length === 0) {
              logger.warn("[RoutingStore] No actions to undo");
              return state; // No change
            }

            const previousSnapshot = state.undoStack[state.undoStack.length - 1];

            // Save current state to redo stack before undoing
            const currentSnapshot: WaypointHistory = {
              waypoints: [...state.waypoints],
              directFlags: [...state.directFlags],
              timestamp: Date.now(),
            };

            logger.info(
              "[RoutingStore] Undoing from:",
              state.waypoints.length,
              "waypoints to:",
              previousSnapshot.waypoints.length,
              "waypoints",
            );

            return {
              waypoints: previousSnapshot.waypoints,
              directFlags: previousSnapshot.directFlags,
              undoStack: state.undoStack.slice(0, -1), // Remove the state we just restored
              redoStack: [...state.redoStack, currentSnapshot],
              canUndo: state.undoStack.length > 1, // Can undo if there are more states
              canRedo: true,
            };
          });
        },

        redo: () => {
          set((state) => {
            if (state.redoStack.length === 0) {
              logger.warn("[RoutingStore] No actions to redo");
              return state; // No change
            }

            // Create current snapshot inline
            const currentSnapshot: WaypointHistory = {
              waypoints: [...state.waypoints],
              directFlags: [...state.directFlags],
              timestamp: Date.now(),
            };

            const nextSnapshot = state.redoStack[state.redoStack.length - 1];

            logger.info("[RoutingStore] Redoing to state from:", new Date(nextSnapshot.timestamp));

            return {
              waypoints: nextSnapshot.waypoints,
              directFlags: nextSnapshot.directFlags,
              undoStack: [...state.undoStack, currentSnapshot],
              redoStack: state.redoStack.slice(0, -1),
              canUndo: true,
              canRedo: state.redoStack.length > 1,
            };
          });
        },

        clearHistory: () => {
          logger.info("[RoutingStore] Clearing history");
          set({
            undoStack: [],
            redoStack: [],
            canUndo: false,
            canRedo: false,
          });
        },

        // === SHARE AND ERROR MANAGEMENT ===
        setShareNotification: (message: string) => {
          set({ shareNotification: message });
        },

        setDisplayedShareUrl: (url: string | null) => {
          set({ displayedShareUrl: url });
        },

        setShowRouteInfoError: (show: boolean) => {
          set({ showRouteInfoError: show });
        },

        setRouteInfoErrorMessage: (message: string) => {
          set({ routeInfoErrorMessage: message });
        },

        clearShareState: () => {
          set({
            shareNotification: "",
            displayedShareUrl: null,
            showRouteInfoError: false,
            routeInfoErrorMessage: "",
          });
        },
      }),
      {
        name: "routing-store",
        // Persist all essential data including undo/redo history
        partialize: (state) =>
          ({
            waypoints: state.waypoints,
            directFlags: state.directFlags,
            routePath: state.routePath,
            routeDistance: state.routeDistance,
            routeDuration: state.routeDuration,
            hasRoute: state.hasRoute,
            isMapLocked: state.isMapLocked,
            // Now persisting undo/redo history for better UX
            undoStack: state.undoStack,
            redoStack: state.redoStack,
            canUndo: state.canUndo,
            canRedo: state.canRedo,
            // Include share/error state
            shareNotification: state.shareNotification,
            displayedShareUrl: state.displayedShareUrl,
            showRouteInfoError: state.showRouteInfoError,
            routeInfoErrorMessage: state.routeInfoErrorMessage,
          }) as Partial<RouteState>,
        // Don't include custom storage for now - use default localStorage
      },
    ),
  );
}

// ===== FACTORY FOR SELECTORS =====

export function createRoutingSelectors(store: ReturnType<typeof createRoutingStore>) {
  // Individual primitive selectors (no objects, no shallow needed)
  const useWaypoints = () => store((state) => state.waypoints);
  const useDirectFlags = () => store((state) => state.directFlags);
  const useRoutePath = () => store((state) => state.routePath);
  const useRouteDistance = () => store((state) => state.routeDistance);
  const useRouteDuration = () => store((state) => state.routeDuration);
  const useHasRoute = () => store((state) => state.hasRoute);
  const useIsMapLocked = () => store((state) => state.isMapLocked);
  const useCanUndo = () => store((state) => state.canUndo);
  const useCanRedo = () => store((state) => state.canRedo);
  const useShareNotification = () => store((state) => state.shareNotification);
  const useDisplayedShareUrl = () => store((state) => state.displayedShareUrl);
  const useShowRouteInfoError = () => store((state) => state.showRouteInfoError);
  const useRouteInfoErrorMessage = () => store((state) => state.routeInfoErrorMessage);

  // Individual action selectors (functions are stable in Zustand)
  const useAddWaypoint = () => store((state) => state.addWaypoint);
  const useRemoveWaypoint = () => store((state) => state.removeWaypoint);
  const useSetWaypoints = () => store((state) => state.setWaypoints);
  const useClearWaypoints = () => store((state) => state.clearWaypoints);
  const useSetRoutePath = () => store((state) => state.setRoutePath);
  const useClearRoutePath = () => store((state) => state.clearRoutePath);
  const useSetRouteDistance = () => store((state) => state.setRouteDistance);
  const useSetRouteDuration = () => store((state) => state.setRouteDuration);
  const useSetHasRoute = () => store((state) => state.setHasRoute);
  const useSetIsMapLocked = () => store((state) => state.setIsMapLocked);
  const useSaveSnapshot = () => store((state) => state.saveSnapshot);
  const useUndo = () => store((state) => state.undo);
  const useRedo = () => store((state) => state.redo);
  const useClearHistory = () => store((state) => state.clearHistory);
  const useSetShareNotification = () => store((state) => state.setShareNotification);
  const useSetDisplayedShareUrl = () => store((state) => state.setDisplayedShareUrl);
  const useSetShowRouteInfoError = () => store((state) => state.setShowRouteInfoError);
  const useSetRouteInfoErrorMessage = () => store((state) => state.setRouteInfoErrorMessage);
  const useClearShareState = () => store((state) => state.clearShareState);

  return {
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
  };
}
