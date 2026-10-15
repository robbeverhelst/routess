import { beforeEach, describe, expect, it, vi } from "bun:test";
import type { Waypoint } from "@routess/core";

const trackEventMock = vi.fn();
vi.mock("@/lib/analytics/track", () => ({ trackEvent: trackEventMock }));

import type { CreateRouteRequest } from "@/lib/api";
import { useRoutingStore } from "@/stores/routingStore";
import { createMemoryBackend, type LocalRouteBackend } from "./localRouteDb";
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
		useLocalRoutesStore.setState({ routes: [], hydrated: true, boundLocalId: null });
		useRoutingStore.setState({ waypoints: WAYPOINTS, mode: { kind: "unsaved" } });
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
