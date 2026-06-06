import type { Waypoint } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import { updateWaypointsLayer } from "@/features/routing/managers/MapLayerManager";

const makeMapStub = () => {
	const setData = vi.fn();
	const map = { getSource: () => ({ setData }) } as unknown as MapboxMap;
	return { map, setData };
};

describe("updateWaypointsLayer", () => {
	const waypoints: Waypoint[] = [
		{ coord: [4.3517, 50.8503], type: "routed", name: "Start" },
		{ coord: [4.36, 50.9], type: "routed" },
		{ coord: [4.4025, 51.2194], type: "direct", name: "Antwerp" },
	];

	it("carries the waypoint name into feature properties only when set", () => {
		const { map, setData } = makeMapStub();
		updateWaypointsLayer(map, waypoints, false);

		const { features } = setData.mock.calls[0][0];
		expect(features).toHaveLength(3);
		expect(features[0].properties.name).toBe("Start");
		expect(features[1].properties).not.toHaveProperty("name");
		expect(features[2].properties.name).toBe("Antwerp");
	});

	it("keeps names on the endpoints when the map is locked", () => {
		const { map, setData } = makeMapStub();
		updateWaypointsLayer(map, waypoints, true);

		const { features } = setData.mock.calls[0][0];
		expect(features).toHaveLength(2);
		expect(features.map((f: GeoJSON.Feature) => f.properties?.name)).toEqual(["Start", "Antwerp"]);
	});
});
