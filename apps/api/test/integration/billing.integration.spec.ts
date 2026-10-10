import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";

import Stripe = require("stripe");

import { SessionService } from "src/auth/session.service";
import { BillingService } from "src/billing/billing.service";
import { BILLING_PROVIDER, type CheckoutRequest } from "src/billing/billing-provider";
import { StripeBillingProvider } from "src/billing/stripe-billing.provider";
import { CacheService } from "src/cache/cache.service";
import { type AppConfig, getAppConfig } from "src/config/app-config";
import { APP_CONFIG } from "src/config/config.module";
import { Entitlement } from "src/entities/entitlement.entity";
import { Payment } from "src/entities/payment.entity";
import { User } from "src/entities/user.entity";
import { EntitlementsService } from "src/entitlements/entitlements.service";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const STRIPE = { secretKey: "sk_test_dummy", webhookSecret: "whsec_test_secret", proYearPassPriceId: "price_pass" };
const LAUNCHED_AT = new Date("2026-01-01T00:00:00Z");
const BEFORE_LAUNCH = new Date("2025-06-01T00:00:00Z");
const QUOTAS = { anonymous: 1, free: 2, pro: 4 };

// Signature checks are local HMAC work; this client never reaches the network.
const stripe = new Stripe(STRIPE.secretKey);

// The real Stripe provider (signature verification and event parsing), with
// the two calls that would reach Stripe stubbed.
class TestStripeProvider extends StripeBillingProvider {
	readonly checkouts: CheckoutRequest[] = [];

	override async createCheckout(request: CheckoutRequest) {
		this.checkouts.push(request);
		return { url: `https://checkout.stripe.test/${request.userId}`, providerRef: `cs_${request.userId}` };
	}

	override async describeOffer() {
		return { amount: 2999, currency: "eur" };
	}
}

function billingConfig(): AppConfig {
	const base = getAppConfig();
	return {
		...base,
		quotas: { ...base.quotas, generationPerDayByTier: QUOTAS },
		billing: { enabled: true, provider: "stripe", launchedAt: LAUNCHED_AT, stripe: STRIPE },
	};
}

function completedEvent(eventId: string, userId: number, paidAt: Date, sessionId = `cs_${eventId}`) {
	return {
		id: eventId,
		object: "event",
		type: "checkout.session.completed",
		created: Math.floor(paidAt.getTime() / 1000),
		data: {
			object: {
				id: sessionId,
				object: "checkout.session",
				mode: "payment",
				payment_status: "paid",
				client_reference_id: String(userId),
				metadata: { userId: String(userId), offer: "pro_year_pass" },
				amount_total: 2999,
				currency: "eur",
			},
		},
	};
}

// Whole seconds: a Stripe event's `created` has no milliseconds.
function secondsAgo(seconds: number): Date {
	return new Date((Math.floor(Date.now() / 1000) - seconds) * 1000);
}

