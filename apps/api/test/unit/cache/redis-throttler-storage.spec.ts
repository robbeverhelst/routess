import { describe, expect, it } from "bun:test";
import type { CacheService } from "src/cache/cache.service";
import { RedisThrottlerStorage } from "src/cache/redis-throttler.storage";

// No Redis: every call lands on the stock in-memory fallback, which is exactly
// the path the test harness exercises.
function makeStorage(): RedisThrottlerStorage {
	return new RedisThrottlerStorage({ client: null } as unknown as CacheService);
}

const pendingTimers = (storage: RedisThrottlerStorage): number => {
	const timers = (storage as unknown as { fallback: { timeoutIds: Map<string, NodeJS.Timeout[]> } }).fallback
		.timeoutIds;
	let total = 0;
	for (const ids of timers.values()) total += ids.length;
	return total;
};

describe("RedisThrottlerStorage.reset", () => {
	it("leaves decrement timers armed when only the bucket map is cleared", async () => {
		const storage = makeStorage();
		await storage.increment("ip-1", 60_000, 10, 0, "default");
		expect(storage.storage.size).toBe(1);

		storage.storage.clear();

		// This is the bug reset() exists to avoid: the buckets are gone but the
		// timers that will read them are not.
		expect(storage.storage.size).toBe(0);
		expect(pendingTimers(storage)).toBeGreaterThan(0);
	});

	it("drops the pending timers together with the buckets", async () => {
		const storage = makeStorage();
		await storage.increment("ip-1", 60_000, 10, 0, "default");
		await storage.increment("ip-2", 60_000, 10, 0, "default");

		storage.reset();

		expect(storage.storage.size).toBe(0);
		// A surviving timer would later destructure a record that no longer
		// exists and throw from inside the timer callback, failing whichever
		// test happened to be running (#365).
		expect(pendingTimers(storage)).toBe(0);
	});

	it("survives a timer firing after a reset", async () => {
		const storage = makeStorage();
		// 1ms TTL: the decrement timer is due almost immediately.
		await storage.increment("ip-1", 1, 10, 0, "default");
		storage.reset();

		await new Promise((resolve) => setTimeout(resolve, 25));

		expect(storage.storage.size).toBe(0);
	});
});
