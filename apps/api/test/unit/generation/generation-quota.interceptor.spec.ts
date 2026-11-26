import { describe, expect, it } from "bun:test";

import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of, throwError } from "rxjs";
import { CacheService } from "src/cache/cache.service";
import type { AppConfig } from "src/config/app-config";
import type { EntitlementsService } from "src/entitlements/entitlements.service";
import type { GenerateResponseDto } from "src/generation/dto/generate.dto";
import {
	GENERATION_QUOTA_COUNTER,
	GenerationQuotaGuard,
	generationQuotaKey,
} from "src/generation/generation-quota.guard";
import { GenerationQuotaRefundInterceptor } from "src/generation/generation-quota.interceptor";
import { RoutingShedError } from "src/routing/routing-engine";
import type { MetricsService } from "src/telemetry/metrics.service";

// The guard and the refund interceptor on the in-memory CacheService: the
// daily counter only keeps a generation that returned candidates.

const config = {
	cache: { redisUrl: "" },
	billing: { enabled: false },
	quotas: { generationPerDay: 2, generationPerDayByTier: { anonymous: 2, free: 2, pro: 2 } },
} as unknown as AppConfig;

const SUCCESS = { candidates: [{}] } as unknown as GenerateResponseDto;
const NO_CANDIDATES = { candidates: [], failure: { code: "no_candidates_routable" } } as unknown as GenerateResponseDto;

function harness() {
	const cache = new CacheService(config, { recordCacheEvent: () => undefined } as unknown as MetricsService);
	const guard = new GenerationQuotaGuard(cache, {} as EntitlementsService, config);
	const interceptor = new GenerationQuotaRefundInterceptor(cache);
	const used = () => cache.readCounter(GENERATION_QUOTA_COUNTER, generationQuotaKey("user:7"));

	// One request through the guard, then the handler behind the interceptor.
	const generate = async (handle: CallHandler<GenerateResponseDto>["handle"]) => {
		const request = { user: { id: 7 } };
		const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
		await guard.canActivate(context);
		return lastValueFrom(interceptor.intercept(context, { handle }));
	};
	return { generate, used };
}

describe("GenerationQuotaRefundInterceptor", () => {
	it("keeps the count for a generation that returns candidates", async () => {
		const { generate, used } = harness();
		await generate(() => of(SUCCESS));
		expect(await used()).toBe(1);
	});

	it("takes the count back when routing is busy", async () => {
		const { generate, used } = harness();
		await expect(generate(() => throwError(() => new RoutingShedError()))).rejects.toBeInstanceOf(RoutingShedError);
		expect(await used()).toBe(0);
	});

	it("takes the count back for a generation with no candidates", async () => {
		const { generate, used } = harness();
		expect(await generate(() => of(NO_CANDIDATES))).toEqual(NO_CANDIDATES);
		expect(await used()).toBe(0);
	});

	it("lets failed generations through without spending the daily cap", async () => {
		const { generate, used } = harness();
		for (let i = 0; i < 3; i++) await generate(() => of(NO_CANDIDATES));
		await generate(() => of(SUCCESS));
		await generate(() => of(SUCCESS));
		expect(await used()).toBe(2);
	});
});
