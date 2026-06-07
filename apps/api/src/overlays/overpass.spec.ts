import { buildNodeNetworkQuery, nodeFeaturesFromOverpass } from "./overpass";

describe("nodeFeaturesFromOverpass", () => {
	it("parses Belgian node-network refs and route relations", () => {
		const features = nodeFeaturesFromOverpass({
			elements: [
				{
					type: "node",
					id: 245033400,
					lat: 51.2194,
					lon: 4.4025,
					tags: { "network:type": "node_network", rcn_ref: "40" },
				},
				{
					type: "node",
					id: 245577577,
					lat: 51.2198,
					lon: 4.412,
					tags: { "network:type": "node_network", rwn_ref: "91" },
				},
				{
					type: "relation",
					id: 4207,
					members: [
						{
							type: "way",
							ref: 4319326,
							geometry: [
								{ lat: 51.1940467, lon: 4.4328423 },
								{ lat: 51.194116, lon: 4.4329184 },
							],
						},
					],
					tags: {
						network: "rcn",
						"network:type": "node_network",
						ref: "04-40",
						route: "bicycle",
						type: "route",
					},
				},
			],
		});

		expect(features).toEqual([
			{
				type: "Feature",
				id: "n245033400",
				geometry: { type: "Point", coordinates: [4.4025, 51.2194] },
				properties: { kind: "cycling", ref: "40", name: undefined },
			},
			{
				type: "Feature",
				id: "n245577577",
				geometry: { type: "Point", coordinates: [4.412, 51.2198] },
				properties: { kind: "hiking", ref: "91", name: undefined },
			},
			{
				type: "Feature",
				id: "r4207-w4319326-0",
				geometry: {
					type: "LineString",
					coordinates: [
						[4.4328423, 51.1940467],
						[4.4329184, 51.194116],
					],
				},
				properties: { kind: "cycling", ref: "04-40", fromRef: "04", toRef: "40", name: undefined },
			},
		]);
	});

	it("skips elements without a node-network classification", () => {
		const features = nodeFeaturesFromOverpass({
			elements: [
				{ type: "node", id: 1, lat: 51, lon: 4, tags: { amenity: "bench" } },
				{ type: "way", id: 2, geometry: [{ lat: 51, lon: 4 }], tags: { network: "rcn" } },
			],
		});
		expect(features).toEqual([]);
	});
});

describe("buildNodeNetworkQuery", () => {
	it("targets node-network nodes and route relations within the bbox", () => {
		const query = buildNodeNetworkQuery({ south: 51, west: 4, north: 51.5, east: 4.5 });
		expect(query).toContain('node["rcn_ref"](51,4,51.5,4.5)');
		expect(query).toContain('relation["type"="route"]["network:type"="node_network"]');
	});
});
