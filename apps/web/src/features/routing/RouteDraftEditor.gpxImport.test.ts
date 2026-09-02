import { emptyHistory, type Waypoint } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sampleAndComputeMock, getDirectionsMock, fetchMock } = vi.hoisted(() => ({
	sampleAndComputeMock: vi.fn(async () => ({ gainMeters: 0, lossMeters: 0, profile: [] })),
	getDirectionsMock: vi.fn(),
	fetchMock: vi.fn(),
}));

vi.mock("./services/elevation", () => ({
	getDefaultElevationService: () => ({
		sampleAndCompute: sampleAndComputeMock,
	}),
}));

vi.mock("@/lib/utils/mapbox-api", () => ({
	getDirections: getDirectionsMock,
}));

import { useRoutingStore } from "@/stores/routingStore";
import { createRouteDraftEditor } from "./RouteDraftEditor";

// A track that doubles back on itself: re-routing between its endpoints could
// never reproduce this shape, so it only survives import if the geometry is
// kept verbatim.
const TRACK: [number, number][] = [
	[3.717, 51.054],
	[3.72, 51.056],
	[3.724, 51.056],
	[3.726, 51.053],
	[3.722, 51.051],
	[3.717, 51.052],
];

const trackGpx = () => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OtherApp" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Detour ride</name><trkseg>
    ${TRACK.map(([lon, lat]) => `<trkpt lat="${lat}" lon="${lon}"></trkpt>`).join("\n")}
  </trkseg></trk>
</gpx>`;

const rteptGpx = () => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OtherApp" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    ${TRACK.map(([lon, lat]) => `<rtept lat="${lat}" lon="${lon}"></rtept>`).join("\n")}
  </rte>
</gpx>`;

const emptyDraft = () =>
	useRoutingStore.setState({
		waypoints: [],
		routePath: [],
		distanceMeters: 0,
		durationSeconds: 0,
		isOfflineRoute: false,
		hasRoute: false,
		isComputingElevation: false,
		isMapLocked: false,
		mode: { kind: "unsaved" },
		creationSource: "manual",
		history: emptyHistory<Waypoint[]>(),
		canUndo: false,
		canRedo: false,
	});

describe("RouteDraftEditor.loadFromGpx", () => {
	const mapStub = { getSource: () => undefined } as unknown as MapboxMap;
	const editor = () => createRouteDraftEditor({ map: mapStub, accessToken: "pk.test" });

	beforeEach(() => {
		emptyDraft();
		vi.clearAllMocks();
		sampleAndComputeMock.mockResolvedValue({ gainMeters: 0, lossMeters: 0, profile: [] });
		(global.fetch as unknown as typeof fetchMock) = fetchMock;
	});

	it("keeps a track-only file's geometry instead of re-routing between waypoints", async () => {
		fetchMock.mockImplementation(async () => ({
			ok: true,
			json: async () => ({ code: "Ok", tracepoints: [null, null] }),
		}));

		const result = await editor().loadFromGpx(trackGpx());

		expect(result.success).toBe(true);
		const state = useRoutingStore.getState();
		expect(state.routePath).toEqual(TRACK);
		expect(state.hasRoute).toBe(true);
		expect(state.creationSource).toBe("imported");
		// No routing engine call: the file already carries the geometry.
		expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/routing/route"))).toBe(false);
	});

	it("keeps waypoints routed when the road check is unavailable", async () => {
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/routing/route")) {
				return {
					ok: true,
					json: async () => ({ legs: [{ shape: "", summary: { length: 1, time: 60 } }], locations: [] }),
				};
			}
			// checkNearRoad is rate limited.
			return { ok: false, status: 429, text: async () => "Too Many Requests" };
		});

		const result = await editor().loadFromGpx(rteptGpx());

		expect(result.success).toBe(true);
		const { waypoints } = useRoutingStore.getState();
		expect(waypoints).toHaveLength(TRACK.length);
		expect(waypoints.every((wp) => wp.type === "routed")).toBe(true);
	});

	it("marks a waypoint direct when the road check says it is off-road", async () => {
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/routing/route")) {
				return {
					ok: true,
					json: async () => ({ legs: [{ shape: "", summary: { length: 1, time: 60 } }], locations: [] }),
				};
			}
			return { ok: true, json: async () => ({ code: "Ok", tracepoints: [null, null] }) };
		});

		await editor().loadFromGpx(rteptGpx());

		const { waypoints } = useRoutingStore.getState();
		expect(waypoints.every((wp) => wp.type === "direct")).toBe(true);
	});
});
