import { bboxKey, clearNodeNetworkCacheForTests, fetchNodeNetwork } from "./OverpassNodesService";

describe("OverpassNodesService", () => {
	beforeEach(() => {
		clearNodeNetworkCacheForTests();
		vi.mocked(fetch).mockReset();
	});

	it("parses Belgian node-network refs and route relations from Overpass", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({
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
			}),
		} as Response);

		const result = await fetchNodeNetwork({
			south: 51.19,
			west: 4.36,
			north: 51.23,
			east: 4.42,
		});

		expect(result.features).toEqual([
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
				properties: { kind: "cycling", ref: "04-40", name: undefined },
			},
		]);

		const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
		const body = String(init?.body);
		expect(decodeURIComponent(body)).toContain('node["rcn_ref"]');
		expect(decodeURIComponent(body)).toContain('relation["type"="route"]["network:type"="node_network"]');
	});

	it("reuses cached node-network data for the same rounded bbox", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({
				elements: [
					{
						type: "node",
						id: 245577577,
						lat: 51.2198,
						lon: 4.412,
						tags: { "network:type": "node_network", rwn_ref: "91" },
					},
				],
			}),
		} as Response);

		const bbox = { south: 51.19, west: 4.36, north: 51.23, east: 4.42 };
		const sameRoundedBbox = { south: 51.191, west: 4.361, north: 51.231, east: 4.421 };

		const first = await fetchNodeNetwork(bbox);
		const second = await fetchNodeNetwork(sameRoundedBbox);

		expect(bboxKey(bbox)).toBe(bboxKey(sameRoundedBbox));
		expect(second).toEqual(first);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(window.localStorage.getItem(`routess.node-network.v3:${bboxKey(bbox)}`)).toContain("FeatureCollection");
	});
});
