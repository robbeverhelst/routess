import { EntityManager } from "@mikro-orm/postgresql";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ProductEventStatsService, type ProductEventUserDay } from "../analytics/product-event-stats.service";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CacheService } from "../cache/cache.service";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import type { AdminAuditAction } from "../entities/admin-audit-entry.entity";
import type { EntitlementSource } from "../entities/entitlement.entity";
import type { UserPlan } from "../entities/user.entity";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { extendExpiry } from "../entitlements/grant-length";
import {
	PLAN_KIND_SQL,
	PLAN_SUMMARY_JOINS_SQL,
	type PlanKind,
	PRO_PERMANENT_SQL,
	PRO_UNTIL_SQL,
	type ProGrantsRow,
	resolvePlanStatus,
} from "../entitlements/plan-status";
import {
	GENERATION_QUOTA_COUNTER,
	generationQuotaKey,
	generationQuotaLimit,
} from "../generation/generation-quota.guard";
import { hashUserId } from "../users/user.mapper";
import type {
	AdminAuditEntryDto,
	AdminGrantProDto,
	AdminLimitConversionDto,
	AdminLimitHitPointDto,
	AdminPaymentDto,
	AdminProMetricsDto,
	AdminUserBillingDto,
	AdminUserPlanDto,
	AdminUserProDto,
} from "./dto/admin-pro.dto";

const DAY_MS = 24 * 60 * 60 * 1000;

// "Extend by a year" adds what one Pro pass adds.
const EXTEND_DAYS = 365;

// A limit hit converts when the User buys Pro within this long of it.
export const LIMIT_CONVERSION_DAYS = 7;

const ENDING_SOON_DAYS = 30;
const ENDING_SOON_LIST = 50;
const AUDIT_LOG_LIMIT = 50;

// ProductEvents the web fires when a free User hits a free-Plan limit
// (docs/agents/product-events.md).
export const LIMIT_EVENTS = {
	savedRoutes: "saved_route_limit_hit",
	generationQuota: "generation_quota_hit",
} as const;

interface PlanSummaryRow extends ProGrantsRow {
	kind: PlanKind;
	pro_until: Date | string | null;
	permanent: boolean;
}

const iso = (value: Date | string | null | undefined): string | null => (value ? new Date(value).toISOString() : null);

// The admin panel's Pro side (ADR 0039): who is on Pro and why, the Payments
// behind it, admin grants and revocations, and the Pro metrics. Plan state
// always comes from the shared resolution in entitlements/plan-status.ts,
// the same one the Pro gates read.
@Injectable()
export class AdminProService {
	constructor(
		private readonly em: EntityManager,
		private readonly entitlements: EntitlementsService,
		private readonly cache: CacheService,
		private readonly productEventStats: ProductEventStatsService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
	) {}

	async userBilling(userId: number, now = new Date()): Promise<AdminUserBillingDto> {
		const subject = { id: userId };
		const [pro, payments, unlimited, generationToday, auditLog] = await Promise.all([
			this.proStatus(this.em, userId, now),
			this.payments(userId),
			this.entitlements.can(subject, "unlimited_saved_routes", now),
			this.generationUsage(userId, now),
			this.auditLog(userId),
		]);
		return {
			pro,
			payments,
			savedRoutes: await this.entitlements.savedRouteAllowance(subject, unlimited),
			generationToday,
			auditLog,
		};
	}

	// Sets the User's admin Pro grant to `days` from now, or to never expire.
	// It replaces an earlier admin grant (so it can also shorten one); other
	// sources keep their time and the latest end wins as always.
	async grant(actor: AuthenticatedUser, userId: number, input: AdminGrantProDto): Promise<AdminUserProDto> {
		const permanent = input.permanent === true;
		if (permanent === (input.days !== undefined)) {
			throw new BadRequestException("Give either days or permanent: true");
		}
		return this.act(actor, userId, "pro.grant", input.reason, async (em, user, _before, now) => {
			if (user.plan === "pro") throw new ConflictException("The stored Plan is already Pro, which does not expire");
			const expiresAt = permanent ? null : extendExpiry(null, now, { days: input.days as number });
			await this.entitlements.setPlanGrant(em, { userId, plan: "pro", source: "admin", expiresAt });
			return { permanent, days: input.days ?? null, grantExpiresAt: iso(expiresAt) };
		});
	}

