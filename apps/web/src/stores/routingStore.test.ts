import { useRoutingStore } from "@/stores/routingStore";
import { mockCoordinates } from "../test/utils";

// Mock localStorage for persistence
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

describe("RoutingStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useRoutingStore.setState({
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
    });
    jest.clearAllMocks();
  });

  describe("Waypoint Management", () => {
    it("should add waypoints correctly", () => {
      const store = useRoutingStore.getState();

      store.addWaypoint(mockCoordinates.berlin, false);

      const state = useRoutingStore.getState();
      expect(state.waypoints).toHaveLength(1);
      expect(state.waypoints[0]).toEqual(mockCoordinates.berlin);
      expect(state.directFlags[0]).toBe(false);
    });

    it("should remove waypoints correctly", () => {
      const store = useRoutingStore.getState();

      // Add two waypoints
      store.addWaypoint(mockCoordinates.berlin, false);
      store.addWaypoint(mockCoordinates.paris, true);

      // Remove the first one
      store.removeWaypoint(0);

      const state = useRoutingStore.getState();
      expect(state.waypoints).toHaveLength(1);
      expect(state.waypoints[0]).toEqual(mockCoordinates.paris);
      expect(state.directFlags[0]).toBe(true);
    });

    it("should clear waypoints correctly", () => {
      const store = useRoutingStore.getState();

      // Add waypoints
      store.addWaypoint(mockCoordinates.berlin, false);
      store.addWaypoint(mockCoordinates.paris, true);

      // Clear all
      store.clearWaypoints();

      const state = useRoutingStore.getState();
      expect(state.waypoints).toHaveLength(0);
      expect(state.directFlags).toHaveLength(0);
      expect(state.routePath).toHaveLength(0);
      expect(state.routeDistance).toBe("");
      expect(state.routeDuration).toBe("");
      expect(state.hasRoute).toBe(false);
    });

    it("should set waypoints and flags together", () => {
      const store = useRoutingStore.getState();
      const waypoints = [mockCoordinates.berlin, mockCoordinates.paris];
      const directFlags = [false, true];

      store.setWaypoints(waypoints, directFlags);

      const state = useRoutingStore.getState();
      expect(state.waypoints).toEqual(waypoints);
      expect(state.directFlags).toEqual(directFlags);
    });
  });

  describe("Route Management", () => {
    it("should set route path correctly", () => {
      const store = useRoutingStore.getState();
      const routePath = [mockCoordinates.berlin, mockCoordinates.paris];

      store.setRoutePath(routePath);

      const state = useRoutingStore.getState();
      expect(state.routePath).toEqual(routePath);
    });

    it("should clear route path correctly", () => {
      const store = useRoutingStore.getState();

      // Set a route path first
      store.setRoutePath([mockCoordinates.berlin, mockCoordinates.paris]);
      expect(useRoutingStore.getState().routePath).toHaveLength(2);

      // Clear it
      store.clearRoutePath();

      const state = useRoutingStore.getState();
      expect(state.routePath).toHaveLength(0);
    });

    it("should set route info correctly", () => {
      const store = useRoutingStore.getState();

      store.setRouteDistance("15.2 km");
      store.setRouteDuration("32 min");
      store.setHasRoute(true);

      const state = useRoutingStore.getState();
      expect(state.routeDistance).toBe("15.2 km");
      expect(state.routeDuration).toBe("32 min");
      expect(state.hasRoute).toBe(true);
    });
  });

  describe("Undo/Redo System", () => {
    it("should save snapshots correctly", () => {
      const store = useRoutingStore.getState();

      // Add a waypoint first
      store.addWaypoint(mockCoordinates.berlin, false);

      // Save snapshot
      store.saveSnapshot();

      const state = useRoutingStore.getState();
      expect(state.undoStack).toHaveLength(1);
      expect(state.canUndo).toBe(true);
      expect(state.canRedo).toBe(false);
      expect(state.redoStack).toHaveLength(0);
    });

    it("should undo correctly", () => {
      const store = useRoutingStore.getState();

      // Save initial empty state
      store.saveSnapshot();

      // Add waypoint
      store.addWaypoint(mockCoordinates.berlin, false);

      // Undo
      store.undo();

      const state = useRoutingStore.getState();
      expect(state.waypoints).toHaveLength(0);
      expect(state.canUndo).toBe(false);
      expect(state.canRedo).toBe(true);
      expect(state.redoStack).toHaveLength(1);
    });

    it("should redo correctly", () => {
      const store = useRoutingStore.getState();

      // Save initial state, add waypoint, undo
      store.saveSnapshot();
      store.addWaypoint(mockCoordinates.berlin, false);
      store.undo();

      // Now redo
      store.redo();

      const state = useRoutingStore.getState();
      expect(state.waypoints).toHaveLength(1);
      expect(state.waypoints[0]).toEqual(mockCoordinates.berlin);
      expect(state.canUndo).toBe(true);
      expect(state.canRedo).toBe(false);
    });

    it("should clear redo stack when new action is performed after undo", () => {
      const store = useRoutingStore.getState();

      // Setup: save state, add waypoint, undo
      store.saveSnapshot();
      store.addWaypoint(mockCoordinates.berlin, false);
      store.undo();

      expect(useRoutingStore.getState().canRedo).toBe(true);

      // Perform new action (save snapshot)
      store.saveSnapshot();

      const state = useRoutingStore.getState();
      expect(state.redoStack).toHaveLength(0);
      expect(state.canRedo).toBe(false);
    });

    it("should handle undo when no actions to undo", () => {
      const store = useRoutingStore.getState();

      // Try to undo with empty stack
      store.undo();

      const state = useRoutingStore.getState();
      expect(state.waypoints).toHaveLength(0);
      expect(state.canUndo).toBe(false);
    });

    it("should handle redo when no actions to redo", () => {
      const store = useRoutingStore.getState();

      // Try to redo with empty stack
      store.redo();

      const state = useRoutingStore.getState();
      expect(state.waypoints).toHaveLength(0);
      expect(state.canRedo).toBe(false);
    });
  });

  describe("Map Configuration", () => {
    it("should set map lock state correctly", () => {
      const store = useRoutingStore.getState();

      store.setIsMapLocked(true);
      expect(useRoutingStore.getState().isMapLocked).toBe(true);

      store.setIsMapLocked(false);
      expect(useRoutingStore.getState().isMapLocked).toBe(false);
    });
  });

  describe("Share and Error Management", () => {
    it("should manage share notification correctly", () => {
      const store = useRoutingStore.getState();

      store.setShareNotification("Link copied!");
      expect(useRoutingStore.getState().shareNotification).toBe("Link copied!");
    });

    it("should manage share URL correctly", () => {
      const store = useRoutingStore.getState();

      store.setDisplayedShareUrl("https://example.com/route/123");
      expect(useRoutingStore.getState().displayedShareUrl).toBe("https://example.com/route/123");

      store.setDisplayedShareUrl(null);
      expect(useRoutingStore.getState().displayedShareUrl).toBe(null);
    });

    it("should manage route info errors correctly", () => {
      const store = useRoutingStore.getState();

      store.setShowRouteInfoError(true);
      store.setRouteInfoErrorMessage("Failed to calculate route");

      const state = useRoutingStore.getState();
      expect(state.showRouteInfoError).toBe(true);
      expect(state.routeInfoErrorMessage).toBe("Failed to calculate route");
    });

    it("should clear share state correctly", () => {
      const store = useRoutingStore.getState();

      // Set some share state
      store.setShareNotification("Test notification");
      store.setDisplayedShareUrl("https://example.com");
      store.setShowRouteInfoError(true);
      store.setRouteInfoErrorMessage("Test error");

      // Clear it
      store.clearShareState();

      const state = useRoutingStore.getState();
      expect(state.shareNotification).toBe("");
      expect(state.displayedShareUrl).toBe(null);
      expect(state.showRouteInfoError).toBe(false);
      expect(state.routeInfoErrorMessage).toBe("");
    });
  });
});
