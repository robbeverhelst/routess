import { beforeEach, describe, expect, it, vi } from "bun:test";
import { ApiDomainError } from "@routess/api-client";
import type { Waypoint } from "@routess/core";

const trackEventMock = vi.fn();
vi.mock("@/lib/analytics/track", () => ({ trackEvent: trackEventMock }));

import type { ApiRoute, CreateRouteRequest } from "@/lib/api";
import { claimLocalRoutes } from "./claimLocalRoutes";
import { createMemoryBackend, type LocalRoute, type LocalRouteBackend } from "./localRouteDb";
import { useRoutingStore } from "@/stores/routingStore";
import { setLocalRouteBackend, useLocalRoutesStore } from "./localRoutesStore";

const WAYPOINTS: Waypoint[] = [
	{ coord: [3.7174, 51.0543], type: "routed" },
	{ coord: [3.7274, 51.0643], type: "routed" },
];

const localRoute = (name: string, createdAt: string): LocalRoute => ({
	localId: crypto.randomUUID(),
	route: { name, waypoints: WAYPOINTS, distance: 1000 },
	creationSource: "manual",
	createdAt,
	updatedAt: createdAt,
});

// Stands in for POST /routes: one Route per clientRef, like the API's
// unique (user, clientRef), and an optional saved-Route cap.
function fakeAccount(limit = Number.POSITIVE_INFINITY) {
	const routes = new Map<string, CreateRouteRequest>();
	let loseNextResponse = false;
	const createRoute = vi.fn(async (route: CreateRouteRequest): Promise<ApiRoute> => {
		if (!route.clientRef) throw new Error("claims must carry a clientRef");
		if (!routes.has(route.clientRef)) {
			if (routes.size >= limit) {
				throw new ApiDomainError({
					statusCode: 403,
					code: "FORBIDDEN",
					message: "Free saves up to 5 routes. Go Pro for unlimited.",
					details: { reason: "saved_route_limit", feature: "unlimited_saved_routes", limit, upgrade: "pro" },
				});
			}
			routes.set(route.clientRef, route);
		}
		if (loseNextResponse) {
			loseNextResponse = false;
			throw new Error("network: response lost");
		}
		return { ...routes.get(route.clientRef), id: [...routes.keys()].indexOf(route.clientRef) + 1 } as ApiRoute;
	});
	return {
		routes,
		createRoute,
		loseNextResponse: () => {
			loseNextResponse = true;
		},
	};
}