	// Adds a year to the end of the User's Pro time (or to now, if it already
	// ended), the way buying another pass does.
	async extend(actor: AuthenticatedUser, userId: number, reason: string): Promise<AdminUserProDto> {
		return this.act(actor, userId, "pro.extend", reason, async (em, _user, before, now) => {
			if (before.permanent) throw new ConflictException("This User's Pro does not expire");
			const expiresAt = await this.entitlements.extendPlanGrant(em, {
				userId,
				plan: "pro",
				source: "admin",
				from: now,
				length: { days: EXTEND_DAYS },
			});
			return { days: EXTEND_DAYS, grantExpiresAt: expiresAt.toISOString() };
		});
	}

	// Ends Pro now: every running Pro grant is revoked (the rows stay, marked
	// deleted, so the history and the once-only OG marker survive), the admin
	// grant is set to end now (written revoked, so it never runs), and a
	// stored Pro Plan goes back to free. Refunds happen in Stripe, not here.
	async revoke(actor: AuthenticatedUser, userId: number, reason: string): Promise<AdminUserProDto> {
		return this.act(actor, userId, "pro.revoke", reason, async (em, user, before, now) => {
			if (before.plan !== "pro") throw new ConflictException("This User is not on Pro");
			const ended = await em.execute<{ source: EntitlementSource }[]>(
				`update "entitlement" set "deleted_at" = ?, "updated_at" = ?
				where "user_id" = ? and "plan" = 'pro' and "deleted_at" is null
					and ("expires_at" is null or "expires_at" > ?)
				returning "source"`,
				[now, now, userId, now],
			);
			await em.execute(
				`insert into "entitlement" ("user_id", "plan", "source", "expires_at", "deleted_at", "created_at", "updated_at")
				values (?, 'pro', 'admin', ?, ?, ?, ?)
				on conflict ("user_id", "plan", "source")
				do update set "expires_at" = least(coalesce("entitlement"."expires_at", excluded."expires_at"), excluded."expires_at"),
					"updated_at" = excluded."updated_at"`,
				[userId, now, now, now, now],
			);
			const storedPlanCleared = user.plan === "pro";
			if (storedPlanCleared) {
				await em.execute(`update "user" set "plan" = 'free', "updated_at" = ? where "id" = ?`, [now, userId]);
			}
			return { revokedSources: ended.map((row) => row.source).sort(), storedPlanCleared };
		});
	}

	// One admin Pro action: under the User row lock, apply it, then write the
	// audit entry with the before and after state, all in one transaction.
	private async act(
		actor: AuthenticatedUser,
		userId: number,
		action: AdminAuditAction,
		reason: string,
		apply: (
			em: EntityManager,
			user: { id: number; plan: UserPlan },
			before: AdminUserPlanDto,
			now: Date,
		) => Promise<Record<string, unknown>>,
	): Promise<AdminUserProDto> {
		const trimmed = reason.trim();
		if (trimmed.length === 0) throw new BadRequestException("A reason is required");
		const now = new Date();
		return this.em.transactional(async (em) => {
			const [user] = await em.execute<{ id: number; plan: UserPlan }[]>(
				`select "id", "plan" from "user" where "id" = ? for update`,
				[userId],
			);
			if (!user) throw new NotFoundException(`User ${userId} not found`);
			const before = await this.planSummary(em, userId, now);
			const change = await apply(em, user, before, now);
			const after = await this.proStatus(em, userId, now);
			const summary = ({ kind, plan, proUntil, permanent }: AdminUserPlanDto) => ({ kind, plan, proUntil, permanent });
			await em.execute(
				`insert into "admin_audit_entry" ("actor_id", "actor_email", "action", "target_user_id", "details", "reason", "created_at", "updated_at")
				values (?, ?, ?, ?, ?::jsonb, ?, ?, ?)`,
				[
					actor.id,
					actor.email,
					action,
					userId,
					JSON.stringify({ ...change, before: summary(before), after: summary(after) }),
					trimmed,
					now,
					now,
				],
			);
			return after;
		});
	}

	async planSummary(em: EntityManager, userId: number, now: Date): Promise<AdminUserPlanDto> {
		const [row] = await em.execute<PlanSummaryRow[]>(
			`select u."plan" as "stored_plan", pro."latest", pro."open_ended", pro."count",
				${PLAN_KIND_SQL} as "kind", ${PRO_UNTIL_SQL} as "pro_until", ${PRO_PERMANENT_SQL} as "permanent"
			from "user" u
			${PLAN_SUMMARY_JOINS_SQL}
			where u."id" = ?`,
			[now, userId],
		);
		if (!row) throw new NotFoundException(`User ${userId} not found`);
		return {
			kind: row.kind,
			plan: resolvePlanStatus(row).plan,
			proUntil: iso(row.pro_until),
			permanent: Boolean(row.permanent),
		};
	}

