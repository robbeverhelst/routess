import { CacheService } from "../cache/cache.service";
import type { AppConfig } from "../config/app-config";
import type { MetricsService } from "../telemetry/metrics.service";
import { RoutingService } from "./routing.service";

const originalFetch = globalThis.fetch;

// Real in-memory CacheService (Redis disabled) so these tests exercise the
// actual caching integration: a second identical call must not hit Valhalla.
function makeService(): { service: RoutingService; fetchCalls: () => number } {
	const config = { routing: { valhallaUrl: "http://valhalla.test" }, cache: { redisUrl: "" } } as AppConfig;
	const metrics = {
		recordExternalRequest: () => undefined,
		recordProviderCall: () => undefined,
		recordCacheEvent: () => undefined,
	} as unknown as MetricsService;
	const cache = new CacheService(config, metrics);
	const service = new RoutingService(config, metrics, cache);
	return { service, fetchCalls: () => calls };
}

let calls = 0;
function stubFetch(body: unknown): void {
	calls = 0;
	globalThis.fetch = (async () => {
		calls++;
		return new Response(JSON.stringify(body), { status: 200 });
	}) as typeof fetch;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("RoutingService caching", () => {
	it("serves a repeated trace_attributes request from cache (one Valhalla call)", async () => {
		const { service, fetchCalls } = makeService();
		stubFetch({ edges: [{ surface: "paved", length: 1 }], shape: "abc" });
		const req = { costing: "bicycle" as const, shape: [{ lat: 1, lon: 2 }] };

		const first = await service.traceAttributes(req);
		const second = await service.traceAttributes(req);

		expect(second).toEqual(first);
		expect(fetchCalls()).toBe(1);
	});

	it("re-fetches trace_attributes when the shape differs", async () => {
		const { service, fetchCalls } = makeService();
		stubFetch({ edges: [{ surface: "paved", length: 1 }], shape: "abc" });

		await service.traceAttributes({ costing: "bicycle", shape: [{ lat: 1, lon: 2 }] });
		await service.traceAttributes({ costing: "bicycle", shape: [{ lat: 9, lon: 9 }] });

		expect(fetchCalls()).toBe(2);
	});

	it("serves a repeated height request from cache (one Valhalla call)", async () => {
		const { service, fetchCalls } = makeService();
		stubFetch({ height: [10, 20, 30] });
		const req = {
			shape: [
				{ lat: 1, lon: 2 },
				{ lat: 3, lon: 4 },
			],
		};

		const first = await service.height(req);
		const second = await service.height(req);

		expect(first).toEqual({ heights: [10, 20, 30] });
		expect(second).toEqual(first);
		expect(fetchCalls()).toBe(1);
	});
});