describe("claimLocalRoutes", () => {
	let backend: LocalRouteBackend;

	const seed = async (...routes: LocalRoute[]) => {
		backend = createMemoryBackend(routes);
		setLocalRouteBackend(backend);
		useLocalRoutesStore.setState({ routes: [], hydrated: false, boundLocalId: null });
	};

	beforeEach(async () => {
		trackEventMock.mockClear();
		useRoutingStore.setState({ waypoints: WAYPOINTS, mode: { kind: "unsaved" } });
		await seed();
	});

	it("claims every device route as private, whatever the account's default visibility", async () => {
		await seed(localRoute("A", "2026-10-01T00:00:00Z"), localRoute("B", "2026-10-02T00:00:00Z"));
		const account = fakeAccount();

		await claimLocalRoutes(account.createRoute);

		expect([...account.routes.values()].map((r) => r.visibility)).toEqual(["private", "private"]);
	});

	it("continues the open draft as editing the claimed Route when it still matches, so the next save updates it", async () => {
		const bound = localRoute("Draft", "2026-10-01T00:00:00Z");
		await seed(localRoute("Other", "2026-09-30T00:00:00Z"), bound);
		useLocalRoutesStore.setState({ boundLocalId: bound.localId });
		const account = fakeAccount();

		await claimLocalRoutes(account.createRoute);

		expect(useRoutingStore.getState().mode).toMatchObject({ kind: "editing", routeId: 2, name: "Draft" });
	});

	it("leaves a draft that changed since its device save unsaved", async () => {
		const bound = localRoute("Draft", "2026-10-01T00:00:00Z");
		await seed(bound);
		useLocalRoutesStore.setState({ boundLocalId: bound.localId });
		useRoutingStore.setState({ waypoints: [...WAYPOINTS, { coord: [3.7374, 51.0743], type: "routed" }] });
		const account = fakeAccount();

		await claimLocalRoutes(account.createRoute);

		expect(useRoutingStore.getState().mode).toEqual({ kind: "unsaved" });
		expect(useLocalRoutesStore.getState().boundLocalId).toBeNull();
	});

	it("moves every device route into the account, oldest first, and empties the device", async () => {
		await seed(localRoute("Newer", "2026-10-02T00:00:00Z"), localRoute("Older", "2026-10-01T00:00:00Z"));
		const account = fakeAccount();

		const result = await claimLocalRoutes(account.createRoute);

		expect(result).toEqual({ claimed: 2, leftOnDevice: 0, hitRouteLimit: false });
		expect([...account.routes.values()].map((r) => r.name)).toEqual(["Older", "Newer"]);
		expect(await backend.list()).toEqual([]);
		expect(trackEventMock).toHaveBeenCalledWith({
			name: "local_routes_claimed",
			properties: { claimed_count: 2, left_on_device_count: 0, hit_route_limit: false },
		});
	});

	it("makes no duplicates when the same routes are claimed twice", async () => {
		const routes = [localRoute("A", "2026-10-01T00:00:00Z"), localRoute("B", "2026-10-02T00:00:00Z")];
		const account = fakeAccount();

		await seed(...routes);
		await claimLocalRoutes(account.createRoute);
		// The same device data again, e.g. a second tab that still held it.
		await seed(...routes);
		await claimLocalRoutes(account.createRoute);

		expect(account.routes.size).toBe(2);
	});

	it("makes no duplicates when a claim's response is lost and the next sign-in retries it", async () => {
		await seed(localRoute("A", "2026-10-01T00:00:00Z"), localRoute("B", "2026-10-02T00:00:00Z"));
		const account = fakeAccount();
		account.loseNextResponse();

		const first = await claimLocalRoutes(account.createRoute);
		expect(first).toEqual({ claimed: 0, leftOnDevice: 2, hitRouteLimit: false });
		expect(await backend.list()).toHaveLength(2);

		const retry = await claimLocalRoutes(account.createRoute);
		expect(retry).toEqual({ claimed: 2, leftOnDevice: 0, hitRouteLimit: false });
		expect(account.routes.size).toBe(2);
	});

	it("runs one claim at a time, so concurrent sign-in effects send each route once", async () => {
		await seed(localRoute("A", "2026-10-01T00:00:00Z"));
		const account = fakeAccount();

		const [a, b] = await Promise.all([claimLocalRoutes(account.createRoute), claimLocalRoutes(account.createRoute)]);

		expect(a).toBe(b);
		expect(account.createRoute).toHaveBeenCalledTimes(1);
	});

	it("keeps what the free cap refuses on the device", async () => {
		await seed(
			localRoute("A", "2026-10-01T00:00:00Z"),
			localRoute("B", "2026-10-02T00:00:00Z"),
			localRoute("C", "2026-10-03T00:00:00Z"),
		);
		const account = fakeAccount(2);

		const result = await claimLocalRoutes(account.createRoute);

		expect(result).toEqual({ claimed: 2, leftOnDevice: 1, hitRouteLimit: true });
		expect((await backend.list()).map((r) => r.route.name)).toEqual(["C"]);
	});

	it("sends nothing and reports nothing when the device holds no routes", async () => {
		const account = fakeAccount();

		await claimLocalRoutes(account.createRoute);

		expect(account.createRoute).not.toHaveBeenCalled();
		expect(trackEventMock).not.toHaveBeenCalled();
	});
});
