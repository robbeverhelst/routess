import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { FREE_SAVED_ROUTE_LIMIT } from "@routess/core";
import { BILLING_PROVIDER, type BillingProvider } from "src/billing/billing-provider";
import { CacheService } from "src/cache/cache.service";
import { type AppConfig, getAppConfig } from "src/config/app-config";
import { APP_CONFIG } from "src/config/config.module";
import { AdminAuditEntry } from "src/entities/admin-audit-entry.entity";
import { Entitlement } from "src/entities/entitlement.entity";
import { Payment } from "src/entities/payment.entity";
import { Route } from "src/entities/route.entity";
import { User } from "src/entities/user.entity";
import { EntitlementsService } from "src/entitlements/entitlements.service";
import { GENERATION_QUOTA_COUNTER, generationQuotaKey } from "src/generation/generation-quota.guard";
import { clearDatabase, closeTestApp, createTestApp, generateTestJWT, withRequestContext } from "../utils";
import request, { type TestRequest } from "../utils/http";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);
const daysAhead = (n: number) => new Date(Date.now() + n * DAY_MS);

const fakeProvider: BillingProvider = {
	name: "stripe",
	createCheckout: async () => ({ url: "https://checkout.example/x", providerRef: "cs_x" }),
	parseWebhook: async () => null,
	describeOffer: async () => ({ amount: 2999, currency: "eur" }),
};

function billingConfig(): AppConfig {
	const base = getAppConfig();
	return {
		...base,
		// No Umami, whatever the local .env says.
		analytics: { ...base.analytics, umamiDatabaseUrl: "", umamiWebsiteId: "" },
		quotas: { ...base.quotas, generationPerDayByTier: { anonymous: 1, free: 3, pro: 50 } },
		billing: {
			enabled: true,
			provider: "stripe",
			launchedAt: new Date("2020-01-01T00:00:00Z"),
			stripe: { secretKey: "sk_test_x", webhookSecret: "whsec_x", proYearPassPriceId: "price_x" },
		},
	};
}

type Kind = "free" | "pro_paid" | "pro_admin" | "pro_og" | "pro_expired";