describe("Billing with Stripe enabled", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let provider: TestStripeProvider;
	let billing: BillingService;
	let entitlements: EntitlementsService;

	beforeAll(async () => {
		provider = new TestStripeProvider(STRIPE, stripe);
		app = await createTestApp({
			configure: (builder) =>
				builder
					.overrideProvider(APP_CONFIG)
					.useValue(billingConfig())
					.overrideProvider(BILLING_PROVIDER)
					.useValue(provider),
		});
		orm = app.get(MikroORM);
		billing = app.get(BillingService);
		entitlements = app.get(EntitlementsService);
	});

	beforeEach(async () => {
		await clearDatabase(app);
		provider.checkouts.length = 0;
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	async function postWebhook(payload: unknown, secret = STRIPE.webhookSecret) {
		const body = JSON.stringify(payload);
		const signature = await stripe.webhooks.generateTestHeaderStringAsync({ payload: body, secret });
		return supertest(app.getHttpServer())
			.post("/api/v1/billing/webhook")
			.set("Content-Type", "application/json")
			.set("Stripe-Signature", signature)
			.send(body);
	}

	function proRows(userId: number): Promise<Entitlement[]> {
		return withRequestContext(app, () =>
			orm.em.fork().find(Entitlement, { user: userId, plan: "pro" }, { orderBy: { source: "ASC" } }),
		);
	}

	function payments(): Promise<Payment[]> {
		return withRequestContext(app, () => orm.em.fork().find(Payment, {}, { populate: ["user"] }));
	}

	function planStatus(userId: number) {
		return withRequestContext(app, () => entitlements.planStatus({ id: userId }));
	}

	async function backdate(userId: number, createdAt: Date) {
		await withRequestContext(app, () => orm.em.nativeUpdate(User, { id: userId }, { createdAt }));
	}

	describe("webhook", () => {
		it("grants a year of Pro from the payment moment on a signed checkout.session.completed", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "buyer@example.com", googleId: "g-buyer" });
			const paidAt = secondsAgo(60);

			const response = await postWebhook(completedEvent("evt_1", user.id, paidAt));
			expect(response.status).toBe(200);
			expect(response.body).toEqual({ received: true });

			const expected = new Date(paidAt.getTime() + 365 * DAY_MS);
			expect(await planStatus(user.id)).toEqual({ plan: "pro", proExpiresAt: expected });
			const [row] = await proRows(user.id);
			expect(row).toMatchObject({ source: "billing", expiresAt: expected });
			const [payment] = await payments();
			expect(payment).toMatchObject({
				eventId: "evt_1",
				checkoutRef: "cs_evt_1",
				offer: "pro_year_pass",
				amountTotal: 2999,
				currency: "eur",
				paidAt,
				passExpiresAt: expected,
			});
			expect(payment.user?.id).toBe(user.id);
		});

		it("rejects an invalid or missing signature with 400 and writes nothing", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "forged@example.com", googleId: "g-forged" });

			const forged = await postWebhook(completedEvent("evt_forged", user.id, secondsAgo(1)), "whsec_attacker");
			expect(forged.status).toBe(400);

			const unsigned = await supertest(app.getHttpServer())
				.post("/api/v1/billing/webhook")
				.set("Content-Type", "application/json")
				.send(JSON.stringify(completedEvent("evt_unsigned", user.id, secondsAgo(1))));
			expect(unsigned.status).toBe(400);

			expect(await proRows(user.id)).toHaveLength(0);
			expect(await payments()).toHaveLength(0);
		});

		it("acknowledges a redelivered event without extending twice", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "dup@example.com", googleId: "g-dup" });
			const paidAt = secondsAgo(60);
			const event = completedEvent("evt_dup", user.id, paidAt);

			expect((await postWebhook(event)).status).toBe(200);
			expect((await postWebhook(event)).status).toBe(200);
			// Same session under another event id is the same payment, too.
			expect((await postWebhook({ ...event, id: "evt_dup_2" })).status).toBe(200);

			expect(await planStatus(user.id)).toEqual({
				plan: "pro",
				proExpiresAt: new Date(paidAt.getTime() + 365 * DAY_MS),
			});
			expect(await payments()).toHaveLength(1);
		});

		it("serializes concurrent deliveries of the same event", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "race@example.com", googleId: "g-race" });
			const event = completedEvent("evt_race", user.id, secondsAgo(60));

			const responses = await Promise.all([postWebhook(event), postWebhook(event), postWebhook(event)]);
			expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
			expect(await payments()).toHaveLength(1);
		});

		it("extends a second pass from the current expiry", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "again@example.com", googleId: "g-again" });
			const firstPaid = secondsAgo(120);
			const secondPaid = secondsAgo(60);

			await postWebhook(completedEvent("evt_a", user.id, firstPaid));
			await postWebhook(completedEvent("evt_b", user.id, secondPaid));

			const expected = new Date(firstPaid.getTime() + 730 * DAY_MS);
			expect(await planStatus(user.id)).toEqual({ plan: "pro", proExpiresAt: expected });
			const all = await payments();
			expect(all.map((p) => p.passExpiresAt?.getTime()).sort()).toEqual(
				[firstPaid.getTime() + 365 * DAY_MS, expected.getTime()].sort(),
			);
		});

		it("ignores events billing does not act on", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "other@example.com", googleId: "g-other" });
			const expired = { ...completedEvent("evt_expired", user.id, secondsAgo(1)), type: "checkout.session.expired" };

			expect((await postWebhook(expired)).status).toBe(200);
			expect(await proRows(user.id)).toHaveLength(0);
		});

		it("records a payment for a hard-deleted User without granting anything", async () => {
			const response = await postWebhook(completedEvent("evt_gone", 999_999, secondsAgo(1)));

			expect(response.status).toBe(200);
			const [payment] = await payments();
			expect(payment).toMatchObject({ eventId: "evt_gone", passExpiresAt: null });
			expect(payment.user).toBeNull();
		});

		it("keeps the payment row, without its User, when the User is hard-deleted", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "leaver@example.com", googleId: "g-leaver" });
			await postWebhook(completedEvent("evt_leaver", user.id, secondsAgo(1)));

			await withRequestContext(app, async () => {
				const conn = orm.em.getConnection();
				await conn.execute(`delete from "session" where "user_id" = ?`, [user.id]);
				await conn.execute(`delete from "user" where "id" = ?`, [user.id]);
			});

			expect(await proRows(user.id)).toHaveLength(0);
			const [payment] = await payments();
			expect(payment).toMatchObject({ eventId: "evt_leaver" });
			expect(payment.user).toBeNull();
		});
	});

	describe("OG grant", () => {
		it("gives a pre-launch account 3 months of Pro on its next login, once", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "og@example.com", googleId: "g-og" });
			expect(await proRows(user.id)).toHaveLength(0);
			await backdate(user.id, BEFORE_LAUNCH);

			const before = new Date();
			await withRequestContext(app, () => app.get(SessionService).createSession(user.id));
			await withRequestContext(app, () => app.get(SessionService).createSession(user.id));

			const rows = await proRows(user.id);
			expect(rows).toHaveLength(1);
			expect(rows[0].source).toBe("og-grant");
			const expiresAt = rows[0].expiresAt as Date;
			expect(expiresAt.getTime()).toBeGreaterThan(before.getTime() + 88 * DAY_MS);
			expect(expiresAt.getTime()).toBeLessThan(before.getTime() + 93 * DAY_MS);
			expect((await planStatus(user.id)).plan).toBe("pro");
		});

		it("is idempotent under concurrent logins and status reads", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "og-race@example.com", googleId: "g-og-race" });
			await backdate(user.id, BEFORE_LAUNCH);
			const stored = { id: user.id, createdAt: BEFORE_LAUNCH };

			const granted = await Promise.all(
				[0, 1, 2, 3].map(() => withRequestContext(app, () => billing.grantOgPassIfEligible(stored))),
			);
			expect(granted.filter(Boolean)).toHaveLength(1);
			expect(await proRows(user.id)).toHaveLength(1);
		});

		it("never comes back once given, even after it expired or was revoked", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "og-once@example.com", googleId: "g-og-once" });
			await backdate(user.id, BEFORE_LAUNCH);
			const stored = { id: user.id, createdAt: BEFORE_LAUNCH };
			expect(await withRequestContext(app, () => billing.grantOgPassIfEligible(stored))).toBe(true);

			await withRequestContext(app, () =>
				orm.em.nativeUpdate(Entitlement, { user: user.id, source: "og-grant" }, { expiresAt: secondsAgo(10) }),
			);
			expect(await withRequestContext(app, () => billing.grantOgPassIfEligible(stored))).toBe(false);

			await withRequestContext(app, () =>
				orm.em.nativeUpdate(Entitlement, { user: user.id, source: "og-grant" }, { deletedAt: new Date() }),
			);
			expect(await withRequestContext(app, () => billing.grantOgPassIfEligible(stored))).toBe(false);
		});

		it("skips accounts created after the launch, and waits for the launch moment", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "new@example.com", googleId: "g-new" });
			expect(await withRequestContext(app, () => billing.grantOgPassIfEligible(user))).toBe(false);

			const early = { id: user.id, createdAt: BEFORE_LAUNCH };
			const beforeLaunch = new Date(LAUNCHED_AT.getTime() - DAY_MS);
			expect(await withRequestContext(app, () => billing.grantOgPassIfEligible(early, beforeLaunch))).toBe(false);
			expect(await proRows(user.id)).toHaveLength(0);
		});

		it("stacks with a pass: a later purchase extends from the OG expiry", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "og-buy@example.com", googleId: "g-og-buy" });
			await backdate(user.id, BEFORE_LAUNCH);
			await withRequestContext(app, () => billing.grantOgPassIfEligible({ id: user.id, createdAt: BEFORE_LAUNCH }));
			const ogExpiry = (await proRows(user.id))[0].expiresAt as Date;

			await postWebhook(completedEvent("evt_og_buy", user.id, secondsAgo(1)));

			expect(await planStatus(user.id)).toEqual({
				plan: "pro",
				proExpiresAt: new Date(ogExpiry.getTime() + 365 * DAY_MS),
			});
		});
	});

	describe("checkout and status endpoints", () => {
		it("starts a checkout for a signed-in User with the upgrade page as return URLs", async () => {
			const { user, accessToken } = await createTestUserWithAuth(app, { email: "co@example.com", googleId: "g-co" });

			const response = await supertest(app.getHttpServer())
				.post("/api/v1/billing/checkout")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({});

			expect(response.status).toBe(201);
			expect(response.body).toEqual({ url: `https://checkout.stripe.test/${user.id}` });
			expect(provider.checkouts[0]).toMatchObject({ userId: user.id, email: "co@example.com", offer: "pro_year_pass" });
			expect(provider.checkouts[0].successUrl).toMatch(
				/\/upgrade\?checkout=success&session_id=\{CHECKOUT_SESSION_ID\}$/,
			);
			expect(provider.checkouts[0].cancelUrl).toMatch(/\/upgrade\?checkout=cancelled$/);
		});

		it("requires a session and a known offer, and refuses accounts pending deletion", async () => {
			await supertest(app.getHttpServer()).post("/api/v1/billing/checkout").send({}).expect(401);

			const { user, accessToken } = await createTestUserWithAuth(app, { email: "co2@example.com", googleId: "g-co2" });
			await supertest(app.getHttpServer())
				.post("/api/v1/billing/checkout")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ offer: "pro_lifetime" })
				.expect(400);

			await withRequestContext(app, () =>
				orm.em.nativeUpdate(User, { id: user.id }, { deletionStatus: "pending_hard_delete" }),
			);
			await supertest(app.getHttpServer())
				.post("/api/v1/billing/checkout")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({})
				.expect(403);
			expect(provider.checkouts).toHaveLength(0);
		});

		it("reports the offer and quotas to anyone, and the account to its owner", async () => {
			const anonymous = await supertest(app.getHttpServer()).get("/api/v1/billing").expect(200);
			expect(anonymous.body).toEqual({
				enabled: true,
				offer: { id: "pro_year_pass", plan: "pro", days: 365, price: { amount: 2999, currency: "eur" } },
				generationPerDay: QUOTAS,
				account: null,
			});

			const { user, accessToken } = await createTestUserWithAuth(app, { email: "st@example.com", googleId: "g-st" });
			const free = await supertest(app.getHttpServer())
				.get("/api/v1/billing")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			expect(free.body.account).toEqual({ plan: "free", proExpiresAt: null, ogGrantExpiresAt: null, canBuy: true });

			// Reading the status hands a pending OG grant to a pre-launch account.
			await backdate(user.id, BEFORE_LAUNCH);
			const og = await supertest(app.getHttpServer())
				.get("/api/v1/billing")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			expect(og.body.account.plan).toBe("pro");
			expect(og.body.account.ogGrantExpiresAt).toBe(og.body.account.proExpiresAt);
			expect(og.body.account.canBuy).toBe(true);
		});
	});

	describe("generation quota per tier", () => {
		// User ids restart with every schema refresh, so a previous test's
		// counter for user:1 would leak in; drop the in-memory counters.
		beforeEach(() => {
			(app.get(CacheService) as unknown as { memory: Map<string, unknown> }).memory.clear();
		});

		// The quota guard runs before validation, so an empty body still
		// counts an attempt and answers 400 until the cap is reached.
		async function attempts(count: number, token?: string): Promise<number[]> {
			const statuses: number[] = [];
			for (let i = 0; i < count; i++) {
				const request = supertest(app.getHttpServer()).post("/api/v1/generation");
				if (token) request.set("Authorization", `Bearer ${token}`);
				statuses.push((await request.send({})).status);
			}
			return statuses;
		}

		it("caps anonymous callers at the anonymous allowance and points them to sign in", async () => {
			expect(await attempts(2)).toEqual([400, 429]);
			const response = await supertest(app.getHttpServer()).post("/api/v1/generation").send({});
			expect(response.body).toMatchObject({
				statusCode: 429,
				code: "RATE_LIMITED",
				details: { reason: "generation_quota", limit: QUOTAS.anonymous, tier: "anonymous", upgrade: "sign_in" },
			});
		});

		it("caps free Users at the free allowance and offers Pro", async () => {
			const { accessToken } = await createTestUserWithAuth(app, { email: "q-free@example.com", googleId: "g-qf" });
			expect(await attempts(3, accessToken)).toEqual([400, 400, 429]);
			const response = await supertest(app.getHttpServer())
				.post("/api/v1/generation")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({});
			expect(response.body.details).toMatchObject({ tier: "free", upgrade: "pro", limit: QUOTAS.free });
		});

		it("gives Pass holders the Pro allowance", async () => {
			const { user, accessToken } = await createTestUserWithAuth(app, { email: "q-pro@example.com", googleId: "g-qp" });
			await postWebhook(completedEvent("evt_quota", user.id, secondsAgo(1)));

			expect(await attempts(5, accessToken)).toEqual([400, 400, 400, 400, 429]);
		});
	});
});

describe("Billing disabled (default, self-host)", () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	it("keeps every billing route inert", async () => {
		const status = await supertest(app.getHttpServer()).get("/api/v1/billing").expect(200);
		expect(status.body).toEqual({ enabled: false });

		const { accessToken } = await createTestUserWithAuth(app, { email: "off@example.com", googleId: "g-off" });
		await supertest(app.getHttpServer())
			.post("/api/v1/billing/checkout")
			.set("Authorization", `Bearer ${accessToken}`)
			.send({})
			.expect(503);
		await supertest(app.getHttpServer())
			.post("/api/v1/billing/webhook")
			.set("Content-Type", "application/json")
			.set("Stripe-Signature", "t=1,v1=abc")
			.send("{}")
			.expect(503);
	});

	it("never hands out the OG grant", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "off-og@example.com", googleId: "g-off-og" });
		const granted = await withRequestContext(app, () =>
			app.get(BillingService).grantOgPassIfEligible({ id: user.id, createdAt: BEFORE_LAUNCH }),
		);
		expect(granted).toBe(false);
	});
});
