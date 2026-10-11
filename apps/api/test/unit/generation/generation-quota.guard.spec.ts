import { describe, expect, it } from "bun:test";
import { type ExecutionContext, HttpException, HttpStatus } from "@nestjs/common";
import type { CacheService } from "src/cache/cache.service";
import type { AppConfig, GenerationQuotaTier } from "src/config/app-config";
import type { EntitlementsService } from "src/entitlements/entitlements.service";
import { GenerationQuotaGuard } from "src/generation/generation-quota.guard";

interface Harness {
	guard: GenerationQuotaGuard;
	keys: string[];
	tierCalls: Array<{ id: number } | null>;
}

function makeGuard(options: {
	billingEnabled?: boolean;
	perDay?: number;
	byTier?: Record<GenerationQuotaTier, number>;
	tier?: GenerationQuotaTier;
	count?: number;
}): Harness {
	const keys: string[] = [];
	const tierCalls: Array<{ id: number } | null> = [];
	const cache = {
		increment: async (_namespace: string, key: string) => {
			keys.push(key);
			return options.count ?? 1;
		},
	} as unknown as CacheService;
	const entitlements = {
		quotaTier: async (user: { id: number } | null) => {
			tierCalls.push(user);
			return options.tier ?? "free";
		},
	} as unknown as EntitlementsService;
	const config = {
		billing: { enabled: options.billingEnabled ?? false },
		quotas: {
			generationPerDay: options.perDay ?? 10,
			generationPerDayByTier: options.byTier ?? { anonymous: 2, free: 5, pro: 50 },
		},
	} as unknown as AppConfig;
	return { guard: new GenerationQuotaGuard(cache, entitlements, config), keys, tierCalls };
}

function context(request: { user?: { id: number } | null; ip?: string }): ExecutionContext {
	return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

async function rejection(promise: Promise<unknown>): Promise<HttpException> {
	try {
		await promise;
	} catch (error) {
		if (error instanceof HttpException) return error;
		throw error;
	}
	throw new Error("expected the guard to reject");
}

describe("GenerationQuotaGuard", () => {
	it("allows a call at the daily limit and keys it by user and UTC day", async () => {
		const { guard, keys } = makeGuard({ perDay: 3, count: 3 });
		expect(await guard.canActivate(context({ user: { id: 7 }, ip: "1.2.3.4" }))).toBe(true);
		const day = new Date().toISOString().slice(0, 10);
		expect(keys).toEqual([`${day}:user:7`]);
	});

	it("keys anonymous callers by IP, falling back to 'unknown'", async () => {
		const withIp = makeGuard({});
		await withIp.guard.canActivate(context({ ip: "1.2.3.4" }));
		expect(withIp.keys[0]).toEndWith(":ip:1.2.3.4");

		const withoutIp = makeGuard({});
		await withoutIp.guard.canActivate(context({ user: null }));
		expect(withoutIp.keys[0]).toEndWith(":ip:unknown");
	});

	it("rejects with a RATE_LIMITED payload once the count passes the limit (billing off)", async () => {
		const { guard } = makeGuard({ perDay: 3, count: 4 });
		const error = await rejection(guard.canActivate(context({ user: { id: 7 } })));
		expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
		expect(error.getResponse()).toEqual({
			statusCode: HttpStatus.TOO_MANY_REQUESTS,
			code: "RATE_LIMITED",
			message: "Daily route generation limit of 3 reached. Try again tomorrow.",
			details: { reason: "generation_quota", limit: 3 },
		});
	});

	it("never consults entitlements when billing is off", async () => {
		const { guard, tierCalls } = makeGuard({ billingEnabled: false });
		await guard.canActivate(context({ user: { id: 7 } }));
		expect(tierCalls).toEqual([]);
	});

	it("skips counting entirely when the limit is zero or negative", async () => {
		const { guard, keys } = makeGuard({ perDay: 0, count: 999 });
		expect(await guard.canActivate(context({ user: { id: 7 } }))).toBe(true);
		expect(keys).toEqual([]);
	});

	it("uses the caller's tier limit when billing is on", async () => {
		const { guard, tierCalls } = makeGuard({ billingEnabled: true, tier: "free", count: 5 });
		expect(await guard.canActivate(context({ user: { id: 7 } }))).toBe(true);
		expect(tierCalls).toEqual([{ id: 7 }]);
	});

	it("offers sign-in when an anonymous caller runs out", async () => {
		const { guard, tierCalls } = makeGuard({ billingEnabled: true, tier: "anonymous", count: 3 });
		const error = await rejection(guard.canActivate(context({ ip: "1.2.3.4" })));
		expect(tierCalls).toEqual([null]);
		expect((error.getResponse() as { details: unknown }).details).toEqual({
			reason: "generation_quota",
			limit: 2,
			tier: "anonymous",
			upgrade: "sign_in",
		});
	});

	it("offers Pro when a free user runs out", async () => {
		const { guard } = makeGuard({ billingEnabled: true, tier: "free", count: 6 });
		const error = await rejection(guard.canActivate(context({ user: { id: 7 } })));
		expect((error.getResponse() as { details: unknown }).details).toEqual({
			reason: "generation_quota",
			limit: 5,
			tier: "free",
			upgrade: "pro",
		});
	});

	it("offers no upgrade when a Pro user runs out", async () => {
		const { guard } = makeGuard({ billingEnabled: true, tier: "pro", count: 51 });
		const error = await rejection(guard.canActivate(context({ user: { id: 7 } })));
		expect((error.getResponse() as { details: { upgrade: unknown } }).details.upgrade).toBeNull();
	});

	it("fails open when the counter store is down (increment returns 0)", async () => {
		const { guard } = makeGuard({ perDay: 1, count: 0 });
		expect(await guard.canActivate(context({ user: { id: 7 } }))).toBe(true);
	});
});