describe("Admin Pro (users list, user detail, grant/extend/revoke, metrics)", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let adminToken: string;
	let memberToken: string;
	const ids: Record<"admin" | "free" | "paid" | "og" | "comp" | "expired" | "ending", number> = {
		admin: 0,
		free: 0,
		paid: 0,
		og: 0,
		comp: 0,
		expired: 0,
		ending: 0,
	};

	const api = () => request(app.getHttpServer());
	const asAdmin = (req: TestRequest) => req.set("Authorization", `Bearer ${adminToken}`);
	const getUsers = (query = "") => asAdmin(api().get(`/api/v1/admin/users${query}`));
	const getDetail = (id: number) => asAdmin(api().get(`/api/v1/admin/users/${id}`));
	const action = (id: number, name: "grant" | "extend" | "revoke", body: object, token = adminToken) =>
		api().post(`/api/v1/admin/users/${id}/pro/${name}`).set("Authorization", `Bearer ${token}`).send(body);

	beforeAll(async () => {
		app = await createTestApp({
			configure: (builder) =>
				builder
					.overrideProvider(APP_CONFIG)
					.useValue(billingConfig())
					.overrideProvider(BILLING_PROVIDER)
					.useValue(fakeProvider),
		});
		orm = app.get(MikroORM);
	});

	// Every test starts from the same accounts: a free User, a paying one
	// (who also holds an OG grant, so the paid label must win), an OG one, a
	// stored-Plan comp, one whose pass ran out, and one whose pass ends soon.
	beforeEach(async () => {
		await clearDatabase(app);
		const cache = app.get(CacheService) as unknown as { memory?: Map<string, unknown> };
		cache.memory?.clear();
		orm.em.clear();

		const make = (email: string, extra: Partial<User> = {}) =>
			orm.em.create(User, { email, name: email, googleId: `g-${email}`, isEmailVerified: true, ...extra });
		const admin = make("admin@example.com", { role: "admin", createdAt: daysAgo(100) });
		const free = make("free@example.com", { createdAt: daysAgo(90) });
		const paid = make("paid@example.com", { createdAt: daysAgo(80) });
		const og = make("og@example.com", { createdAt: daysAgo(70) });
		const comp = make("comp@example.com", { plan: "pro", createdAt: daysAgo(60) });
		const expired = make("expired@example.com", { createdAt: daysAgo(50) });
		const ending = make("ending@example.com", { createdAt: daysAgo(40) });
		await orm.em.persist([admin, free, paid, og, comp, expired, ending]).flush();

		const pass = (user: User, source: "billing" | "og-grant", expiresAt: Date) =>
			orm.em.create(Entitlement, { user, plan: "pro", source, expiresAt, createdAt: daysAgo(20) });
		pass(paid, "billing", daysAhead(300));
		pass(paid, "og-grant", daysAhead(60));
		pass(og, "og-grant", daysAhead(80));
		pass(expired, "billing", daysAgo(2));
		pass(ending, "billing", daysAhead(10));

		orm.em.create(Payment, {
			user: paid,
			provider: "stripe",
			eventId: "evt_1PaidAbc",
			checkoutRef: "cs_test_a1b2",
			offer: "pro_year_pass",
			amountTotal: 2999,
			currency: "eur",
			paidAt: daysAgo(1),
			passExpiresAt: daysAhead(300),
		});
		orm.em.create(Payment, {
			user: ending,
			provider: "stripe",
			eventId: "evt_live1",
			checkoutRef: "cs_live_z9",
			offer: "pro_year_pass",
			amountTotal: 2999,
			currency: "eur",
			paidAt: new Date(),
			passExpiresAt: daysAhead(10),
		});
		for (let i = 0; i < 4; i++) {
			orm.em.create(Route, {
				name: `route ${i}`,
				user: free,
				activity: "cycle",
				waypoints: [{ coord: [3.72, 51.05], type: "routed" }],
			});
		}
		await orm.em.flush();

		Object.assign(ids, {
			admin: admin.id,
			free: free.id,
			paid: paid.id,
			og: og.id,
			comp: comp.id,
			expired: expired.id,
			ending: ending.id,
		});
		adminToken = await generateTestJWT(admin.id, admin.email, app);
		memberToken = await generateTestJWT(paid.id, paid.email, app);
		orm.em.clear();
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	const kindsByEmail = (items: Array<{ email: string; plan: { kind: Kind } }>) =>
		Object.fromEntries(items.map((item) => [item.email, item.plan.kind]));

	describe("admin-only guard", () => {
		const requests = () => [
			api().get("/api/v1/admin/users"),
			api().get(`/api/v1/admin/users/${ids.free}`),
			api().post(`/api/v1/admin/users/${ids.free}/pro/grant`).send({ days: 30, reason: "test grant" }),
			api().post(`/api/v1/admin/users/${ids.paid}/pro/extend`).send({ reason: "test extend" }),
			api().post(`/api/v1/admin/users/${ids.paid}/pro/revoke`).send({ reason: "test revoke" }),
		];

		it("rejects anonymous callers", async () => {
			for (const req of requests()) await req.expect(401);
		});

		it("rejects signed-in users who are not admins, and changes nothing", async () => {
			for (const req of requests()) await req.set("Authorization", `Bearer ${memberToken}`).expect(403);
			const entitlements = app.get(EntitlementsService);
			await withRequestContext(app, async () => {
				expect((await entitlements.planStatus({ id: ids.free })).plan).toBe("free");
				expect((await entitlements.planStatus({ id: ids.paid })).plan).toBe("pro");
				expect(await orm.em.fork().count(AdminAuditEntry, {})).toBe(0);
			});
		});
	});

	describe("GET /admin/users", () => {
		it("labels every User's Plan", async () => {
			const { body } = await getUsers("?pageSize=50").expect(200);
			expect(kindsByEmail(body.items)).toEqual({
				"admin@example.com": "free",
				"free@example.com": "free",
				"paid@example.com": "pro_paid",
				"og@example.com": "pro_og",
				"comp@example.com": "pro_admin",
				"expired@example.com": "pro_expired",
				"ending@example.com": "pro_paid",
			});
			const byEmail = Object.fromEntries(body.items.map((item: { email: string }) => [item.email, item]));
			expect(byEmail["comp@example.com"].plan).toMatchObject({ plan: "pro", proUntil: null, permanent: true });
			expect(byEmail["expired@example.com"].plan).toMatchObject({ plan: "free", permanent: false });
			expect(new Date(byEmail["expired@example.com"].plan.proUntil).getTime()).toBeLessThan(Date.now());
			expect(byEmail["free@example.com"].plan).toMatchObject({ plan: "free", proUntil: null, permanent: false });
			// The latest end across sources: the paid pass, not the OG grant.
			expect(new Date(byEmail["paid@example.com"].plan.proUntil).getTime()).toBeGreaterThan(daysAhead(250).getTime());
		});

		it("matches the Plan the Pro gates resolve", async () => {
			const { body } = await getUsers("?pageSize=50").expect(200);
			const entitlements = app.get(EntitlementsService);
			await withRequestContext(app, async () => {
				for (const item of body.items) {
					const status = await entitlements.planStatus({ id: item.id });
					expect(item.plan.plan).toBe(status.plan);
					if (status.plan === "pro") expect(item.plan.proUntil).toBe(status.proExpiresAt?.toISOString() ?? null);
				}
			});
		});

		it("filters by plan, one kind or several", async () => {
			const og = await getUsers("?plan=pro_og").expect(200);
			expect(og.body.total).toBe(1);
			expect(og.body.items[0].email).toBe("og@example.com");

			const several = await getUsers("?plan=pro_paid,pro_expired").expect(200);
			expect(several.body.items.map((u: { email: string }) => u.email).sort()).toEqual([
				"ending@example.com",
				"expired@example.com",
				"paid@example.com",
			]);

			// Unknown values are dropped; nothing valid left means no filter.
			const bogus = await getUsers("?plan=gold&pageSize=50").expect(200);
			expect(bogus.body.total).toBe(7);
		});

		it("sorts by Pro until: permanent after every date, no date last", async () => {
			const desc = await getUsers("?sort=proUntil&dir=desc&pageSize=50").expect(200);
			expect(desc.body.items.map((u: { email: string }) => u.email).slice(0, 5)).toEqual([
				"comp@example.com",
				"paid@example.com",
				"og@example.com",
				"ending@example.com",
				"expired@example.com",
			]);
			const asc = await getUsers("?sort=proUntil&dir=asc&pageSize=50").expect(200);
			expect(asc.body.items.map((u: { email: string }) => u.email).slice(0, 5)).toEqual([
				"expired@example.com",
				"ending@example.com",
				"og@example.com",
				"paid@example.com",
				"comp@example.com",
			]);
		});
	});

	describe("GET /admin/users/:id", () => {
		it("shows the Plan, its grants and the payments with a Stripe dashboard link", async () => {
			const { body } = await getDetail(ids.paid).expect(200);
			expect(body.plan.kind).toBe("pro_paid");
			expect(body.billing.pro).toMatchObject({ kind: "pro_paid", plan: "pro", storedPlan: "free", permanent: false });
			expect(body.billing.pro.grants.map((g: { source: string; active: boolean }) => [g.source, g.active])).toEqual([
				["billing", true],
				["og-grant", true],
			]);
			expect(body.billing.payments).toHaveLength(1);
			expect(body.billing.payments[0]).toMatchObject({
				provider: "stripe",
				offer: "pro_year_pass",
				amountTotal: 2999,
				currency: "eur",
				dashboardUrl: "https://dashboard.stripe.com/test/events/evt_1PaidAbc",
			});
			// Only display fields leave the API: no raw provider ids beyond the link.
			expect(body.billing.payments[0]).not.toHaveProperty("checkoutRef");
			expect(body.billing.payments[0]).not.toHaveProperty("eventId");

			const live = await getDetail(ids.ending).expect(200);
			expect(live.body.billing.payments[0].dashboardUrl).toBe("https://dashboard.stripe.com/events/evt_live1");
		});

		it("shows saved Routes against the free cap and today's generation usage against the quota", async () => {
			const cache = app.get(CacheService);
			await cache.increment(GENERATION_QUOTA_COUNTER, generationQuotaKey(`user:${ids.free}`), 86_400);
			await cache.increment(GENERATION_QUOTA_COUNTER, generationQuotaKey(`user:${ids.free}`), 86_400);

			const { body } = await getDetail(ids.free).expect(200);
			expect(body.billing.savedRoutes).toEqual({ count: 4, limit: FREE_SAVED_ROUTE_LIMIT });
			expect(body.billing.generationToday).toEqual({ used: 2, limit: 3, tier: "free" });

			const pro = await getDetail(ids.paid).expect(200);
			expect(pro.body.billing.savedRoutes).toEqual({ count: 0, limit: null });
			expect(pro.body.billing.generationToday).toEqual({ used: 0, limit: 50, tier: "pro" });

			// Reading usage never spends quota.
			await getDetail(ids.free).expect(200);
			expect(await cache.readCounter(GENERATION_QUOTA_COUNTER, generationQuotaKey(`user:${ids.free}`))).toBe(2);
		});
	});

	describe("admin Pro actions", () => {
		const planStatus = (id: number) => withRequestContext(app, () => app.get(EntitlementsService).planStatus({ id }));
		const auditEntries = () =>
			withRequestContext(app, () =>
				orm.em.fork().find(AdminAuditEntry, {}, { orderBy: { id: "asc" }, populate: ["actor", "targetUser"] }),
			);

		it("grants Pro for N days from now, with an admin Entitlement and an audit entry", async () => {
			const before = Date.now();
			const { body } = await action(ids.free, "grant", { days: 30, reason: "  Beta tester  " }).expect(200);
			expect(body).toMatchObject({ kind: "pro_admin", plan: "pro", permanent: false });

			const status = await planStatus(ids.free);
			expect(status.plan).toBe("pro");
			const until = status.proExpiresAt?.getTime() ?? 0;
			expect(until).toBeGreaterThanOrEqual(before + 30 * DAY_MS);
			expect(until).toBeLessThanOrEqual(Date.now() + 30 * DAY_MS);

			const rows = await withRequestContext(app, () =>
				orm.em.fork().find(Entitlement, { user: ids.free, plan: "pro" }),
			);
			expect(rows.map((row) => row.source)).toEqual(["admin"]);

			const [entry] = await auditEntries();
			expect(entry).toMatchObject({ action: "pro.grant", actorEmail: "admin@example.com", reason: "Beta tester" });
			expect(entry.actor?.id).toBe(ids.admin);
			expect(entry.targetUser?.id).toBe(ids.free);
			expect(entry.details).toMatchObject({
				days: 30,
				permanent: false,
				before: { kind: "free", plan: "free" },
				after: { kind: "pro_admin", plan: "pro" },
			});
		});

		it("grants Pro permanently as a comp", async () => {
			const { body } = await action(ids.og, "grant", { permanent: true, reason: "Comp for the OG crew" }).expect(200);
			expect(body).toMatchObject({ kind: "pro_admin", plan: "pro", proUntil: null, permanent: true });
			expect(await planStatus(ids.og)).toEqual({ plan: "pro", proExpiresAt: null });
		});

		it("refuses a grant without exactly one of days and permanent, or without a reason", async () => {
			await action(ids.free, "grant", { reason: "no length" }).expect(400);
			await action(ids.free, "grant", { days: 30, permanent: true, reason: "both" }).expect(400);
			await action(ids.free, "grant", { days: 0, reason: "zero days" }).expect(400);
			await action(ids.free, "grant", { days: 30 }).expect(400);
			await action(ids.free, "grant", { days: 30, reason: "   " }).expect(400);
			expect(await auditEntries()).toHaveLength(0);
			expect((await planStatus(ids.free)).plan).toBe("free");
		});

		it("refuses to grant over a stored Pro Plan and 404s an unknown User", async () => {
			await action(ids.comp, "grant", { days: 30, reason: "already pro" }).expect(409);
			await action(999_999, "grant", { days: 30, reason: "nobody" }).expect(404);
			expect(await auditEntries()).toHaveLength(0);
		});

		it("extends Pro by a year from its current end", async () => {
			const end = (await planStatus(ids.paid)).proExpiresAt?.getTime() ?? 0;
			const { body } = await action(ids.paid, "extend", { reason: "Goodwill after outage" }).expect(200);
			expect(body.kind).toBe("pro_paid");
			expect((await planStatus(ids.paid)).proExpiresAt?.getTime()).toBe(end + 365 * DAY_MS);

			const [entry] = await auditEntries();
			expect(entry).toMatchObject({ action: "pro.extend", reason: "Goodwill after outage" });
			expect(entry.details).toMatchObject({ days: 365 });
		});

		it("extends an expired User by a year from now", async () => {
			const before = Date.now();
			await action(ids.expired, "extend", { reason: "Win-back" }).expect(200);
			const until = (await planStatus(ids.expired)).proExpiresAt?.getTime() ?? 0;
			expect(until).toBeGreaterThanOrEqual(before + 365 * DAY_MS);
		});

		it("refuses to extend Pro that does not expire", async () => {
			await action(ids.comp, "extend", { reason: "pointless" }).expect(409);
		});

		it("revokes every running Pro grant, keeps the rows, writes an ended admin Entitlement, and records it", async () => {
			const before = Date.now();
			const { body } = await action(ids.paid, "revoke", { reason: "Refunded in Stripe" }).expect(200);
			expect(body).toMatchObject({ kind: "pro_expired", plan: "free" });
			expect((await planStatus(ids.paid)).plan).toBe("free");
			expect(
				body.grants.map((g: { source: string; active: boolean; revokedAt: string | null }) => [g.source, g.active]),
			).toEqual([
				["billing", false],
				["og-grant", false],
				["admin", false],
			]);
			expect(body.grants.every((g: { revokedAt: string | null }) => g.revokedAt !== null)).toBe(true);
			const admin = body.grants.find((g: { source: string }) => g.source === "admin");
			expect(new Date(admin.expiresAt).getTime()).toBeGreaterThanOrEqual(before);
			expect(admin.expiresAt).toBe(admin.revokedAt);

			const [entry] = await auditEntries();
			expect(entry).toMatchObject({ action: "pro.revoke", reason: "Refunded in Stripe" });
			expect(entry.details).toMatchObject({
				revokedSources: ["billing", "og-grant"],
				storedPlanCleared: false,
				before: { kind: "pro_paid" },
				after: { kind: "pro_expired" },
			});

			// The audit trail shows up on the User detail.
			const detail = await getDetail(ids.paid).expect(200);
			expect(detail.body.billing.auditLog).toHaveLength(1);
			expect(detail.body.billing.auditLog[0]).toMatchObject({
				action: "pro.revoke",
				actorEmail: "admin@example.com",
				reason: "Refunded in Stripe",
			});
		});

		it("revokes a stored Pro Plan by resetting it to free", async () => {
			const { body } = await action(ids.comp, "revoke", { reason: "Comp ended" }).expect(200);
			expect((await planStatus(ids.comp)).plan).toBe("free");
			expect(body.grants).toEqual([expect.objectContaining({ source: "admin", active: false })]);
			const [entry] = await auditEntries();
			expect(entry.details).toMatchObject({ storedPlanCleared: true });
		});

		it("keeps the real end of an admin grant that lapsed before the revoke", async () => {
			const lapsedAt = daysAgo(5);
			orm.em.create(Entitlement, {
				user: orm.em.getReference(User, ids.ending),
				plan: "pro",
				source: "admin",
				expiresAt: lapsedAt,
				createdAt: daysAgo(15),
			});
			await orm.em.flush();

			const { body } = await action(ids.ending, "revoke", { reason: "Refunded in Stripe" }).expect(200);
			expect(body).toMatchObject({ kind: "pro_expired", plan: "free" });
			const admin = body.grants.find((g: { source: string }) => g.source === "admin");
			expect(admin).toMatchObject({ active: false, expiresAt: lapsedAt.toISOString() });
			expect(admin.revokedAt).toBeNull();
		});

		it("refuses to revoke a User who is not on Pro", async () => {
			await action(ids.free, "revoke", { reason: "nothing to revoke" }).expect(409);
			expect(await auditEntries()).toHaveLength(0);
		});

		it("lets a revoked admin grant come back with a new grant", async () => {
			await action(ids.free, "grant", { days: 10, reason: "first" }).expect(200);
			await action(ids.free, "revoke", { reason: "oops" }).expect(200);
			const { body } = await action(ids.free, "grant", { days: 20, reason: "second" }).expect(200);
			expect(body.kind).toBe("pro_admin");
			expect(body.grants).toHaveLength(1);
			expect(body.grants[0]).toMatchObject({ source: "admin", active: true, revokedAt: null });
			expect(await auditEntries()).toHaveLength(3);
		});
	});

	describe("GET /admin/stats/metrics (Pro section)", () => {
		it("reports Pro users over time, purchases and revenue, and Pro ending soon", async () => {
			const { body } = await asAdmin(api().get("/api/v1/admin/stats/metrics")).expect(200);
			const { pro } = body;

			expect(pro.proUsersDaily).toHaveLength(30);
			// paid, og, comp, ending today; expired lapsed two days ago.
			expect(pro.proUsersDaily.at(-1).count).toBe(4);
			expect(pro.proUsersDaily.at(-4).count).toBe(5);

			expect(pro.currency).toBe("eur");
			expect(pro.revenueDaily).toHaveLength(30);
			expect(pro.revenueDaily.at(-1).amount).toBe(2999);
			expect(pro.revenueDaily.at(-2).amount).toBe(2999);
			expect(pro.revenueTotals).toEqual([{ currency: "eur", amount: 5998, payments: 2 }]);

			expect(pro.endingSoon.count).toBe(1);
			expect(pro.endingSoon.users).toEqual([
				expect.objectContaining({ id: ids.ending, email: "ending@example.com", kind: "pro_paid" }),
			]);

			// Without Umami the limit hits are unavailable, not zero.
			expect(pro.limits).toEqual({ productEventsAvailable: false, daily: [], conversion: null });
		});
	});
});
