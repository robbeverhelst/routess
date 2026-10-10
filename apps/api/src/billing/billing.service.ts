import { EntityManager } from "@mikro-orm/postgresql";
import { ForbiddenException, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { User } from "../entities/user.entity";
import { EntitlementsService } from "../entitlements/entitlements.service";
import {
	BILLING_PROVIDER,
	type BillingProvider,
	type CheckoutSession,
	type PassPurchasedEvent,
	type WebhookDelivery,
} from "./billing-provider";
import type { BillingStatusDto } from "./dto/billing.dto";
import { type BillingOffer, OFFER_GRANTS } from "./offers";

// The OG grant (ADR 0039): accounts created before the billing launch get
// three months of Pro, once, on their next login.
const OG_GRANT_LENGTH = { months: 3 } as const;

export type WebhookOutcome = "applied" | "duplicate" | "ignored" | "orphaned";

// The payments flow (#135, ADR 0039): hosted checkout out, webhook in, Pro
// time written from the webhook only. With billing off (the default) every
// entry point refuses with 503 and the status says so.
@Injectable()
export class BillingService {
	private readonly logger = new Logger(BillingService.name);

	constructor(
		@Inject(BILLING_PROVIDER) private readonly provider: BillingProvider | null,
		private readonly em: EntityManager,
		private readonly entitlements: EntitlementsService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
	) {}

	get enabled(): boolean {
		return this.provider !== null;
	}

	// What the upgrade page and the billing settings show. Reading it as a
	// signed-in User also hands out a pending OG grant, so someone whose
	// session outlived the launch gets it without signing in again.
	async status(userId: number | null, now = new Date()): Promise<BillingStatusDto> {
		if (!this.provider) return { enabled: false };
		const grant = OFFER_GRANTS.pro_year_pass;
		const base: BillingStatusDto = {
			enabled: true,
			offer: {
				id: "pro_year_pass",
				plan: grant.plan,
				days: grant.days,
				price: await this.provider.describeOffer("pro_year_pass"),
			},
			generationPerDay: { ...this.config.quotas.generationPerDayByTier },
			account: null,
		};
		if (userId === null) return base;

		const user = await this.em.findOne(User, { id: userId });
		if (!user) return base;
		await this.applyOgGrant(user, now);
		const plan = await this.entitlements.planStatus(user, now);
		const [og] = await this.em.execute<{ expires_at: Date | null }[]>(
			`select "expires_at" from "entitlement" where "user_id" = ? and "plan" = 'pro' and "source" = 'og-grant' and "deleted_at" is null`,
			[user.id],
		);
		const permanentPro = plan.plan === "pro" && plan.proExpiresAt === null;
		return {
			...base,
			account: {
				plan: plan.plan,
				proExpiresAt: plan.proExpiresAt?.toISOString() ?? null,
				ogGrantExpiresAt: og?.expires_at ? new Date(og.expires_at).toISOString() : null,
				canBuy: !permanentPro && user.deletionStatus === "active",
			},
		};
	}

	// A billing hiccup must never fail the status read: log it and let the
	// next read or login retry the grant.
	private async applyOgGrant(user: User, now: Date): Promise<void> {
		try {
			await this.grantOgPassIfEligible(user, now);
		} catch (error) {
			this.logger.error(
				`OG grant failed for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async startCheckout(
		user: { id: number; email: string },
		offer: BillingOffer,
		frontendUrl = this.config.app.frontendUrl,
	): Promise<CheckoutSession> {
		const provider = this.requireProvider();
		const stored = await this.em.findOne(User, { id: user.id });
		if (stored?.deletionStatus !== "active") {
			throw new ForbiddenException("This account cannot buy a pass");
		}
		const base = frontendUrl.replace(/\/+$/, "");
		return provider.createCheckout({
			userId: stored.id,
			email: stored.email,
			offer,
			// Stripe substitutes {CHECKOUT_SESSION_ID}; the page only shows a
			// thank-you while it waits for the webhook, which owns Pro state.
			successUrl: `${base}/upgrade?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${base}/upgrade?checkout=cancelled`,
		});
	}

	async handleWebhook(delivery: WebhookDelivery): Promise<WebhookOutcome> {
		const event = await this.requireProvider().parseWebhook(delivery);
		if (!event) return "ignored";
		return this.applyEvent(event);
	}

	// Idempotent on the provider event id (and on the checkout ref): the
	// payment row is inserted first and a conflict means this payment was
	// already applied. The User row lock serializes concurrent passes so each
	// one extends from the expiry the previous one wrote.
	async applyEvent(event: PassPurchasedEvent): Promise<WebhookOutcome> {
		return this.em.transactional(async (em) => {
			// Soft-deleted Users are still Users (they can come back); only a
			// hard-deleted one is gone.
			const [user] = await em.execute<{ id: number }[]>(`select "id" from "user" where "id" = ? for update`, [
				event.userId,
			]);
			const inserted = await em.execute<{ id: number }[]>(
				`insert into "payment" ("user_id", "provider", "event_id", "checkout_ref", "offer", "amount_total", "currency", "paid_at", "created_at", "updated_at")
				values (?, ?, ?, ?, ?, ?, ?, ?, now(), now())
				on conflict do nothing
				returning "id"`,
				[
					user ? user.id : null,
					this.requireProvider().name,
					event.eventId,
					event.providerRef,
					event.offer,
					event.amountTotal,
					event.currency,
					event.paidAt,
				],
			);
			if (inserted.length === 0) {
				this.logger.log(`Ignoring duplicate billing event ${event.eventId} (${event.providerRef})`);
				return "duplicate";
			}
			if (!user) {
				// Paid, but the account is gone: kept for bookkeeping, refund by hand.
				this.logger.error(`Payment ${event.providerRef} for missing user ${event.userId}; refund it by hand`);
				return "orphaned";
			}

			const grant = OFFER_GRANTS[event.offer];
			const expiresAt = await this.entitlements.extendPlanGrant(em, {
				userId: user.id,
				plan: grant.plan,
				source: "billing",
				from: event.paidAt,
				length: { days: grant.days },
			});
			await em.execute(`update "payment" set "pass_expires_at" = ? where "id" = ?`, [expiresAt, inserted[0].id]);
			this.logger.log(`User ${user.id} ${grant.plan} until ${expiresAt.toISOString()} (${event.providerRef})`);
			return "applied";
		});
	}

	// Once per User, ever: the og-grant row's existence (even expired or
	// soft-deleted) is the marker, checked under the User row lock. Only while
	// billing is on and the launch moment has passed, and only for accounts
	// created before it. The three months extend any Pro time already held.
	async grantOgPassIfEligible(user: Pick<User, "id" | "createdAt">, now = new Date()): Promise<boolean> {
		const launchedAt = this.config.billing.launchedAt;
		if (!this.provider || !launchedAt || now < launchedAt || user.createdAt >= launchedAt) {
			return false;
		}
		if (await this.hasOgGrant(this.em, user.id)) return false;

		return this.em.transactional(async (em) => {
			const [locked] = await em.execute<{ id: number }[]>(`select "id" from "user" where "id" = ? for update`, [
				user.id,
			]);
			if (!locked || (await this.hasOgGrant(em, user.id))) return false;
			const expiresAt = await this.entitlements.extendPlanGrant(em, {
				userId: user.id,
				plan: "pro",
				source: "og-grant",
				from: now,
				length: OG_GRANT_LENGTH,
			});
			this.logger.log(`OG grant: user ${user.id} pro until ${expiresAt.toISOString()}`);
			return true;
		});
	}

	private async hasOgGrant(em: EntityManager, userId: number): Promise<boolean> {
		const rows = await em.execute(
			`select 1 from "entitlement" where "user_id" = ? and "plan" = 'pro' and "source" = 'og-grant'`,
			[userId],
		);
		return rows.length > 0;
	}

	private requireProvider(): BillingProvider {
		if (!this.provider) {
			throw new ServiceUnavailableException("Billing is not enabled on this instance");
		}
		return this.provider;
	}
}
