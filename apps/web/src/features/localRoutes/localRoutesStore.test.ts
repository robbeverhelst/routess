import { beforeEach, describe, expect, it, vi } from "bun:test";

import { emptyHistory, type Waypoint } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";

const trackEventMock = vi.fn();
vi.mock("@/lib/analytics/track", () => ({ trackEvent: trackEventMock }));
vi.mock("@/features/routing/services/elevation", () => ({
	getDefaultElevationService: () => ({
		sampleAndCompute: async () => ({ gainMeters: 0, lossMeters: 0, profile: [] }),
	}),
}));

import { createRouteDraftEditor } from "@/features/routing/RouteDraftEditor";
import type { CreateRouteRequest } from "@/lib/api";
import { useRoutingStore } from "@/stores/routingStore";

import { createMemoryBackend, type LocalRoute, type LocalRouteBackend } from "./localRouteDb";
import { isDraftSavedLocally, setLocalRouteBackend, useLocalRoutesStore } from "./localRoutesStore";
import { saveLocalRoute } from "./useSaveLocalRoute";

const WAYPOINTS: Waypoint[] = [
	{ coord: [3.7174, 51.0543], type: "routed" },
	{ coord: [3.7274, 51.0643], type: "routed" },
];

const route = (name: string, waypoints = WAYPOINTS): CreateRouteRequest => ({
	name,
	activity: "cycle",
	tags: [],
	waypoints,
	geometry: waypoints.map((wp) => wp.coord),
	distance: 1234,
	elevationGain: 12,
});

const OTHER: Waypoint[] = [
	{ coord: [4.4, 50.85], type: "routed" },
	{ coord: [4.41, 50.86], type: "routed" },
];

const createEditor = () =>
	createRouteDraftEditor({ map: { getSource: () => undefined } as unknown as MapboxMap, accessToken: "test-token" });

// Opens a LocalRoute the way the library does: load it, then bind the draft.
const openLocalRoute = async (localRoute: LocalRoute) => {
	await createEditor().loadFromLocalRoute(localRoute);
	useLocalRoutesStore.getState().bind(localRoute.localId);
};

// The draft binding as a page reload restores it from localStorage.
const reloadBinding = async () => {
	const persisted = localStorage.getItem("routess-local-routes");
	useLocalRoutesStore.setState({ boundLocalId: null, loadedAtUndoDepth: 0 });
	if (persisted) localStorage.setItem("routess-local-routes", persisted);
	await useLocalRoutesStore.persist.rehydrate();
};

// A fresh store over the same storage, like a page reload.
const reload = async () => {
	useLocalRoutesStore.setState({ routes: [], hydrated: false });
	await useLocalRoutesStore.getState().hydrate();
};