	private async proStatus(em: EntityManager, userId: number, now: Date): Promise<AdminUserProDto> {
		// Sequential: inside a transaction every query shares one connection.
		const summary = await this.planSummary(em, userId, now);
		const [user] = await em.execute<{ plan: UserPlan }[]>(`select "plan" from "user" where "id" = ?`, [userId]);
		const grants = await em.execute<
			{
				source: EntitlementSource;
				expires_at: Date | null;
				deleted_at: Date | null;
				created_at: Date;
				updated_at: Date;
			}[]
		>(
			`select "source", "expires_at", "deleted_at", "created_at", "updated_at" from "entitlement"
			where "user_id" = ? and "plan" = 'pro'
			order by "created_at", "id"`,
			[userId],
		);
		return {
			...summary,
			storedPlan: user?.plan ?? "free",
			grants: grants.map((g) => ({
				source: g.source,
				expiresAt: iso(g.expires_at),
				active: g.deleted_at === null && (g.expires_at === null || new Date(g.expires_at) > now),
				revokedAt: iso(g.deleted_at),
				createdAt: new Date(g.created_at).toISOString(),
				updatedAt: new Date(g.updated_at).toISOString(),
			})),
		};
	}

	private async payments(userId: number): Promise<AdminPaymentDto[]> {
		const rows = await this.em.execute<
			{
				id: number;
				provider: string;
				event_id: string;
				checkout_ref: string;
				offer: string;
				amount_total: number | null;
				currency: string | null;
				paid_at: Date;
				pass_expires_at: Date | null;
			}[]
		>(
			`select "id", "provider", "event_id", "checkout_ref", "offer", "amount_total", "currency", "paid_at", "pass_expires_at"
			from "payment" where "user_id" = ? and "deleted_at" is null
			order by "paid_at" desc, "id" desc`,
			[userId],
		);
		return rows.map((row) => ({
			id: row.id,
			provider: row.provider,
			offer: row.offer,
			amountTotal: row.amount_total,
			currency: row.currency,
			paidAt: new Date(row.paid_at).toISOString(),
			passExpiresAt: iso(row.pass_expires_at),
			dashboardUrl: paymentDashboardUrl(row.provider, row.event_id, row.checkout_ref),
		}));
	}

	// Reads the same counter GenerationQuotaGuard increments, without
	// spending it.
	private async generationUsage(userId: number, now: Date): Promise<AdminUserBillingDto["generationToday"]> {
		const tier = this.config.billing.enabled ? await this.entitlements.quotaTier({ id: userId }, now) : null;
		const limit = generationQuotaLimit(this.config, tier);
		const used = await this.cache.readCounter(GENERATION_QUOTA_COUNTER, generationQuotaKey(`user:${userId}`, now));
		return { used, limit: limit > 0 ? limit : null, tier };
	}

	private async auditLog(userId: number): Promise<AdminAuditEntryDto[]> {
		const rows = await this.em.execute<
			{
				id: number;
				action: AdminAuditAction;
				actor_id: number | null;
				actor_email: string;
				reason: string;
				details: Record<string, unknown> | string;
				created_at: Date;
			}[]
		>(
			`select "id", "action", "actor_id", "actor_email", "reason", "details", "created_at"
			from "admin_audit_entry" where "target_user_id" = ? and "deleted_at" is null
			order by "created_at" desc, "id" desc
			limit ?`,
			[userId, AUDIT_LOG_LIMIT],
		);
		return rows.map((row) => ({
			id: row.id,
			action: row.action,
			actorId: row.actor_id,
			actorEmail: row.actor_email,
			reason: row.reason,
			details: typeof row.details === "string" ? JSON.parse(row.details) : row.details,
			createdAt: new Date(row.created_at).toISOString(),
		}));
	}

	async metrics(days: number, now = new Date()): Promise<AdminProMetricsDto> {
		const windowStart = utcDayStart(now, days - 1);
		const [proUsersDaily, revenue, limits, endingSoon] = await Promise.all([
			this.proUsersDaily(windowStart, now),
			this.revenue(windowStart, days, now),
			this.limits(windowStart, days, now),
			this.endingSoon(now),
		]);
		return { proUsersDaily, ...revenue, limits, endingSoon };
	}

