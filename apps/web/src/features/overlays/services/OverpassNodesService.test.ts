import { bboxKey, clearNodeNetworkCacheForTests, fetchNodeNetwork } from "./OverpassNodesService";

const apiCollection = {
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			id: "n245577577",
			geometry: { type: "Point", coordinates: [4.412, 51.2198] },
			properties: { kind: "hiking", ref: "91" },
		},
	],
};

describe("OverpassNodesService", () => {
	beforeEach(() => {
		clearNodeNetworkCacheForTests();
		vi.mocked(fetch).mockReset();
	});

	it("fetches the node network from the API overlay proxy", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => apiCollection,
		} as Response);

		const result = await fetchNodeNetwork({
			south: 51.19,
			west: 4.36,
			north: 51.23,
			east: 4.42,
		});

		expect(result).toEqual(apiCollection);

		const [url] = vi.mocked(fetch).mock.calls[0] ?? [];
		expect(String(url)).toContain("/api/v1/overlays/node-network?");
		expect(String(url)).toContain("south=51.19");
		expect(String(url)).toContain("east=4.42");
	});

	it("rejects unexpected payloads instead of caching them", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ nope: true }),
		} as Response);

		await expect(fetchNodeNetwork({ south: 51.19, west: 4.36, north: 51.23, east: 4.42 })).rejects.toThrow(
			"unexpected payload",
		);
	});

	it("reuses cached node-network data for the same rounded bbox", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => apiCollection,
		} as Response);

		const bbox = { south: 51.19, west: 4.36, north: 51.23, east: 4.42 };
		const sameRoundedBbox = { south: 51.191, west: 4.361, north: 51.231, east: 4.421 };

		const first = await fetchNodeNetwork(bbox);
		const second = await fetchNodeNetwork(sameRoundedBbox);

		expect(bboxKey(bbox)).toBe(bboxKey(sameRoundedBbox));
		expect(second).toEqual(first);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(window.localStorage.getItem(`routess.node-network.v4:${bboxKey(bbox)}`)).toContain("FeatureCollection");
	});
});
