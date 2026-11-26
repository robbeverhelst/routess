import { beforeEach, describe, expect, it, vi } from "bun:test";

import { draftToCreateRequest, emptyHistory, type Waypoint } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";

const sampleAndComputeMock = vi.fn(async () => ({ gainMeters: 0, lossMeters: 0, profile: [] }));
const fetchMock = vi.fn();
const getRouteMock = vi.fn();

vi.mock("@/lib/api", async () => {
	const original = await import("@/lib/api");
	return { ...original, apiService: { ...original.apiService, getRoute: getRouteMock } };
});

vi.mock("./services/elevation", () => ({
	getDefaultElevationService: () => ({
		sampleAndCompute: sampleAndComputeMock,
	}),
}));

import type { ApiRoute } from "@/lib/api";
import { serializeAndCompress } from "@/lib/shareUtils";
import { useRoutingStore } from "@/stores/routingStore";

import { createRouteDraftEditor } from "./RouteDraftEditor";

const PATH: [number, number][] = [
	[3.717, 51.054],
	[3.72, 51.056],
	[3.724, 51.056],
];

const WAYPOINTS: Waypoint[] = [
	{ coord: PATH[0], type: "routed" },
	{ coord: PATH[2], type: "routed" },
];

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OtherApp" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    ${PATH.map(([lon, lat]) => `<trkpt lat="${lat}" lon="${lon}"></trkpt>`).join("\n")}
  </trkseg></trk>
</gpx>`;

const savedRoute = (overrides: Partial<ApiRoute>) =>
	({
		id: 7,
		name: "Canal ride",
		activity: "cycle",
		visibility: "public",
		tags: [],
		waypoints: WAYPOINTS,
		geometry: PATH,
		provenance: "valhalla",
		...overrides,
	}) as ApiRoute;

const createRequest = () => draftToCreateRequest(useRoutingStore.getState());

describe("RouteDraftEditor keeps the Provenance a draft was loaded with", () => {
	const mapStub = { getSource: () => undefined } as unknown as MapboxMap;
	const editor = () => createRouteDraftEditor({ map: mapStub, accessToken: "pk.test" });

	beforeEach(() => {
		useRoutingStore.setState({
			waypoints: [],
			routePath: [],
			mode: { kind: "unsaved" },
			creationSource: "manual",
			forkedFromExternalRouteId: null,
			provenance: null,
			history: emptyHistory<Waypoint[]>(),
			canUndo: false,
			canRedo: false,
		});
		vi.clearAllMocks();
		sampleAndComputeMock.mockResolvedValue({ gainMeters: 0, lossMeters: 0, profile: [] });
		(global.fetch as unknown as typeof fetchMock) = fetchMock;
		fetchMock.mockResolvedValue({ ok: true, json: async () => ({ code: "Ok", tracepoints: [null, null] }) });
	});

	it.each(["gpx-import", "mapbox-legacy"] as const)(
		"duplicates a saved %s Route with its Provenance",
		async (provenance) => {
			await editor().loadFromApiRoute(savedRoute({ provenance }));

			expect(createRequest().provenance).toBe(provenance);
		},
	);

	it("duplicates a saved fork by naming its ExternalRoute", async () => {
		await editor().loadFromApiRoute(
			savedRoute({ provenance: "external-fork", forkedFrom: { externalRouteId: 42, license: "CC-BY-4.0" } }),
		);

		const request = createRequest();
		expect(request.forkedFromExternalRouteId).toBe(42);
		expect(request).not.toHaveProperty("provenance");
	});

	it("keeps gpx-import on a visitor's draft of someone else's imported Route", async () => {
		getRouteMock.mockResolvedValue(savedRoute({ provenance: "gpx-import" }));

		await editor().loadFromShareLink("7");

		expect(useRoutingStore.getState().mode.kind).toBe("unsaved");
		expect(createRequest().provenance).toBe("gpx-import");
	});

	it("marks a draft loaded from a GPX file gpx-import", async () => {
		const result = await editor().loadFromGpx(GPX);

		expect(result.success).toBe(true);
		expect(createRequest().provenance).toBe("gpx-import");
	});

	it("keeps the Provenance a LocalRoute was stored with", async () => {
		await editor().loadFromLocalRoute({
			localId: "local-1",
			route: { name: "Canal ride", waypoints: WAYPOINTS, geometry: PATH, distance: 900, provenance: "gpx-import" },
			creationSource: "imported",
			createdAt: "2026-11-26T00:00:00.000Z",
			updatedAt: "2026-11-26T00:00:00.000Z",
		});

		expect(createRequest().provenance).toBe("gpx-import");
	});

	it("forgets the loaded Provenance when the next draft starts", async () => {
		await editor().loadFromApiRoute(savedRoute({ provenance: "gpx-import" }));

		useRoutingStore.getState().clearWaypoints();
		expect(createRequest()).not.toHaveProperty("provenance");

		await editor().loadFromApiRoute(savedRoute({ provenance: "gpx-import" }));
		useRoutingStore.getState().setCreationSource("generated");
		expect(createRequest().provenance).toBe("generation");
	});

	it.each([
		[
			"a fork",
			() => editor().loadFromApiRoute(savedRoute({ provenance: "external-fork", forkedFrom: { externalRouteId: 42 } })),
		],
		["a GPX import", () => editor().loadFromGpx(GPX)],
	])("starts an unbound manual draft from a share link opened after %s", async (_, loadPrevious) => {
		await loadPrevious();
		const encoded = serializeAndCompress(
			WAYPOINTS.map((wp) => ({ ...wp, type: "direct" as const })),
			false,
		);
		if (!encoded) throw new Error("failed to build payload");

		expect((await editor().loadFromShareLink(encoded)).success).toBe(true);

		const request = createRequest();
		expect(request).not.toHaveProperty("provenance");
		expect(request).not.toHaveProperty("forkedFromExternalRouteId");
		expect(useRoutingStore.getState().mode.kind).toBe("unsaved");
	});
});