	// Users on Pro at the end of each day (now, for today), rebuilt from the
	// Entitlement rows. A stored Pro Plan has no start date and counts from
	// signup. Approximate: each (User, Plan, source) keeps one row that a new
	// grant or purchase overwrites, so a re-grant after a lapse or revocation
	// also counts the User on the days in between.
	private async proUsersDaily(windowStart: Date, now: Date): Promise<AdminProMetricsDto["proUsersDaily"]> {
		const rows = await this.em.execute<{ d: string; count: number }[]>(
			`with days as (
				select d, least(d + interval '1 day', ?::timestamptz) as "at"
				from generate_series(?::timestamptz, ?::timestamptz, interval '1 day') d
			)
			select to_char(days.d at time zone 'UTC', 'YYYY-MM-DD') as d,
				(select count(*)::int from "user" u
				 where u."deleted_at" is null and u."created_at" <= days."at"
				   and (u."plan" = 'pro' or exists (
						select 1 from "entitlement" e
						where e."user_id" = u."id" and e."plan" = 'pro' and e."created_at" <= days."at"
						  and (e."expires_at" is null or e."expires_at" > days."at")
						  and (e."deleted_at" is null or e."deleted_at" > days."at")
				   ))) as count
			from days
			order by days.d`,
			[now, windowStart, utcDayStart(now, 0)],
		);
		return rows.map((row) => ({ date: row.d, count: Number(row.count) }));
	}

	private async revenue(
		windowStart: Date,
		days: number,
		now: Date,
	): Promise<Pick<AdminProMetricsDto, "currency" | "revenueDaily" | "revenueTotals">> {
		const rows = await this.em.execute<{ d: string; currency: string | null; amount: number; count: number }[]>(
			`select to_char("paid_at" at time zone 'UTC', 'YYYY-MM-DD') as d, "currency",
				coalesce(sum("amount_total"), 0)::int as amount, count(*)::int as count
			from "payment"
			where "deleted_at" is null and "paid_at" >= ?
			group by 1, 2`,
			[windowStart],
		);
		const totals = new Map<string, { currency: string; amount: number; payments: number }>();
		for (const row of rows) {
			const currency = row.currency ?? "unknown";
			const total = totals.get(currency) ?? { currency, amount: 0, payments: 0 };
			total.amount += Number(row.amount);
			total.payments += Number(row.count);
			totals.set(currency, total);
		}
		const revenueTotals = [...totals.values()].sort((a, b) => b.payments - a.payments || b.amount - a.amount);
		const currency = revenueTotals[0]?.currency ?? null;
		const byDay = new Map(
			rows.filter((row) => (row.currency ?? "unknown") === currency).map((row) => [row.d, Number(row.amount)]),
		);
		return {
			currency,
			revenueDaily: utcDays(days, now).map((date) => ({ date, amount: byDay.get(date) ?? 0 })),
			revenueTotals,
		};
	}

	private async limits(windowStart: Date, days: number, now: Date): Promise<AdminProMetricsDto["limits"]> {
		const hits = await this.productEventStats.dailyUserHashes(Object.values(LIMIT_EVENTS), days);
		if (!hits) return { productEventsAvailable: false, daily: [], conversion: null };
		const payments = await this.em.execute<{ user_id: number; paid_at: Date }[]>(
			`select "user_id", "paid_at" from "payment"
			where "user_id" is not null and "deleted_at" is null and "paid_at" >= ?`,
			[windowStart],
		);
		const salt = this.config.analytics.salt;
		return {
			productEventsAvailable: true,
			daily: limitHitSeries(hits, days, now),
			conversion: limitConversion(
				hits,
				payments.map((p) => ({ userIdHash: hashUserId(salt, p.user_id), paidAt: new Date(p.paid_at) })),
				now,
			),
		};
	}

