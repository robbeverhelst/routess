import type { Coordinate } from "@routess/core";
import { emptyHistory, type Waypoint } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sampleAndComputeMock, getDirectionsMock, fetchMock, trackEventMock } = vi.hoisted(() => ({
	sampleAndComputeMock: vi.fn(async () => ({ gainMeters: 0, lossMeters: 0, profile: [] })),
	getDirectionsMock: vi.fn(),
	fetchMock: vi.fn(),
	trackEventMock: vi.fn(),
}));

vi.mock("./services/elevation", () => ({
	getDefaultElevationService: () => ({ sampleAndCompute: sampleAndComputeMock }),
}));
vi.mock("@/lib/utils/mapbox-api", () => ({ getDirections: getDirectionsMock }));
vi.mock("@/lib/analytics/track", () => ({ trackEvent: trackEventMock }));

import { useRoutingStore } from "@/stores/routingStore";
import { createRouteDraftEditor } from "./RouteDraftEditor";

const GHENT: Coordinate = [3.7174, 51.0543];
const NEARBY: Coordinate = [3.7274, 51.0643];

// route_draft_started is the only signal that a signed-out user tried to plan
// anything: route_created needs an account and a save.
describe("RouteDraftEditor — route_draft_started", () => {
	const mapStub = { getSource: () => undefined } as unknown as MapboxMap;

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

	beforeEach(() => {
		vi.clearAllMocks();
		emptyDraft();
		// No road nearby: the raw coordinate is kept and no routing is attempted.
		fetchMock.mockImplementation(async () => ({
			ok: true,
			json: async () => ({ code: "Ok", tracepoints: [null, null] }),
		}));
		(global.fetch as unknown as typeof fetchMock) = fetchMock;
	});

	it("fires when the first waypoint of an empty draft is placed", async () => {
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });
		await editor.addWaypoint(GHENT);

		expect(trackEventMock).toHaveBeenCalledWith({
			name: "route_draft_started",
			properties: { creation_source: "manual" },
		});
	});

	it("fires once per draft, not on every waypoint", async () => {
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });
		await editor.addWaypoint(GHENT);
		await editor.addWaypoint(NEARBY);

		const starts = trackEventMock.mock.calls.filter((c) => c[0]?.name === "route_draft_started");
		expect(starts).toHaveLength(1);
	});

	it("reports how the draft was born, so generated drafts stay distinguishable", async () => {
		useRoutingStore.setState({ creationSource: "generated" });
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });
		await editor.addWaypoint(GHENT);

		expect(trackEventMock).toHaveBeenCalledWith({
			name: "route_draft_started",
			properties: { creation_source: "generated" },
		});
	});
});
