import { Injectable } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import { ThrottlerStorageService } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import { CacheService } from "./cache.service";

// Atomic sliding-window increment with optional block, mirroring the default
// in-memory ThrottlerStorageService semantics. KEYS[1]=hits, KEYS[2]=block;
// ARGV[1]=ttl ms, ARGV[2]=limit, ARGV[3]=block ms. Returns
// {hits, hitsPttl, blocked, blockPttl}.
const INCREMENT_SCRIPT = `
local blockPttl = redis.call('PTTL', KEYS[2])
if blockPttl > 0 then
  return {tonumber(ARGV[2]) + 1, redis.call('PTTL', KEYS[1]), 1, blockPttl}
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local hitsPttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) and tonumber(ARGV[3]) > 0 then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return {hits, hitsPttl, 1, tonumber(ARGV[3])}
end
return {hits, hitsPttl, 0, 0}
`;

// Throttle counters shared across replicas (ADR 0031): with per-pod
// in-memory storage every configured limit was silently ~2x. Falls back to
// the stock in-memory storage when Redis is disabled or unreachable, so a
// cache outage degrades limits instead of blocking traffic.
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
	private readonly fallback = new ThrottlerStorageService();

	constructor(private readonly cache: CacheService) {}

	async increment(
		key: string,
		ttl: number,
		limit: number,
		blockDuration: number,
		throttlerName: string,
	): Promise<ThrottlerStorageRecord> {
		const redis = this.cache.client;
		if (!redis) {
			return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
		}
		try {
			const [hits, hitsPttl, blocked, blockPttl] = (await redis.eval(
				INCREMENT_SCRIPT,
				2,
				`throttle:${throttlerName}:${key}`,
				`throttle-block:${throttlerName}:${key}`,
				String(ttl),
				String(limit),
				String(blockDuration),
			)) as [number, number, number, number];
			return {
				totalHits: hits,
				timeToExpire: Math.max(0, Math.ceil(hitsPttl / 1000)),
				isBlocked: blocked === 1,
				timeToBlockExpire: Math.max(0, Math.ceil(blockPttl / 1000)),
			};
		} catch {
			return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
		}
	}
}
