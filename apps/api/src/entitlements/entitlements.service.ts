import { EntityManager } from "@mikro-orm/postgresql";
import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig, GenerationQuotaTier } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { Entitlement, type EntitlementSource } from "../entities/entitlement.entity";
import type { UserPlan } from "../entities/user.entity";
import type { Feature, PlanFeatureMatrix } from "./features";
import { extendExpiry, type GrantLength } from "./grant-length";

export const PLAN_FEATURE_MATRIX = Symbol("PLAN_FEATURE_MATRIX");

// Anonymous callers pass null and are treated as the free Plan with no grants.
// The stored Plan is read from the database, so any object with the User id
// will do.
export type EntitlementSubject = { id: number } | null;

export interface PlanStatus {
	// The Plan in effect now: the stored Plan, or Pro while a Plan grant runs.
	plan: UserPlan;
	// When the Pro time from Plan grants ends. Null with plan 'pro' means Pro
	// does not expire (stored Plan or an open-ended grant).
	proExpiresAt: Date | null;
}

interface PlanStatusRow {
	stored_plan: UserPlan;
	latest: Date | null;
	open_ended: boolean | null;
	count: number;
}

// The API's single answer to "may this User use this Feature?" and "which
// Plan is this User on right now?" (#135, ADR 0039).
@Injectable()
export class EntitlementsService {
	constructor(
		private readonly em: EntityManager,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
		@Inject(PLAN_FEATURE_MATRIX) private readonly planFeatures: PlanFeatureMatrix,
	) {}

	async can(user: EntitlementSubject, feature: Feature, now = new Date()): Promise<boolean> {
		// Billing off is the self-host story: everything is unlocked, so a
		// self-hosted instance never meets a paywall.
		if (!this.config.billing.enabled) return true;
		const plan = user ? (await this.planStatus(user, now)).plan : "free";
		if (this.planFeatures[plan].includes(feature)) return true;
		if (!user) return false;

		const grants = await this.em.count(Entitlement, {
			user: user.id,
			feature,
			$or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
		});
		return grants > 0;
	}

	async planStatus(user: NonNullable<EntitlementSubject>, now = new Date()): Promise<PlanStatus> {
		const [row] = await this.em.execute<PlanStatusRow[]>(
			`select u."plan" as "stored_plan",
				max(e."expires_at") as "latest",
				bool_or(e."id" is not null and e."expires_at" is null) as "open_ended",
				count(e."id")::int as "count"
			from "user" u
			left join "entitlement" e on e."user_id" = u."id" and e."plan" = 'pro' and e."deleted_at" is null
				and (e."expires_at" is null or e."expires_at" > ?)
			where u."id" = ?
			group by u."plan"`,
			[now, user.id],
		);
		if (!row) return { plan: "free", proExpiresAt: null };
		if (row.stored_plan === "pro" || row.open_ended) return { plan: "pro", proExpiresAt: null };
		if (row.count === 0) return { plan: row.stored_plan, proExpiresAt: null };
		return { plan: "pro", proExpiresAt: new Date(row.latest as Date) };
	}

	// Which generation quota applies (ADR 0039): anonymous, or the Plan in effect.
	async quotaTier(user: EntitlementSubject, now = new Date()): Promise<GenerationQuotaTier> {
		if (!user) return "anonymous";
		return (await this.planStatus(user, now)).plan;
	}

	// Starts or extends the User's Plan grant from `source` and returns its new
	// expiry. The length counts from `from` or from the end of the time the
	// User already holds on that Plan (any source), whichever is later. Run it
	// inside a transaction that holds the User row lock (`select ... for
	// update`), so two concurrent grants cannot both extend from the same end.
	async extendPlanGrant(
		em: EntityManager,
		grant: { userId: number; plan: UserPlan; source: EntitlementSource; from: Date; length: GrantLength },
	): Promise<Date> {
		const [current] = await em.execute<{ latest: Date | null }[]>(
			`select max("expires_at") as "latest" from "entitlement"
			where "user_id" = ? and "plan" = ? and "deleted_at" is null`,
			[grant.userId, grant.plan],
		);
		const expiresAt = extendExpiry(current?.latest ? new Date(current.latest) : null, grant.from, grant.length);
		await em.execute(
			`insert into "entitlement" ("user_id", "plan", "source", "expires_at", "created_at", "updated_at")
			values (?, ?, ?, ?, now(), now())
			on conflict ("user_id", "plan", "source")
			do update set "expires_at" = excluded."expires_at", "deleted_at" = null, "updated_at" = now()`,
			[grant.userId, grant.plan, grant.source, expiresAt],
		);
		return expiresAt;
	}
}
