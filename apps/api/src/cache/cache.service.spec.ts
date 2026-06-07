import type { AppConfig } from "../config/app-config";
import type { MetricsService } from "../telemetry/metrics.service";
import { CacheService } from "./cache.service";

// Redis disabled: exercises the in-memory fallback paths, which are what runs
// when REDIS_URL is unset.
function makeService(): { service: CacheService; events: Array<{ cache: string; result: string }> } {
	const events: Array<{ cache: string; result: string }> = [];
	const config = { cache: { redisUrl: "" } } as AppConfig;
	const metrics = {
		recordCacheEvent: (cache: string, result: "hit" | "miss") => events.push({ cache, result }),
	} as unknown as MetricsService;
	return { service: new CacheService(config, metrics), events };
}

describe("CacheService (in-memory fallback)", () => {
	it("reports the memory backend when no redis url is set", () => {
		const { service } = makeService();
		expect(service.backend).toBe("memory");
		expect(service.client).toBeNull();
	});

	it("records a miss then a hit and returns the cached value", async () => {
		const { service, events } = makeService();
		expect(await service.get("trace", "k")).toBeNull();
		await service.set("trace", "k", { v: 1 }, 60);
		expect(await service.get("trace", "k")).toEqual({ v: 1 });
		expect(events).toEqual([
			{ cache: "trace", result: "miss" },
			{ cache: "trace", result: "hit" },
		]);
	});

	it("expires entries after their ttl", async () => {
		const { service } = makeService();
		await service.set("trace", "k", "v", -1);
		expect(await service.get("trace", "k")).toBeNull();
	});

	it("getOrSet loads once then serves from cache", async () => {
		const { service } = makeService();
		let calls = 0;
		const loader = async () => {
			calls++;
			return { n: calls };
		};
		expect(await service.getOrSet("c", "k", 60, loader)).toEqual({ n: 1 });
		expect(await service.getOrSet("c", "k", 60, loader)).toEqual({ n: 1 });
		expect(calls).toBe(1);
	});

	it("getOrSet does not cache null results", async () => {
		const { service } = makeService();
		const result = await service.getOrSet<null>("c", "k", 60, async () => null);
		expect(result).toBeNull();
		// Still a miss on the next read since null was never stored.
		expect(await service.get("c", "k")).toBeNull();
	});

	it("increments a daily counter with a stable key", async () => {
		const { service } = makeService();
		expect(await service.increment("quota", "u1", 60)).toBe(1);
		expect(await service.increment("quota", "u1", 60)).toBe(2);
		expect(await service.increment("quota", "u2", 60)).toBe(1);
	});

	it("produces a stable hash for equal inputs", () => {
		const { service } = makeService();
		expect(service.hashKey({ a: 1, b: [2, 3] })).toBe(service.hashKey({ a: 1, b: [2, 3] }));
		expect(service.hashKey({ a: 1 })).not.toBe(service.hashKey({ a: 2 }));
	});
});
