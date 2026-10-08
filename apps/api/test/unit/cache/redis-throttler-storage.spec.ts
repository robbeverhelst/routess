import { describe, expect, it } from "bun:test";
import type { CacheService } from "src/cache/cache.service";
import { RedisThrottlerStorage } from "src/cache/redis-throttler.storage";

// No Redis: every call lands on the stock in-memory fallback, which is exactly
// the path the test harness exercises.
function makeStorage(): RedisThrottlerStorage {
	return new RedisThrottlerStorage({ client: null } as unknown as CacheService);
}

const sweepInterval = (storage: RedisThrottlerStorage): NodeJS.Timeout | undefined =>
	(storage as unknown as { fallback: { sweepInterval?: NodeJS.Timeout } }).fallback.sweepInterval;

describe("RedisThrottlerStorage.reset", () => {
	it("recounts earlier hits when only the bucket map is cleared", async () => {
		const storage = makeStorage();
		await storage.increment("ip-1", 60_000, 10, 0, "default");
		await storage.increment("ip-1", 60_000, 10, 0, "default");

		storage.storage.clear();

		// This is the bug reset() exists to avoid: the bucket is gone but its
		// hit expiries are not, so the next hit counts them again.
		const record = await storage.increment("ip-1", 60_000, 10, 0, "default");
		expect(record.totalHits).toBe(3);
	});

	it("starts every bucket from zero after a reset", async () => {
		const storage = makeStorage();
		await storage.increment("ip-1", 60_000, 10, 0, "default");
		await storage.increment("ip-1", 60_000, 10, 0, "default");
		await storage.increment("ip-2", 60_000, 10, 0, "default");

		storage.reset();

		expect(storage.storage.size).toBe(0);
		const record = await storage.increment("ip-1", 60_000, 10, 0, "default");
		expect(record.totalHits).toBe(1);
	});

	it("stops the idle sweep until the next hit", async () => {
		const storage = makeStorage();
		await storage.increment("ip-1", 60_000, 10, 0, "default");
		expect(sweepInterval(storage)).toBeDefined();

		storage.reset();
		expect(sweepInterval(storage)).toBeUndefined();

		await storage.increment("ip-1", 60_000, 10, 0, "default");
		expect(sweepInterval(storage)).toBeDefined();
		storage.reset();
	});
});
