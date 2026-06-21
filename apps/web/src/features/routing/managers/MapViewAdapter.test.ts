import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRoutingStore } from "@/stores/routingStore";

vi.mock("@/lib/logger", () => ({
	Logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("./MapLayerManager", () => ({
	ROUTE_SOURCE_ID: "route",
	clearKilometerMarkersLayer: vi.fn(),
	clearRouteLayer: vi.fn(),
	clearRouteScrubLayer: vi.fn(),
	clearRouteSurfaceLayer: vi.fn(),
	interpolateOnRoutePath: vi.fn(() => []),
	setHoveredWaypoint: vi.fn(),
	updateKilometerMarkersLayer: vi.fn(),
	updateRouteLayer: vi.fn(),
	updateRouteScrubLayer: vi.fn(),
	updateRouteSurfaceLayer: vi.fn(),
	updateWaypointsLayer: vi.fn(),
}));

import { Logger } from "@/lib/logger";
import { updateRouteLayer } from "./MapLayerManager";
import { syncMapView } from "./MapViewAdapter";

const PATH: [number, number][] = [
	[4.4, 51.2],
	[4.5, 51.3],
];

function createFakeMap(hasSource: () => boolean) {
	const idleCallbacks: Array<() => void> = [];
	return {
		idleCallbacks,
		map: {
			getSource: (id: string) => (id === "route" && hasSource() ? {} : undefined),
			once: (type: string, cb: () => void) => {
				if (type === "idle") idleCallbacks.push(cb);
			},
		} as never,
	};
}

describe("MapViewAdapter renderRoute resilience", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useRoutingStore.setState({ routePath: PATH });
	});

	it("paints the route immediately when the source exists", () => {
		const { map } = createFakeMap(() => true);
		syncMapView(map);
		expect(updateRouteLayer).toHaveBeenCalledWith(map, PATH);
		expect(Logger.warn).not.toHaveBeenCalled();
	});

	it("defers and retries on idle when the route source is missing", () => {
		// Regression: picking a generated route while the style is (re)loading
		// left the route source absent, so updateRouteLayer silently no-opped and
		// the line never drew ("route picked, nothing happens").
		let sourceReady = false;
		const { map, idleCallbacks } = createFakeMap(() => sourceReady);

		syncMapView(map);

		expect(updateRouteLayer).not.toHaveBeenCalled();
		expect(Logger.warn).toHaveBeenCalled();
		expect(idleCallbacks).toHaveLength(1);

		// Source becomes available; the deferred idle handler repaints.
		sourceReady = true;
		idleCallbacks[0]();

		expect(updateRouteLayer).toHaveBeenCalledWith(map, PATH);
	});
});