describe("LocalRoutes (saving without an account)", () => {
	let backend: LocalRouteBackend;

	beforeEach(() => {
		trackEventMock.mockClear();
		backend = createMemoryBackend();
		setLocalRouteBackend(backend);
		useLocalRoutesStore.setState({ routes: [], hydrated: true, boundLocalId: null, loadedAtUndoDepth: 0 });
		useRoutingStore.setState({
			waypoints: WAYPOINTS,
			mode: { kind: "unsaved" },
			history: emptyHistory<Waypoint[]>(),
			canUndo: false,
			canRedo: false,
		});
	});

	it("keeps a saved route across a reload", async () => {
		await saveLocalRoute(route("Morning loop"), "manual");
		await reload();

		const { routes } = useLocalRoutesStore.getState();
		expect(routes).toHaveLength(1);
		expect(routes[0].route.name).toBe("Morning loop");
		expect(routes[0].route.waypoints).toEqual(WAYPOINTS);
	});

	it("updates the route the draft came from instead of piling up copies", async () => {
		const first = await saveLocalRoute(route("Loop"), "manual");
		const second = await saveLocalRoute(route("Loop, renamed"), "manual");

		expect(second.isUpdate).toBe(true);
		expect(second.localRoute.localId).toBe(first.localRoute.localId);
		const stored = await backend.list();
		expect(stored).toHaveLength(1);
		expect(stored[0].route.name).toBe("Loop, renamed");
	});

	it("saves a new route once the draft is cleared", async () => {
		await saveLocalRoute(route("First"), "manual");
		useRoutingStore.setState({ waypoints: [] });
		useRoutingStore.setState({ waypoints: WAYPOINTS });
		const second = await saveLocalRoute(route("Second"), "generated");

		expect(second.isUpdate).toBe(false);
		expect(useLocalRoutesStore.getState().routes.map((r) => r.route.name)).toEqual(["Second", "First"]);
	});

	it("saves a new route after another route is loaded over a bound one", async () => {
		const first = await saveLocalRoute(route("Morning loop"), "manual");
		const editor = createEditor();
		await editor.loadWaypoints(OTHER, { exactRoutePath: OTHER.map((wp) => wp.coord), saveSnapshot: true });
		const second = await saveLocalRoute(route("Discover route", OTHER), "imported");

		expect(second.isUpdate).toBe(false);
		const stored = await backend.list();
		expect(stored).toHaveLength(2);
		expect(stored.find((r) => r.localId === first.localRoute.localId)?.route.waypoints).toEqual(WAYPOINTS);
	});

	it("saves a new route after a reload and undoing back to the draft from before opening a device route", async () => {
		const opened = await saveLocalRoute(route("Morning loop", OTHER), "manual");
		useRoutingStore.setState({ waypoints: [] });
		useRoutingStore.setState({ waypoints: WAYPOINTS });

		await openLocalRoute(opened.localRoute);
		await reloadBinding();
		useRoutingStore.getState().undo();
		expect(useRoutingStore.getState().waypoints).toEqual(WAYPOINTS);
		const saved = await saveLocalRoute(route("Draft A"), "manual");

		expect(saved.isUpdate).toBe(false);
		const stored = await backend.list();
		expect(stored).toHaveLength(2);
		expect(stored.find((r) => r.localId === opened.localRoute.localId)?.route.waypoints).toEqual(OTHER);
	});

	it("keeps the binding when undoing edits made after opening a device route", async () => {
		const opened = await saveLocalRoute(route("Morning loop", OTHER), "manual");
		await openLocalRoute(opened.localRoute);
		useRoutingStore.getState().saveSnapshot();
		useRoutingStore.getState().setWaypoints([...OTHER, { coord: [4.42, 50.87], type: "routed" }]);
		useRoutingStore.getState().undo();
		const saved = await saveLocalRoute(route("Morning loop", OTHER), "manual");

		expect(saved.isUpdate).toBe(true);
		expect(saved.localRoute.localId).toBe(opened.localRoute.localId);
		expect(await backend.list()).toHaveLength(1);
	});

	it("keeps the binding when undoing an edit made after opening a device route at the history cap", async () => {
		const opened = await saveLocalRoute(route("Morning loop", OTHER), "manual");
		for (let i = 0; i < 50; i++) {
			useRoutingStore.setState({ waypoints: [{ coord: [3 + i / 100, 51], type: "routed" }, ...WAYPOINTS] });
			useRoutingStore.getState().saveSnapshot();
		}
		await openLocalRoute(opened.localRoute);
		useRoutingStore.getState().saveSnapshot();
		useRoutingStore.getState().setWaypoints([...OTHER, { coord: [4.42, 50.87], type: "routed" }]);
		useRoutingStore.getState().undo();
		expect(useLocalRoutesStore.getState().boundLocalId).toBe(opened.localRoute.localId);

		useRoutingStore.getState().undo();
		expect(useLocalRoutesStore.getState().boundLocalId).toBeNull();
	});

	it("adds an import as a new route without touching the draft's binding", async () => {
		const { localRoute: bound } = await saveLocalRoute(route("Open in planner"), "manual");
		const { localRoute: imported, isUpdate } = await saveLocalRoute(route("From GPX"), "imported", {
			fromDraft: false,
		});

		expect(isUpdate).toBe(false);
		expect(imported.localId).not.toBe(bound.localId);
		expect(useLocalRoutesStore.getState().boundLocalId).toBe(bound.localId);
		expect((await backend.list()).map((r) => r.route.name).sort()).toEqual(["From GPX", "Open in planner"]);
	});

	it("deletes a route from the device", async () => {
		const { localRoute } = await saveLocalRoute(route("Gone"), "manual");
		await useLocalRoutesStore.getState().remove(localRoute.localId);

		expect(await backend.list()).toEqual([]);
		expect(useLocalRoutesStore.getState().boundLocalId).toBeNull();
	});

	it("counts a new device save as route_created and every save as local_route_saved", async () => {
		await saveLocalRoute(route("Loop"), "generated");
		await saveLocalRoute(route("Loop"), "generated");

		const names = trackEventMock.mock.calls.map(([event]) => event.name);
		expect(names).toEqual(["route_created", "local_route_saved", "local_route_saved"]);
		expect(trackEventMock).toHaveBeenCalledWith({
			name: "route_created",
			properties: expect.objectContaining({
				storage: "device",
				visibility: "private",
				is_first_route: true,
				creation_source: "generated",
				waypoint_count: 2,
				distance_m: 1234,
			}),
		});
		expect(trackEventMock).toHaveBeenLastCalledWith({
			name: "local_route_saved",
			properties: expect.objectContaining({ is_update: true, local_route_count: 1, creation_source: "generated" }),
		});
	});

	it("treats an untouched locally saved draft as safe to replace", async () => {
		expect(isDraftSavedLocally(WAYPOINTS)).toBe(false);
		await saveLocalRoute(route("Loop"), "manual");

		expect(isDraftSavedLocally(WAYPOINTS)).toBe(true);
		expect(isDraftSavedLocally([...WAYPOINTS, { coord: [3.73, 51.07], type: "routed" }])).toBe(false);
	});
});
