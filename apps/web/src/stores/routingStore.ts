import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Coordinate, WaypointHistory } from "@/types/map";
import { Logger } from "@/lib/logger";

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

// ===== MINIMAL STORE IMPLEMENTATION =====

export const useRoutingStore = create<RoutingStore>()(
  persist(
    (set) => ({
      ...initialState,

      // === BASIC WAYPOINT MANAGEMENT ===
      addWaypoint: (coords: Coordinate, isDirect: boolean) => {
        Logger.info("[RoutingStore] Adding waypoint:", coords, "isDirect:", isDirect);
        set((state) => ({
          waypoints: [...state.waypoints, coords],
          directFlags: [...state.directFlags, isDirect],
        }));
      },

      removeWaypoint: (index: number) => {
        Logger.info("[RoutingStore] Removing waypoint at index:", index);
        set((state) => ({
          waypoints: state.waypoints.filter((_, i) => i !== index),
          directFlags: state.directFlags.filter((_, i) => i !== index),
        }));
      },

      setWaypoints: (waypoints: Coordinate[], directFlags: boolean[]) => {
        Logger.info("[RoutingStore] Setting waypoints:", waypoints.length, "waypoints");
        set({ waypoints, directFlags });
      },

      clearWaypoints: () => {
        Logger.info("[RoutingStore] Clearing waypoints");
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
        Logger.info("[RoutingStore] Updating waypoints:", waypoints.length);
        set({ waypoints });
      },

      updateDirectFlags: (directFlags: boolean[]) => {
        Logger.info("[RoutingStore] Updating directFlags:", directFlags.length);
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

          Logger.info("[RoutingStore] Saving snapshot:", snapshot.waypoints.length, "waypoints");

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
            Logger.warn("[RoutingStore] No actions to undo");
            return state; // No change
          }

          // Create current snapshot inline
          const currentSnapshot: WaypointHistory = {
            waypoints: [...state.waypoints],
            directFlags: [...state.directFlags],
            timestamp: Date.now(),
          };

          const previousSnapshot = state.undoStack[state.undoStack.length - 1];

          Logger.info(
            "[RoutingStore] Undoing to state from:",
            new Date(previousSnapshot.timestamp),
          );

          return {
            waypoints: previousSnapshot.waypoints,
            directFlags: previousSnapshot.directFlags,
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [...state.redoStack, currentSnapshot],
            canUndo: state.undoStack.length > 1,
            canRedo: true,
          };
        });
      },

      redo: () => {
        set((state) => {
          if (state.redoStack.length === 0) {
            Logger.warn("[RoutingStore] No actions to redo");
            return state; // No change
          }

          // Create current snapshot inline
          const currentSnapshot: WaypointHistory = {
            waypoints: [...state.waypoints],
            directFlags: [...state.directFlags],
            timestamp: Date.now(),
          };

          const nextSnapshot = state.redoStack[state.redoStack.length - 1];

          Logger.info("[RoutingStore] Redoing to state from:", new Date(nextSnapshot.timestamp));

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
        Logger.info("[RoutingStore] Clearing history");
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
      // SIMPLE partialize function - only persist essential data, no array operations
      partialize: (state) => ({
        waypoints: state.waypoints,
        directFlags: state.directFlags,
        routePath: state.routePath,
        routeDistance: state.routeDistance,
        routeDuration: state.routeDuration,
        hasRoute: state.hasRoute,
        isMapLocked: state.isMapLocked,
        // NOTE: NOT persisting undoStack/redoStack to avoid large localStorage
        // They will start empty on page reload, which is acceptable
      }),
    },
  ),
);

// ===== SIMPLE SELECTORS =====

// Individual primitive selectors (no objects, no shallow needed)
export const useWaypoints = () => useRoutingStore((state) => state.waypoints);
export const useDirectFlags = () => useRoutingStore((state) => state.directFlags);
export const useRoutePath = () => useRoutingStore((state) => state.routePath);
export const useRouteDistance = () => useRoutingStore((state) => state.routeDistance);
export const useRouteDuration = () => useRoutingStore((state) => state.routeDuration);
export const useHasRoute = () => useRoutingStore((state) => state.hasRoute);
export const useIsMapLocked = () => useRoutingStore((state) => state.isMapLocked);
export const useCanUndo = () => useRoutingStore((state) => state.canUndo);
export const useCanRedo = () => useRoutingStore((state) => state.canRedo);
export const useShareNotification = () => useRoutingStore((state) => state.shareNotification);
export const useDisplayedShareUrl = () => useRoutingStore((state) => state.displayedShareUrl);
export const useShowRouteInfoError = () => useRoutingStore((state) => state.showRouteInfoError);
export const useRouteInfoErrorMessage = () =>
  useRoutingStore((state) => state.routeInfoErrorMessage);

// Individual action selectors (functions are stable in Zustand)
export const useAddWaypoint = () => useRoutingStore((state) => state.addWaypoint);
export const useRemoveWaypoint = () => useRoutingStore((state) => state.removeWaypoint);
export const useSetWaypoints = () => useRoutingStore((state) => state.setWaypoints);
export const useClearWaypoints = () => useRoutingStore((state) => state.clearWaypoints);
export const useSetRoutePath = () => useRoutingStore((state) => state.setRoutePath);
export const useClearRoutePath = () => useRoutingStore((state) => state.clearRoutePath);
export const useSetRouteDistance = () => useRoutingStore((state) => state.setRouteDistance);
export const useSetRouteDuration = () => useRoutingStore((state) => state.setRouteDuration);
export const useSetHasRoute = () => useRoutingStore((state) => state.setHasRoute);
export const useSetIsMapLocked = () => useRoutingStore((state) => state.setIsMapLocked);
export const useSaveSnapshot = () => useRoutingStore((state) => state.saveSnapshot);
export const useUndo = () => useRoutingStore((state) => state.undo);
export const useRedo = () => useRoutingStore((state) => state.redo);
export const useClearHistory = () => useRoutingStore((state) => state.clearHistory);
export const useSetShareNotification = () => useRoutingStore((state) => state.setShareNotification);
export const useSetDisplayedShareUrl = () => useRoutingStore((state) => state.setDisplayedShareUrl);
export const useSetShowRouteInfoError = () =>
  useRoutingStore((state) => state.setShowRouteInfoError);
export const useSetRouteInfoErrorMessage = () =>
  useRoutingStore((state) => state.setRouteInfoErrorMessage);
export const useClearShareState = () => useRoutingStore((state) => state.clearShareState);
