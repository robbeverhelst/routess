import { EntityManager } from "@mikro-orm/core";
import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { Entitlement } from "../entities/entitlement.entity";
import type { UserPlan } from "../entities/user.entity";
import type { Feature, PlanFeatureMatrix } from "./features";

export const PLAN_FEATURE_MATRIX = Symbol("PLAN_FEATURE_MATRIX");

// Anonymous callers pass null and are treated as the free Plan with no grants.
export type EntitlementSubject = { id: number; plan: UserPlan } | null;

// The API's single answer to "may this User use this Feature?" (#135, ADR
// 0039). No endpoint consults it yet; gating lands per Feature once the
// pricing model is decided.
@Injectable()
export class EntitlementsService {
	constructor(
		private readonly em: EntityManager,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
		@Inject(PLAN_FEATURE_MATRIX) private readonly planFeatures: PlanFeatureMatrix,
	) {}

	async can(user: EntitlementSubject, feature: Feature, now = new Date()): Promise<boolean> {
		// Billing off is the self-host story and today's hosted app: everything
		// is unlocked, so a self-hosted instance never meets a paywall.
		if (!this.config.billing.enabled) return true;
		if (this.planFeatures[user?.plan ?? "free"].includes(feature)) return true;
		if (!user) return false;

		const grants = await this.em.count(Entitlement, {
			user: user.id,
			feature,
			$or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
		});
		return grants > 0;
	}
}
