import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { DomainErrorPayload } from "@routess/core";
import type { Request } from "express";

import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CacheService } from "../cache/cache.service";
import type { AppConfig, GenerationQuotaTier } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { EntitlementsService } from "../entitlements/entitlements.service";

const SECONDS_PER_DAY = 24 * 60 * 60;

export const GENERATION_QUOTA_COUNTER = "generation-quota";

// The counter key this request was charged under, for the refund in
// GenerationQuotaRefundInterceptor. Unset when nothing was counted.
export const GENERATION_QUOTA_CHARGE = Symbol("generationQuotaCharge");

export type GenerationQuotaRequest = Request & {
	user?: AuthenticatedUser | null;
	[GENERATION_QUOTA_CHARGE]?: string;
};

// The quota counter's key: one per subject per UTC day.
export function generationQuotaKey(subject: string, now = new Date()): string {
	return `${now.toISOString().slice(0, 10)}:${subject}`;
}

// The daily cap for a tier (null tier: billing off, one cap for everyone).
// 0 means no cap.
export function generationQuotaLimit(config: AppConfig, tier: GenerationQuotaTier | null): number {
	return tier ? config.quotas.generationPerDayByTier[tier] : config.quotas.generationPerDay;
}

// What the web offers when a tier runs out: signing in lifts anonymous to the
// free allowance, Pro lifts free to the Pro allowance (ADR 0039).
const UPGRADE_FOR_TIER: Record<GenerationQuotaTier, "sign_in" | "pro" | null> = {
	anonymous: "sign_in",
	free: "pro",
	pro: null,
};

// Per-User daily cap on RouteGeneration (ADR 0032): each attempt fans out
// into many paid Valhalla calls, which the per-minute throttle does not bound
// over a day. Keyed by user when authenticated, IP otherwise (generation is
// anonymous-accessible). With billing on, the cap follows the caller's tier
// (anonymous, free or Pro, ADR 0039); with billing off one cap applies to
// everyone. Counter resets at UTC midnight; fail-open if Redis is down
// (increment returns 0, never blocks). The guard counts the attempt up front so
// concurrent requests cannot overrun the cap, and
// GenerationQuotaRefundInterceptor takes it back when the generation fails:
// only work that succeeds uses quota.
@Injectable()
export class GenerationQuotaGuard implements CanActivate {
	constructor(
		private readonly cache: CacheService,
		private readonly entitlements: EntitlementsService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<GenerationQuotaRequest>();
		const user = request.user?.id ? { id: request.user.id } : null;
		const tier = this.config.billing.enabled ? await this.entitlements.quotaTier(user) : null;
		const limit = generationQuotaLimit(this.config, tier);
		if (limit <= 0) return true;

		const subject = user ? `user:${user.id}` : `ip:${request.ip ?? "unknown"}`;
		const key = generationQuotaKey(subject);
		const count = await this.cache.increment(GENERATION_QUOTA_COUNTER, key, SECONDS_PER_DAY);

		if (count > limit) {
			await this.cache.decrement(GENERATION_QUOTA_COUNTER, key);
			const payload: DomainErrorPayload = {
				statusCode: HttpStatus.TOO_MANY_REQUESTS,
				code: "RATE_LIMITED",
				message: `Daily route generation limit of ${limit} reached. Try again tomorrow.`,
				details: {
					reason: "generation_quota",
					limit,
					...(tier ? { tier, upgrade: UPGRADE_FOR_TIER[tier] } : {}),
				},
			};
			throw new HttpException(payload, HttpStatus.TOO_MANY_REQUESTS);
		}
		if (count > 0) request[GENERATION_QUOTA_CHARGE] = key;
		return true;
	}
}
