import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { getAppConfig } from "src/config/app-config";
import { APP_CONFIG } from "src/config/config.module";
import { Entitlement } from "src/entities/entitlement.entity";
import { Payment } from "src/entities/payment.entity";
import { Route } from "src/entities/route.entity";
import { Session } from "src/entities/session.entity";
import { User } from "src/entities/user.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, generateTestJWT, withRequestContext } from "../utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);
const daysAhead = (n: number) => new Date(Date.now() + n * DAY_MS);

describe("Admin metrics (GET /admin/stats/metrics)", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let adminToken: string;
	let memberToken: string;

	const get = (token?: string) => {
		const req = supertest(app.getHttpServer()).get("/api/v1/admin/stats/metrics");
		return token ? req.set("Authorization", `Bearer ${token}`) : req;
	};

	// One fixture for the whole file: AdminService caches stats for a minute,
	// so re-seeding between tests would read stale numbers.
	beforeAll(async () => {
		// No Umami, whatever the local .env says, so generation attempts are
		// reported unavailable.
		const config = getAppConfig();
		app = await createTestApp({
			configure: (builder) =>
				builder
					.overrideProvider(APP_CONFIG)
					.useValue({ ...config, analytics: { ...config.analytics, umamiDatabaseUrl: "", umamiWebsiteId: "" } }),
		});
		orm = app.get(MikroORM);
		await clearDatabase(app);
		orm.em.clear();

		const make = (email: string, extra: Partial<User> = {}) =>
			orm.em.create(User, { email, name: email, googleId: `g-${email}`, isEmailVerified: true, ...extra });

		const admin = make("admin@example.com", { role: "admin", createdAt: daysAgo(100) });
		// Paying now: an unexpired paid pass.
		const payer = make("payer@example.com", { createdAt: new Date() });
		// Paid once, pass since expired.
		const lapsed = make("lapsed@example.com", { createdAt: daysAgo(3) });
		// Pro without paying: the OG grant.
		const og = make("og@example.com", { createdAt: daysAgo(3) });
		// Pro through the stored Plan.
		const stored = make("stored@example.com", { plan: "pro", createdAt: daysAgo(40) });
		// Deleted accounts count nowhere (deleted below, once it has a session).
		const gone = make("gone@example.com", { createdAt: new Date() });
		await orm.em.persist([admin, payer, lapsed, og, stored, gone]).flush();

		const pass = (user: User, source: "billing" | "og-grant", expiresAt: Date) =>
			orm.em.create(Entitlement, { user, plan: "pro", source, expiresAt });
		pass(payer, "billing", daysAhead(300));
		pass(lapsed, "billing", daysAgo(1));
		pass(og, "og-grant", daysAhead(300));
		pass(gone, "billing", daysAhead(300));

		const payment = (user: User, paidAt: Date) =>
			orm.em.create(Payment, {
				user,
				provider: "stripe",
				eventId: `evt_${user.id}`,
				checkoutRef: `cs_${user.id}`,
				offer: "pro_year_pass",
				amountTotal: 2999,
				currency: "eur",
				paidAt,
			});
		payment(payer, new Date());
		payment(lapsed, daysAgo(366));
		payment(gone, new Date());

		const route = (user: User, provenance: "generation" | "valhalla") =>
			orm.em.create(Route, {
				name: `${provenance} route`,
				user,
				activity: "cycle",
				provenance,
				waypoints: [{ coord: [3.72, 51.05], type: "routed" }],
			});
		route(payer, "generation");
		route(payer, "generation");
		route(og, "valhalla");
		await orm.em.flush();

		adminToken = await generateTestJWT(admin.id, admin.email, app);
		memberToken = await generateTestJWT(payer.id, payer.email, app);
		await generateTestJWT(og.id, og.email, app);
		await generateTestJWT(stored.id, stored.email, app);
		await generateTestJWT(gone.id, gone.email, app);
		// og was last seen three days ago, stored two months ago.
		await withRequestContext(app, async () => {
			await orm.em.nativeUpdate(Session, { user: og.id }, { lastActivity: daysAgo(3) });
			await orm.em.nativeUpdate(Session, { user: stored.id }, { lastActivity: daysAgo(60) });
			await orm.em.nativeUpdate(User, { id: gone.id }, { deletedAt: new Date() });
		});
		orm.em.clear();
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	it("rejects anonymous callers", async () => {
		await get().expect(401);
	});

	it("rejects signed-in users who are not admins", async () => {
		await get(memberToken).expect(403);
	});

	it("reports signups, active users, generations and paying users", async () => {
		const { body } = await get(adminToken).expect(200);

		expect(body.days).toBe(30);

		expect(body.signups.total).toBe(5);
		expect(body.signups.today).toBe(1);
		expect(body.signups.last7Days).toBe(3);
		expect(body.signups.last30Days).toBe(3);
		expect(body.signups.daily).toHaveLength(30);
		expect(body.signups.daily.at(-1).count).toBe(1);

		// admin + payer today, og three days ago; stored is outside the window
		// and gone is deleted.
		expect(body.activeUsers).toEqual({ last24Hours: 2, last7Days: 3, last30Days: 3 });

		// Without Umami, attempts are unavailable while saved generated routes
		// still come from Postgres.
		expect(body.generations.productEventsAvailable).toBe(false);
		expect(body.generations.daily).toEqual([]);
		expect(body.generations.savedDaily).toHaveLength(30);
		expect(body.generations.savedDaily.at(-1).count).toBe(2);

		expect(body.payingUsers.active).toBe(1);
		expect(body.payingUsers.everPaid).toBe(2);
		expect(body.payingUsers.proUsers).toBe(3);
		expect(body.payingUsers.paymentsDaily).toHaveLength(30);
		// Payments are bookkeeping and outlive their User, so the deleted
		// account's payment still counts as a payment that day.
		expect(body.payingUsers.paymentsDaily.at(-1).count).toBe(2);
		expect(typeof body.payingUsers.billingEnabled).toBe("boolean");
	});
});
