import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { BillingService } from "src/billing/billing.service";
import { BILLING_PROVIDER, type BillingProvider } from "src/billing/billing-provider";
import { getAppConfig } from "src/config/app-config";
import { APP_CONFIG } from "src/config/config.module";
import { Entitlement, type EntitlementSource } from "src/entities/entitlement.entity";
import { User, type UserPlan } from "src/entities/user.entity";
import { EntitlementsService, PLAN_FEATURE_MATRIX } from "src/entitlements/entitlements.service";
import { FEATURES, type Feature, PLAN_FEATURES, type PlanFeatureMatrix } from "src/entitlements/features";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";

const DAY_MS = 24 * 60 * 60 * 1000;

// A matrix where the plans actually differ, so the can() rules are observable.
// The shipped PLAN_FEATURES puts everything in free (ADR 0039).
const TEST_MATRIX: PlanFeatureMatrix = {
	free: ["gpx_export"],
	pro: FEATURES,
};

const fakeProvider: BillingProvider = {
	name: "stripe",
	createCheckout: async (request) => ({
		url: `https://checkout.example/${request.offer}`,
		providerRef: `cs_${request.userId}`,
	}),
	parseWebhook: async (delivery) => JSON.parse(delivery.rawBody.toString("utf8")),
};

describe("Entitlements with billing enabled", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let entitlements: EntitlementsService;
	let billing: BillingService;

	beforeAll(async () => {
		app = await createTestApp({
			configure: (builder) =>
				builder
					.overrideProvider(APP_CONFIG)
					.useValue({ ...getAppConfig(), billing: { enabled: true, provider: "stripe" } })
					.overrideProvider(BILLING_PROVIDER)
					.useValue(fakeProvider)
					.overrideProvider(PLAN_FEATURE_MATRIX)
					.useValue(TEST_MATRIX),
		});
		orm = app.get(MikroORM);
		entitlements = app.get(EntitlementsService);
		billing = app.get(BillingService);
	});

	beforeEach(async () => {
		await clearDatabase(app);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	async function makeUser(email: string, plan: UserPlan = "free"): Promise<User> {
		const { user } = await createTestUserWithAuth(app, { email, googleId: email });
		if (plan !== "free") {
			await withRequestContext(app, async () => {
				await orm.em.nativeUpdate(User, { id: user.id }, { plan });
			});
			user.plan = plan;
		}
		return user;
	}

	async function grant(user: User, feature: Feature, expiresAt?: Date, source: EntitlementSource = "manual") {
		await withRequestContext(app, async () => {
			const row = orm.em.create(Entitlement, { user: user.id, feature, source, expiresAt });
			await orm.em.persist(row).flush();
		});
	}

	function can(user: User | null, feature: Feature): Promise<boolean> {
		return withRequestContext(app, () => entitlements.can(user, feature));
	}

	it("new Users default to the free plan", async () => {
		const user = await makeUser("default@example.com");
		const stored = await withRequestContext(app, () => orm.em.fork().findOneOrFail(User, { id: user.id }));
		expect(stored.plan).toBe("free");
	});

	it("allows what the plan includes and denies the rest", async () => {
		const free = await makeUser("free@example.com");
		const pro = await makeUser("pro@example.com", "pro");

		expect(await can(free, "gpx_export")).toBe(true);
		expect(await can(free, "route_generation")).toBe(false);
		for (const feature of FEATURES) {
			expect(await can(pro, feature)).toBe(true);
		}
	});

	it("treats anonymous callers as the free plan", async () => {
		expect(await can(null, "gpx_export")).toBe(true);
		expect(await can(null, "route_generation")).toBe(false);
	});

	it("lets admins use every feature regardless of plan", async () => {
		const admin = await makeUser("admin@example.com");
		admin.role = "admin";
		expect(await can(admin, "navigation")).toBe(true);
	});

	it("unlocks a feature through an unexpired grant, for that feature only", async () => {
		const user = await makeUser("granted@example.com");
		await grant(user, "route_generation");
		await grant(user, "collections", new Date(Date.now() + DAY_MS), "billing");

		expect(await can(user, "route_generation")).toBe(true);
		expect(await can(user, "collections")).toBe(true);
		expect(await can(user, "navigation")).toBe(false);
	});

	it("ignores expired and soft-deleted grants, and other Users' grants", async () => {
		const user = await makeUser("expired@example.com");
		const other = await makeUser("other@example.com");
		await grant(user, "route_generation", new Date(Date.now() - DAY_MS));
		await grant(user, "navigation");
		await grant(other, "collections");
		await withRequestContext(app, async () => {
			await orm.em.nativeUpdate(Entitlement, { user: user.id, feature: "navigation" }, { deletedAt: new Date() });
		});

		expect(await can(user, "route_generation")).toBe(false);
		expect(await can(user, "navigation")).toBe(false);
		expect(await can(user, "collections")).toBe(false);
	});

	it("applies a plan change from the billing webhook, idempotently", async () => {
		const user = await makeUser("upgrade@example.com");
		const delivery = {
			rawBody: Buffer.from(
				JSON.stringify({ kind: "plan_changed", userId: user.id, plan: "pro", providerRef: "sub_1" }),
			),
			headers: {},
		};

		await withRequestContext(app, () => billing.handleWebhook(delivery));
		await withRequestContext(app, () => billing.handleWebhook(delivery));

		const stored = await withRequestContext(app, () => orm.em.fork().findOneOrFail(User, { id: user.id }));
		expect(stored.plan).toBe("pro");
		expect(await can(stored, "route_generation")).toBe(true);
	});

	it("delegates checkout to the provider", async () => {
		expect(billing.enabled).toBe(true);
		const session = await billing.startCheckout({
			userId: 7,
			email: "buyer@example.com",
			offer: "pro_yearly",
			successUrl: "https://app.example/billing/success",
			cancelUrl: "https://app.example/billing/cancel",
		});
		expect(session).toEqual({ url: "https://checkout.example/pro_yearly", providerRef: "cs_7" });
	});
});

describe("Entitlements with billing disabled (default, self-host)", () => {
	let app: INestApplication;
	let entitlements: EntitlementsService;
	let billing: BillingService;

	beforeAll(async () => {
		app = await createTestApp({
			// Even a matrix that grants nothing must not gate a billing-off instance.
			configure: (builder) => builder.overrideProvider(PLAN_FEATURE_MATRIX).useValue({ free: [], pro: [] }),
		});
		entitlements = app.get(EntitlementsService);
		billing = app.get(BillingService);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	it("is the default configuration", () => {
		expect(getAppConfig().billing).toEqual({ enabled: false, provider: null });
	});

	it("unlocks every feature for everyone", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "selfhost@example.com" });
		for (const feature of FEATURES) {
			expect(await withRequestContext(app, () => entitlements.can(user, feature))).toBe(true);
			expect(await withRequestContext(app, () => entitlements.can(null, feature))).toBe(true);
		}
	});

	it("refuses billing work with 503", async () => {
		expect(billing.enabled).toBe(false);
		await expect(
			billing.startCheckout({
				userId: 1,
				email: "x@example.com",
				offer: "pro_monthly",
				successUrl: "https://app.example/s",
				cancelUrl: "https://app.example/c",
			}),
		).rejects.toMatchObject({ status: 503 });
	});

	it("ships a free plan that still includes every feature", () => {
		expect([...PLAN_FEATURES.free]).toEqual([...FEATURES]);
	});
});
