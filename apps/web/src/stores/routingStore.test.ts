import type { Waypoint } from "@routess/core";
import { vi } from "vitest";
import { useRoutingStore } from "@/stores/routingStore";
import { mockCoordinates } from "../test/utils";

const mockLocalStorage = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

const wp = (coord: [number, number], type: "routed" | "direct" = "routed"): Waypoint => ({ coord, type });

describe("RoutingStore", () => {
	beforeEach(() => {
		useRoutingStore.setState({
			waypoints: [],
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
		vi.clearAllMocks();
	});

	describe("Waypoint Management", () => {
		it("should add waypoints correctly", () => {
			const store = useRoutingStore.getState();

			store.addWaypoint(mockCoordinates.berlin, "routed");

			const state = useRoutingStore.getState();
			expect(state.waypoints).toHaveLength(1);
			expect(state.waypoints[0]).toEqual(wp(mockCoordinates.berlin, "routed"));
		});

		it("should remove waypoints correctly", () => {
			const store = useRoutingStore.getState();

			store.addWaypoint(mockCoordinates.berlin, "routed");
			store.addWaypoint(mockCoordinates.paris, "direct");

			store.removeWaypoint(0);

			const state = useRoutingStore.getState();
			expect(state.waypoints).toHaveLength(1);
			expect(state.waypoints[0]).toEqual(wp(mockCoordinates.paris, "direct"));
		});

		it("should clear waypoints correctly", () => {
			const store = useRoutingStore.getState();

			store.addWaypoint(mockCoordinates.berlin, "routed");
			store.addWaypoint(mockCoordinates.paris, "direct");

			store.clearWaypoints();

			const state = useRoutingStore.getState();
			expect(state.waypoints).toHaveLength(0);
			expect(state.routePath).toHaveLength(0);
			expect(state.routeDistance).toBe("");
			expect(state.routeDuration).toBe("");
			expect(state.hasRoute).toBe(false);
		});

		it("should set waypoints together", () => {
			const store = useRoutingStore.getState();
			const waypoints: Waypoint[] = [wp(mockCoordinates.berlin, "routed"), wp(mockCoordinates.paris, "direct")];

			store.setWaypoints(waypoints);

			const state = useRoutingStore.getState();
			expect(state.waypoints).toEqual(waypoints);
		});

		it("should toggle a waypoint type", () => {
			const store = useRoutingStore.getState();
			store.addWaypoint(mockCoordinates.berlin, "routed");

			store.setWaypointType(0, "direct");

			expect(useRoutingStore.getState().waypoints[0].type).toBe("direct");
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

			store.setRoutePath([mockCoordinates.berlin, mockCoordinates.paris]);
			expect(useRoutingStore.getState().routePath).toHaveLength(2);

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

			store.addWaypoint(mockCoordinates.berlin, "routed");
			store.saveSnapshot();

			const state = useRoutingStore.getState();
			expect(state.undoStack).toHaveLength(1);
			expect(state.canUndo).toBe(true);
			expect(state.canRedo).toBe(false);
			expect(state.redoStack).toHaveLength(0);
		});

		it("should undo correctly", () => {
			const store = useRoutingStore.getState();

			store.saveSnapshot();
			store.addWaypoint(mockCoordinates.berlin, "routed");

			store.undo();

			const state = useRoutingStore.getState();
			expect(state.waypoints).toHaveLength(0);
			expect(state.canUndo).toBe(false);
			expect(state.canRedo).toBe(true);
			expect(state.redoStack).toHaveLength(1);
		});

		it("should redo correctly", () => {
			const store = useRoutingStore.getState();

			store.saveSnapshot();
			store.addWaypoint(mockCoordinates.berlin, "routed");
			store.undo();

			store.redo();

			const state = useRoutingStore.getState();
			expect(state.waypoints).toHaveLength(1);
			expect(state.waypoints[0]).toEqual(wp(mockCoordinates.berlin, "routed"));
			expect(state.canUndo).toBe(true);
			expect(state.canRedo).toBe(false);
		});

		it("should clear redo stack when new action is performed after undo", () => {
			const store = useRoutingStore.getState();

			store.saveSnapshot();
			store.addWaypoint(mockCoordinates.berlin, "routed");
			store.undo();

			expect(useRoutingStore.getState().canRedo).toBe(true);

			store.saveSnapshot();

			const state = useRoutingStore.getState();
			expect(state.redoStack).toHaveLength(0);
			expect(state.canRedo).toBe(false);
		});

		it("should handle undo when no actions to undo", () => {
			const store = useRoutingStore.getState();

			store.undo();

			const state = useRoutingStore.getState();
			expect(state.waypoints).toHaveLength(0);
			expect(state.canUndo).toBe(false);
		});

		it("should handle redo when no actions to redo", () => {
			const store = useRoutingStore.getState();

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

			store.setShareNotification("Test notification");
			store.setDisplayedShareUrl("https://example.com");
			store.setShowRouteInfoError(true);
			store.setRouteInfoErrorMessage("Test error");

			store.clearShareState();

			const state = useRoutingStore.getState();
			expect(state.shareNotification).toBe("");
			expect(state.displayedShareUrl).toBe(null);
			expect(state.showRouteInfoError).toBe(false);
			expect(state.routeInfoErrorMessage).toBe("");
		});
	});
});
