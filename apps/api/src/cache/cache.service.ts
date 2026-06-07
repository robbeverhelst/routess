import { createHash } from "node:crypto";
import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { MetricsService } from "../telemetry/metrics.service";

interface MemoryEntry {
	value: string;
	expiresAt: number;
}

const MAX_MEMORY_ENTRIES = 5000;

// Shared TTL cache for provider responses and quota counters (ADR 0031).
// Redis-backed when REDIS_URL is set (shared across replicas); per-pod
// in-memory fallback otherwise. Fail-open: a Redis error is a miss, never a
// request failure.
@Injectable()
export class CacheService implements OnModuleDestroy {
	private readonly logger = new Logger(CacheService.name);
	private readonly redis: Redis | null;
	private readonly memory = new Map<string, MemoryEntry>();

	constructor(
		@Inject(APP_CONFIG) config: AppConfig,
		private readonly metrics: MetricsService,
	) {
		this.redis = config.cache.redisUrl
			? new Redis(config.cache.redisUrl, {
					maxRetriesPerRequest: 1,
					enableOfflineQueue: false,
				})
			: null;
		this.redis?.on("error", (err: Error) => this.logger.warn(`Redis error: ${err.message}`));
	}

	get backend(): "redis" | "memory" {
		return this.redis ? "redis" : "memory";
	}

	// Exposed for the throttler storage, which needs raw eval/incr access.
	// Null when Redis is disabled (callers fall back to in-memory behaviour).
	get client(): Redis | null {
		return this.redis;
	}

	async onModuleDestroy() {
		await this.redis?.quit().catch(() => undefined);
	}

	// Stable digest for cache keys built from large inputs (geometry, costing).
	hashKey(parts: unknown): string {
		return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
	}

	async get<T>(cache: string, key: string): Promise<T | null> {
		const fullKey = `cache:${cache}:${key}`;
		let raw: string | null = null;
		if (this.redis) {
			try {
				raw = await this.redis.get(fullKey);
			} catch {
				raw = null;
			}
		} else {
			const entry = this.memory.get(fullKey);
			if (entry && entry.expiresAt > Date.now()) {
				raw = entry.value;
			} else {
				this.memory.delete(fullKey);
			}
		}
		this.metrics.recordCacheEvent(cache, raw === null ? "miss" : "hit");
		if (raw === null) return null;
		try {
			return JSON.parse(raw) as T;
		} catch {
			return null;
		}
	}

	async set(cache: string, key: string, value: unknown, ttlSeconds: number): Promise<void> {
		const fullKey = `cache:${cache}:${key}`;
		const raw = JSON.stringify(value);
		if (this.redis) {
			await this.redis.set(fullKey, raw, "EX", ttlSeconds).catch(() => undefined);
			return;
		}
		this.memory.delete(fullKey);
		this.memory.set(fullKey, { value: raw, expiresAt: Date.now() + ttlSeconds * 1000 });
		while (this.memory.size > MAX_MEMORY_ENTRIES) {
			const oldest = this.memory.keys().next().value;
			if (!oldest) break;
			this.memory.delete(oldest);
		}
	}

	// Loader results of null/undefined are returned but never cached, so a
	// provider hiccup cannot poison the cache for the full TTL.
	async getOrSet<T>(cache: string, key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
		const hit = await this.get<T>(cache, key);
		if (hit !== null) return hit;
		const value = await loader();
		if (value != null) await this.set(cache, key, value, ttlSeconds);
		return value;
	}

	// Increments a counter, setting its expiry on first increment. Returns the
	// new value, or 0 on Redis failure (fail-open: an outage never blocks
	// users, it just stops enforcing quotas until Redis is back).
	async increment(counter: string, key: string, ttlSeconds: number): Promise<number> {
		const fullKey = `counter:${counter}:${key}`;
		if (this.redis) {
			try {
				const value = await this.redis.incr(fullKey);
				if (value === 1) await this.redis.expire(fullKey, ttlSeconds);
				return value;
			} catch {
				return 0;
			}
		}
		const entry = this.memory.get(fullKey);
		const live = entry && entry.expiresAt > Date.now();
		const next = (live ? Number(entry.value) : 0) + 1;
		this.memory.set(fullKey, {
			value: String(next),
			expiresAt: live ? entry.expiresAt : Date.now() + ttlSeconds * 1000,
		});
		return next;
	}
}
