import { CacheService } from "../cache/cache.service";
import type { AppConfig } from "../config/app-config";
import type { MetricsService } from "../telemetry/metrics.service";
import { OverlaysService } from "./overlays.service";

const originalFetch = globalThis.fetch;

function makeService(): OverlaysService {
	const config = { cache: { redisUrl: "" } } as AppConfig;
	const metrics = {
		recordExternalRequest: () => undefined,
		recordProviderCall: () => undefined,
		recordCacheEvent: () => undefined,
	} as unknown as MetricsService;
	return new OverlaysService(new CacheService(config, metrics), metrics);
}

let calls = 0;
function stubFetch(): void {
	calls = 0;
	globalThis.fetch = (async () => {
		calls++;
		return new Response(
			JSON.stringify({
				elements: [{ type: "node", id: 1, lat: 51.1, lon: 4.1, tags: { rcn_ref: "40" } }],
			}),
			{ status: 200 },
		);
	}) as typeof fetch;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("OverlaysService grid-cell caching", () => {
	it("fetches a cold cell once then serves it from cache", async () => {
		const service = makeService();
		stubFetch();
		// A small bbox fully inside one 0.1deg cell ([4.1,4.2] x [51.1,51.2]).
		const bbox = { south: 51.11, west: 4.11, north: 51.14, east: 4.14 };

		const first = await service.nodeNetwork(bbox);
		const second = await service.nodeNetwork(bbox);

		expect(first.features.length).toBe(1);
		expect(second).toEqual(first);
		expect(calls).toBe(1);
	});

	it("fetches once per distinct cell and reuses them across overlapping viewports", async () => {
		const service = makeService();
		stubFetch();
		// Spans two 0.1deg cells on the x axis: 4.11 -> cell 41, 4.24 -> cell 42.
		await service.nodeNetwork({ south: 51.11, west: 4.11, north: 51.14, east: 4.24 });
		expect(calls).toBe(2);

		// A viewport inside one of the already-fetched cells: no new fetch.
		await service.nodeNetwork({ south: 51.12, west: 4.12, north: 51.15, east: 4.13 });
		expect(calls).toBe(2);
	});

	it("dedupes features shared across cells by id", async () => {
		const service = makeService();
		stubFetch();
		// Two cells, both stubbed to return node id 1 → must appear once.
		const result = await service.nodeNetwork({ south: 51.11, west: 4.11, north: 51.14, east: 4.24 });
		expect(result.features.filter((f) => f.id === "n1").length).toBe(1);
	});

	it("rejects a bbox spanning too many grid cells", async () => {
		const service = makeService();
		stubFetch();
		await expect(service.nodeNetwork({ south: 0, west: 0, north: 20, east: 20 })).rejects.toThrow();
		expect(calls).toBe(0);
	});
});
