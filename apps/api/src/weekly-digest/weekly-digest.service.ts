import { EntityManager } from "@mikro-orm/core";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RouteActivity } from "@routess/core";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { EmailService } from "../email/email.service";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import type { PublicRouteSummaryDto } from "../routes/dto/public-route-summary.dto";
import { RoutesService } from "../routes/routes.service";
import { type AreaBox, nextSentHistory, pickDigestRoutes, searchBoxAround } from "./digest-picks";
import { createUnsubscribeToken } from "./unsubscribe-token";

// A run that overlaps or repeats within the week must not mail anyone twice.
const MIN_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000;
// Resend's default rate limit is 2 requests per second.
const SEND_SPACING_MS = 600;
const CANDIDATE_WINDOW = 20;

const ACTIVITY_LABELS: Record<RouteActivity, string> = {
	cycle: "Cycling",
	run: "Running",
	walk: "Walking",
};

export interface DigestRunResult {
	considered: number;
	sent: number;
	skippedNoArea: number;
	skippedNoRoutes: number;
	failed: number;
}

// The weekly "routes near you" email (CONTEXT.md "WeeklyDigest"). Reads only
// Users who opted in; everyone else is invisible to this service.
@Injectable()
export class WeeklyDigestService {
	private readonly logger = new Logger(WeeklyDigestService.name);

	constructor(
		private readonly em: EntityManager,
		private readonly routes: RoutesService,
		private readonly email: EmailService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
	) {}

	unsubscribeUrl(userId: number): string {
		const token = createUnsubscribeToken(this.config.auth.jwtSecret, userId);
		return `${this.config.email.publicApiUrl}/api/v1/email/unsubscribe?token=${encodeURIComponent(token)}`;
	}

	async run(options: { dryRun?: boolean; now?: Date } = {}): Promise<DigestRunResult> {
		if (!this.config.email.publicApiUrl) {
			throw new Error("PUBLIC_API_URL is not set; refusing to send mail without a working unsubscribe link");
		}
		const now = options.now ?? new Date();
		const recipients = await this.em.find(User, {
			weeklyDigestOptInAt: { $ne: null },
			deletionStatus: "active",
			isEmailVerified: true,
			$or: [
				{ weeklyDigestLastSentAt: null },
				{ weeklyDigestLastSentAt: { $lt: new Date(now.getTime() - MIN_INTERVAL_MS) } },
			],
		});

		const result: DigestRunResult = {
			considered: recipients.length,
			sent: 0,
			skippedNoArea: 0,
			skippedNoRoutes: 0,
			failed: 0,
		};
		for (const user of recipients) {
			try {
				const outcome = await this.sendTo(user, now, options.dryRun ?? false);
				if (outcome === "sent") result.sent += 1;
				else if (outcome === "no-area") result.skippedNoArea += 1;
				else result.skippedNoRoutes += 1;
			} catch (error) {
				result.failed += 1;
				this.logger.error(`Weekly digest failed for user ${user.id}`, error);
			}
		}
		return result;
	}

	private async sendTo(user: User, now: Date, dryRun: boolean): Promise<"sent" | "no-area" | "no-routes"> {
		// "Last planned area": the User's most recently saved Route with a path.
		const lastRoute = await this.em.findOne(
			Route,
			{ user: user.id, bboxMinLat: { $ne: null } },
			{ orderBy: { updatedAt: "DESC" } },
		);
		if (
			lastRoute?.bboxMinLat == null ||
			lastRoute.bboxMaxLat == null ||
			lastRoute.bboxMinLng == null ||
			lastRoute.bboxMaxLng == null
		) {
			return "no-area";
		}

		const area = {
			minLat: lastRoute.bboxMinLat,
			maxLat: lastRoute.bboxMaxLat,
			minLng: lastRoute.bboxMinLng,
			maxLng: lastRoute.bboxMaxLng,
		};
		const bbox = searchBoxAround(area);
		const { items } = await this.routes.findPublicListing(
			{ gate: "public", bbox, activity: lastRoute.activity },
			CANDIDATE_WINDOW,
			0,
		);
		const alreadySent = user.weeklyDigestSentSlugIds ?? [];
		const picks = pickDigestRoutes(items, user.id, alreadySent);
		if (picks.length === 0) return "no-routes";

		if (dryRun) {
			this.logger.log(`[dry-run] user ${user.id}: ${picks.map((p) => p.slugId).join(", ")}`);
			return "sent";
		}

		const site = this.config.app.publicSiteUrl;
		await this.email.sendWeeklyDigestEmail(user.email, {
			areaLabel: lastRoute.placeCity ?? "you",
			routes: picks.map((pick) => ({
				name: pick.name,
				url: `${site}/r/${pick.slugId}`,
				imageUrl: `${site}/r/${pick.slugId}/og.png`,
				meta: routeMeta(pick, user),
			})),
			discoverUrl: `${this.config.app.frontendUrl}/?center=${areaCenter(area)}&zoom=11`,
			unsubscribeUrl: this.unsubscribeUrl(user.id),
		});
		user.weeklyDigestLastSentAt = now;
		user.weeklyDigestSentSlugIds = nextSentHistory(alreadySent, picks);
		await this.em.flush();
		await Bun.sleep(SEND_SPACING_MS);
		return "sent";
	}

	// Withdraws consent. Idempotent; an unknown or already-unsubscribed User is
	// a no-op so the response never reveals which ids exist.
	async unsubscribe(userId: number): Promise<void> {
		const user = await this.em.findOne(User, { id: userId });
		if (!user?.weeklyDigestOptInAt) return;
		user.withdrawWeeklyDigest();
		await this.em.flush();
	}
}

function areaCenter(area: AreaBox): string {
	const lat = ((area.minLat + area.maxLat) / 2).toFixed(4);
	const lng = ((area.minLng + area.maxLng) / 2).toFixed(4);
	return `${lat},${lng}`;
}

function routeMeta(route: PublicRouteSummaryDto, user: User): string {
	const parts: string[] = [];
	if (route.distance) {
		const miles = user.preferences?.units === "mi";
		const value = miles ? route.distance / 1609.344 : route.distance / 1000;
		parts.push(`${value < 10 ? value.toFixed(1) : Math.round(value)} ${miles ? "mi" : "km"}`);
	}
	if (route.activity) parts.push(ACTIVITY_LABELS[route.activity]);
	if (route.placeCity) parts.push(route.placeCity);
	return parts.join(" · ");
}