	private async endingSoon(now: Date): Promise<AdminProMetricsDto["endingSoon"]> {
		const until = new Date(now.getTime() + ENDING_SOON_DAYS * DAY_MS);
		const rows = await this.em.execute<{ id: number; email: string; name: string; kind: PlanKind; pro_until: Date }[]>(
			`select * from (
				select u."id", u."email", u."name", ${PLAN_KIND_SQL} as "kind", ${PRO_UNTIL_SQL} as "pro_until"
				from "user" u
				${PLAN_SUMMARY_JOINS_SQL}
				where u."deleted_at" is null
			) s
			where s."kind" not in ('free', 'pro_expired') and s."pro_until" > ? and s."pro_until" <= ?
			order by s."pro_until", s."id"
			limit ?`,
			[now, now, until, ENDING_SOON_LIST],
		);
		const [{ count } = { count: 0 }] = await this.em.execute<{ count: number }[]>(
			`select count(*)::int as count from (
				select ${PLAN_KIND_SQL} as "kind", ${PRO_UNTIL_SQL} as "pro_until"
				from "user" u
				${PLAN_SUMMARY_JOINS_SQL}
				where u."deleted_at" is null
			) s
			where s."kind" not in ('free', 'pro_expired') and s."pro_until" > ? and s."pro_until" <= ?`,
			[now, now, until],
		);
		return {
			count: Number(count),
			users: rows.map((row) => ({
				id: row.id,
				email: row.email,
				name: row.name,
				kind: row.kind,
				proUntil: new Date(row.pro_until).toISOString(),
			})),
		};
	}
}

// The Payment's webhook event in the Stripe dashboard. Built from stored ids
// only, and only when they look like Stripe ids, so nothing else can end up
// in the link. Test-mode checkouts (cs_test_…) link into test mode.
export function paymentDashboardUrl(provider: string, eventId: string, checkoutRef: string): string | null {
	if (provider !== "stripe" || !/^evt_[A-Za-z0-9]+$/.test(eventId)) return null;
	const mode = checkoutRef.startsWith("cs_test_") ? "test/" : "";
	return `https://dashboard.stripe.com/${mode}events/${eventId}`;
}

// Midnight UTC `daysAgo` days before `now`.
function utcDayStart(now: Date, daysAgo: number): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - daysAgo * DAY_MS);
}

// Every UTC day in the window, oldest first, as YYYY-MM-DD.
function utcDays(days: number, now: Date): string[] {
	return Array.from({ length: days }, (_, i) =>
		utcDayStart(now, days - 1 - i)
			.toISOString()
			.slice(0, 10),
	);
}

// Distinct Users per UTC day who hit each limit, every day in the window
// filled so a quiet day charts as zero.
export function limitHitSeries(
	hits: ReadonlyArray<ProductEventUserDay>,
	days: number,
	now = new Date(),
): AdminLimitHitPointDto[] {
	const users = new Map<string, { savedRoutes: Set<string>; generationQuota: Set<string> }>();
	for (const date of utcDays(days, now)) users.set(date, { savedRoutes: new Set(), generationQuota: new Set() });
	for (const hit of hits) {
		const day = users.get(hit.date);
		if (!day) continue;
		if (hit.eventName === LIMIT_EVENTS.savedRoutes) day.savedRoutes.add(hit.userIdHash);
		else if (hit.eventName === LIMIT_EVENTS.generationQuota) day.generationQuota.add(hit.userIdHash);
	}
	return [...users.entries()].map(([date, day]) => ({
		date,
		savedRoutes: day.savedRoutes.size,
		generationQuota: day.generationQuota.size,
	}));
}

// Of the Users who hit a limit in the window, how many bought a Pro pass
// within LIMIT_CONVERSION_DAYS of their first hit. Users matched by
// user_id_hash, since ProductEvents never carry the raw id (ADR-0020).
export function limitConversion(
	hits: ReadonlyArray<ProductEventUserDay>,
	payments: ReadonlyArray<{ userIdHash: string; paidAt: Date }>,
	now = new Date(),
): AdminLimitConversionDto {
	const firstHit = new Map<string, number>();
	for (const hit of hits) {
		const at = hit.firstAt.getTime();
		const seen = firstHit.get(hit.userIdHash);
		if (seen === undefined || at < seen) firstHit.set(hit.userIdHash, at);
	}
	const paidAt = new Map<string, number[]>();
	for (const payment of payments) {
		const list = paidAt.get(payment.userIdHash) ?? [];
		list.push(payment.paidAt.getTime());
		paidAt.set(payment.userIdHash, list);
	}
	const window = LIMIT_CONVERSION_DAYS * DAY_MS;
	let converted = 0;
	let pending = 0;
	for (const [hash, at] of firstHit) {
		if ((paidAt.get(hash) ?? []).some((paid) => paid >= at && paid <= at + window)) converted++;
		else if (now.getTime() - at < window) pending++;
	}
	const hitUsers = firstHit.size;
	return {
		hitUsers,
		converted,
		conversionPct: hitUsers > 0 ? Math.round((converted / hitUsers) * 1000) / 10 : 0,
		pending,
	};
}
