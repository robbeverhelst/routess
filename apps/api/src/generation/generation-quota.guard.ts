import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CacheService } from "../cache/cache.service";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";

const SECONDS_PER_DAY = 24 * 60 * 60;

// Per-User daily cap on RouteGeneration (ADR 0032): each attempt fans out
// into many paid Valhalla calls, which the per-minute throttle does not bound
// over a day. Keyed by user when authenticated, IP otherwise (generation is
// anonymous-accessible). Counter resets at UTC midnight; fail-open if Redis
// is down (increment returns 0, never blocks).
@Injectable()
export class GenerationQuotaGuard implements CanActivate {
	constructor(
		private readonly cache: CacheService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const limit = this.config.quotas.generationPerDay;
		if (limit <= 0) return true;

		const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser | null }>();
		const subject = request.user?.id ? `user:${request.user.id}` : `ip:${request.ip ?? "unknown"}`;
		const day = new Date().toISOString().slice(0, 10);
		const count = await this.cache.increment("generation-quota", `${day}:${subject}`, SECONDS_PER_DAY);

		if (count > limit) {
			throw new HttpException(
				{
					statusCode: HttpStatus.TOO_MANY_REQUESTS,
					message: `Daily route generation limit of ${limit} reached. Try again tomorrow.`,
					error: "Too Many Requests",
				},
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}
		return true;
	}
}
