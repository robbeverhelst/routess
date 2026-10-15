import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { encodePolyline6, FREE_SAVED_ROUTE_LIMIT, PRO_GATED_FEATURES } from "@routess/core";
import { BILLING_PROVIDER, type BillingProvider } from "src/billing/billing-provider";
import { CacheService } from "src/cache/cache.service";
import { type AppConfig, getAppConfig } from "src/config/app-config";
import { APP_CONFIG } from "src/config/config.module";
import { CollectionRoute } from "src/entities/collection-route.entity";
import { Collection } from "src/entities/collection.entity";
import { Entitlement } from "src/entities/entitlement.entity";
import { PersonalAccessToken } from "src/entities/personal-access-token.entity";
import { Route } from "src/entities/route.entity";
import { User } from "src/entities/user.entity";
import { FEATURES, PLAN_FEATURES } from "src/entitlements/features";

import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";
import request from "../utils/http";

const DAY_MS = 24 * 60 * 60 * 1000;

const fakeProvider: BillingProvider = {
	name: "stripe",
	createCheckout: async (request) => ({ url: `https://checkout.example/${request.offer}`, providerRef: "cs_x" }),
	parseWebhook: async () => null,
	describeOffer: async () => ({ amount: 2999, currency: "eur" }),
};

function billingConfig(): AppConfig {
	const base = getAppConfig();
	return {
		...base,
		// High enough that the generation quota never answers before a gate.
		quotas: { ...base.quotas, generationPerDayByTier: { anonymous: 50, free: 50, pro: 50 } },
		billing: {
			enabled: true,
			provider: "stripe",
			// Nobody here predates the launch, so status reads hand out no OG grant.
			launchedAt: new Date("2020-01-01T00:00:00Z"),
			stripe: { secretKey: "sk_test_x", webhookSecret: "whsec_x", proYearPassPriceId: "price_x" },
		},
	};
}

// The accounts every gate is checked against (ADR 0039): a free User, an OG
// User on the permanent stored 'pro' Plan, a User with an active OG grant, a
// paying User with a running pass, and a User whose pass has run out.
type Account = "free" | "permanentPro" | "ogGrant" | "paidPro" | "expiredPro";
const PRO_ACCOUNTS: Account[] = ["permanentPro", "ogGrant", "paidPro"];
const FREE_ACCOUNTS: Account[] = ["free", "expiredPro"];

const PRO_REQUIRED = (feature: string) => ({
	statusCode: 403,
	code: "FORBIDDEN",
	details: { reason: "pro_required", feature, upgrade: "pro" },
});

describe("Pro gates with billing enabled", () => {
	let app: INestApplication;
	let orm: MikroORM;

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

	beforeEach(async () => {
		await clearDatabase(app);
		const cache = app.get(CacheService) as unknown as { memory?: Map<string, unknown> };
		cache.memory?.clear();
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	const api = () => request(app.getHttpServer());

	async function makeAccount(account: Account): Promise<{ user: User; token: string }> {
		const email = `${account}@example.com`;
		const { user, accessToken } = await createTestUserWithAuth(app, { email, googleId: email });
		await withRequestContext(app, async () => {
			const em = orm.em.fork();
			if (account === "permanentPro") {
				await em.nativeUpdate(User, { id: user.id }, { plan: "pro" });
			}
			const passes: Partial<Record<Account, { source: "billing" | "og-grant"; expiresAt: Date }>> = {
				ogGrant: { source: "og-grant", expiresAt: new Date(Date.now() + 90 * DAY_MS) },
				paidPro: { source: "billing", expiresAt: new Date(Date.now() + 365 * DAY_MS) },
				expiredPro: { source: "billing", expiresAt: new Date(Date.now() - DAY_MS) },
			};
			const pass = passes[account];
			if (pass) {
				em.create(Entitlement, { user: user.id, plan: "pro", ...pass });
				await em.flush();
			}
		});
		return { user, token: accessToken };
	}

	async function seedRoutes(user: User, count: number): Promise<Route[]> {
		return withRequestContext(app, async () => {
			const em = orm.em.fork();
			const routes = Array.from({ length: count }, (_, i) =>
				em.create(Route, {
					name: `Seeded ${i + 1}`,
					visibility: "private",
					tags: [],
					favourite: false,
					waypoints: [
						{ coord: [4.35, 50.85], type: "routed" },
						{ coord: [4.36, 50.86], type: "routed" },
					],
					user: user.id,
				}),
			);
			await em.flush();
			return routes;
		});
	}

	const routeBody = (name = "New ride") => ({
		name,
		waypoints: [
			{ coord: [4.35, 50.85], type: "routed" },
			{ coord: [4.36, 50.86], type: "routed" },
		],
	});

	it("ships the decided split: free keeps generation and GPX export, the rest is Pro", () => {
		expect([...PLAN_FEATURES.free].sort()).toEqual(["gpx_export", "route_generation"]);
		expect([...PLAN_FEATURES.pro].sort()).toEqual([...FEATURES].sort());
		// The clients' list of gated Features matches the API's.
		expect(FEATURES.filter((f) => !PLAN_FEATURES.free.includes(f)).sort()).toEqual([...PRO_GATED_FEATURES].sort());
	});

	describe("saved-route cap", () => {
		it.each(FREE_ACCOUNTS)("%s: saves up to the cap, then refuses with a typed 403", async (account) => {
			const { user, token } = await makeAccount(account);
			await seedRoutes(user, FREE_SAVED_ROUTE_LIMIT - 1);

			await api().post("/api/v1/routes").set("Authorization", `Bearer ${token}`).send(routeBody()).expect(201);
			const refused = await api()
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${token}`)
				.send(routeBody("One too many"))
				.expect(403);
			expect(refused.body).toMatchObject({
				code: "FORBIDDEN",
				message: "Free saves up to 5 routes. Go Pro for unlimited.",
				details: { reason: "saved_route_limit", feature: "unlimited_saved_routes", limit: 5, upgrade: "pro" },
			});
		});

		it.each(PRO_ACCOUNTS)("%s: saves past the free cap", async (account) => {
			const { user, token } = await makeAccount(account);
			await seedRoutes(user, FREE_SAVED_ROUTE_LIMIT + 2);
			await api().post("/api/v1/routes").set("Authorization", `Bearer ${token}`).send(routeBody()).expect(201);
		});

		it("lets a free User past the cap keep, edit, export and delete every Route, and save again once under it", async () => {
			const { user, token } = await makeAccount("expiredPro");
			const routes = await seedRoutes(user, FREE_SAVED_ROUTE_LIMIT + 2);
			const auth = { Authorization: `Bearer ${token}` };

			const list = await api().get("/api/v1/routes").set(auth).expect(200);
			expect(list.body).toHaveLength(FREE_SAVED_ROUTE_LIMIT + 2);
			await api().patch(`/api/v1/routes/${routes[0].id}`).set(auth).send({ name: "Renamed" }).expect(200);
			await api().get(`/api/v1/routes/${routes[0].id}/gpx`).set(auth).expect(200);
			await api().post("/api/v1/routes").set(auth).send(routeBody()).expect(403);

			for (const route of routes.slice(0, 3)) {
				await api().delete(`/api/v1/routes/${route.id}`).set(auth).expect(200);
			}
			await api().post("/api/v1/routes").set(auth).send(routeBody()).expect(201);
		});

		it("counts a saved copy of a shared Route toward the cap", async () => {
			const { user, token } = await makeAccount("free");
			const sender = await makeAccount("paidPro");
			await withRequestContext(app, () =>
				orm.em.fork().nativeUpdate(User, { id: user.id }, { handle: "free-recipient" }),
			);
			const [shared] = await seedRoutes(sender.user, 1);
			await withRequestContext(app, () =>
				orm.em.fork().nativeUpdate(Route, { id: shared.id }, { visibility: "unlisted" }),
			);
			const share = await api()
				.post("/api/v1/social/shares")
				.set("Authorization", `Bearer ${sender.token}`)
				.send({ routeId: shared.id, recipientHandle: "free-recipient" })
				.expect(201);
			await seedRoutes(user, FREE_SAVED_ROUTE_LIMIT);

			const refused = await api()
				.post(`/api/v1/social/shares/${share.body.id}/copy`)
				.set("Authorization", `Bearer ${token}`)
				.expect(403);
			expect(refused.body.details).toMatchObject({ reason: "saved_route_limit", limit: FREE_SAVED_ROUTE_LIMIT });
		});

		it("never lets two concurrent saves at the cap both pass", async () => {
			const { user, token } = await makeAccount("free");
			await seedRoutes(user, FREE_SAVED_ROUTE_LIMIT - 1);
			const results = await Promise.all(
				[1, 2, 3].map((i) =>
					api()
						.post("/api/v1/routes")
						.set("Authorization", `Bearer ${token}`)
						.send(routeBody(`Race ${i}`)),
				),
			);
			expect(results.map((r) => r.status).sort()).toEqual([201, 403, 403]);
			const count = await withRequestContext(app, () => orm.em.fork().count(Route, { user: user.id }));
			expect(count).toBe(FREE_SAVED_ROUTE_LIMIT);
		});

		it("reports the count and limit on the billing status", async () => {
			const free = await makeAccount("free");
			await seedRoutes(free.user, 4);
			const freeStatus = await api().get("/api/v1/billing").set("Authorization", `Bearer ${free.token}`).expect(200);
			expect(freeStatus.body.account.savedRoutes).toEqual({ count: 4, limit: FREE_SAVED_ROUTE_LIMIT });
			expect([...freeStatus.body.account.features].sort()).toEqual(["gpx_export", "route_generation"]);

			const pro = await makeAccount("paidPro");
			const proStatus = await api().get("/api/v1/billing").set("Authorization", `Bearer ${pro.token}`).expect(200);
			expect(proStatus.body.account.savedRoutes).toEqual({ count: 0, limit: null });
			expect([...proStatus.body.account.features].sort()).toEqual([...FEATURES].sort());
		});
	});

	describe("collections", () => {
		async function seedCollection(user: User, routes: Route[]): Promise<number> {
			return withRequestContext(app, async () => {
				const em = orm.em.fork();
				const collection = em.create(Collection, { name: "Old favourites", visibility: "private", user: user.id });
				routes.forEach((route, position) => {
					em.create(CollectionRoute, { collection, route: route.id, position });
				});
				await em.flush();
				return collection.id;
			});
		}

		it.each(FREE_ACCOUNTS)(
			"%s: keeps reading and trimming existing collections but cannot create one or add a Route",
			async (account) => {
				const { user, token } = await makeAccount(account);
				const routes = await seedRoutes(user, 3);
				const collectionId = await seedCollection(user, routes.slice(0, 2));
				const auth = { Authorization: `Bearer ${token}` };

				const created = await api().post("/api/v1/collections").set(auth).send({ name: "New" }).expect(403);
				expect(created.body).toMatchObject(PRO_REQUIRED("collections"));

				await api().get("/api/v1/collections").set(auth).expect(200);
				await api().get(`/api/v1/collections/${collectionId}`).set(auth).expect(200);

				const added = await api()
					.put(`/api/v1/collections/${collectionId}/routes`)
					.set(auth)
					.send({ routeIds: routes.map((r) => r.id) })
					.expect(403);
				expect(added.body).toMatchObject(PRO_REQUIRED("collections"));

				const trimmed = await api()
					.put(`/api/v1/collections/${collectionId}/routes`)
					.set(auth)
					.send({ routeIds: [routes[1].id] })
					.expect(200);
				expect(trimmed.body.routes).toHaveLength(1);
			},
		);

		it.each(PRO_ACCOUNTS)("%s: creates collections and adds Routes", async (account) => {
			const { user, token } = await makeAccount(account);
			const [route] = await seedRoutes(user, 1);
			const auth = { Authorization: `Bearer ${token}` };
			const created = await api().post("/api/v1/collections").set(auth).send({ name: "New" }).expect(201);
			await api()
				.put(`/api/v1/collections/${created.body.id}/routes`)
				.set(auth)
				.send({ routeIds: [route.id] })
				.expect(200);
		});
	});

	describe("personal access tokens", () => {
		async function seedToken(user: User): Promise<string> {
			// Minted while the User was on Pro; the plaintext is what the CLI holds.
			const { PersonalAccessTokensService } = await import("src/auth/personal-access-tokens.service");
			const tokens = app.get(PersonalAccessTokensService);
			const minted = await withRequestContext(app, () => tokens.mint(user.id, "laptop", "write"));
			return minted.token;
		}

		it.each(FREE_ACCOUNTS)(
			"%s: existing tokens answer a typed 403 and stay stored; minting is refused",
			async (account) => {
				const { user, token } = await makeAccount(account);
				const pat = await seedToken(user);

				const refused = await api().get("/api/v1/routes").set("Authorization", `Bearer ${pat}`).expect(403);
				expect(refused.body).toMatchObject({
					...PRO_REQUIRED("personal_access_tokens"),
					message: "CLI and agent access is part of Pro.",
				});
				// Endpoints that also serve anonymous callers refuse it too, rather
				// than quietly treating the caller as signed out.
				await api().post("/api/v1/generation").set("Authorization", `Bearer ${pat}`).send({}).expect(403);

				const stored = await withRequestContext(app, () =>
					orm.em.fork().count(PersonalAccessToken, { user: user.id, revokedAt: null }),
				);
				expect(stored).toBe(1);

				const minted = await api()
					.post("/api/v1/auth/tokens")
					.set("Authorization", `Bearer ${token}`)
					.send({ label: "agent", scope: "read" })
					.expect(403);
				expect(minted.body).toMatchObject(PRO_REQUIRED("personal_access_tokens"));
			},
		);

		it.each(PRO_ACCOUNTS)("%s: tokens work and can be minted", async (account) => {
			const { user, token } = await makeAccount(account);
			const pat = await seedToken(user);
			await api().get("/api/v1/routes").set("Authorization", `Bearer ${pat}`).expect(200);
			await api()
				.post("/api/v1/auth/tokens")
				.set("Authorization", `Bearer ${token}`)
				.send({ label: "agent", scope: "read" })
				.expect(201);
		});

		it("works again after the User goes Pro", async () => {
			const { user } = await makeAccount("expiredPro");
			const pat = await seedToken(user);
			await api().get("/api/v1/routes").set("Authorization", `Bearer ${pat}`).expect(403);
			await withRequestContext(app, () =>
				orm.em
					.fork()
					.nativeUpdate(
						Entitlement,
						{ user: user.id, source: "billing" },
						{ expiresAt: new Date(Date.now() + 365 * DAY_MS) },
					),
			);
			await api().get("/api/v1/routes").set("Authorization", `Bearer ${pat}`).expect(200);
		});
	});

	describe("knooppunt generation", () => {
		it.each(FREE_ACCOUNTS)("%s: preferNodeNetworks answers a typed 403", async (account) => {
			const { token } = await makeAccount(account);
			const res = await api()
				.post("/api/v1/generation")
				.set("Authorization", `Bearer ${token}`)
				.send({ preferNodeNetworks: true })
				.expect(403);
			expect(res.body).toMatchObject(PRO_REQUIRED("node_network_generation"));
		});

		it("refuses anonymous callers too", async () => {
			const res = await api().post("/api/v1/generation").send({ preferNodeNetworks: true }).expect(403);
			expect(res.body).toMatchObject(PRO_REQUIRED("node_network_generation"));
		});

		it.each([1, "true"])("refuses a free and an anonymous caller sending preferNodeNetworks: %p", async (value) => {
			const { token } = await makeAccount("free");
			const free = await api()
				.post("/api/v1/generation")
				.set("Authorization", `Bearer ${token}`)
				.send({ preferNodeNetworks: value })
				.expect(403);
			expect(free.body).toMatchObject(PRO_REQUIRED("node_network_generation"));
			const anonymous = await api().post("/api/v1/generation").send({ preferNodeNetworks: value }).expect(403);
			expect(anonymous.body).toMatchObject(PRO_REQUIRED("node_network_generation"));
		});

		it.each(PRO_ACCOUNTS)("%s: passes the gate (and reaches validation)", async (account) => {
			const { token } = await makeAccount(account);
			// An otherwise empty body fails validation, which runs after the gate.
			await api()
				.post("/api/v1/generation")
				.set("Authorization", `Bearer ${token}`)
				.send({ preferNodeNetworks: true })
				.expect(400);
		});

		it.each(FREE_ACCOUNTS)("%s: generation without the preference is not gated", async (account) => {
			const { token } = await makeAccount(account);
			await api().post("/api/v1/generation").set("Authorization", `Bearer ${token}`).send({}).expect(400);
		});
	});

	describe("navigation", () => {
		const cuesBody = {
			geometry: encodePolyline6([
				[4.35, 50.85],
				[4.36, 50.86],
			]),
			activity: "cycle",
		};

		it.each(FREE_ACCOUNTS)("%s: POST /routing/cues answers a typed 403", async (account) => {
			const { token } = await makeAccount(account);
			const res = await api()
				.post("/api/v1/routing/cues")
				.set("Authorization", `Bearer ${token}`)
				.send(cuesBody)
				.expect(403);
			expect(res.body).toMatchObject({
				...PRO_REQUIRED("navigation"),
				message: "Turn-by-turn navigation is part of Pro.",
			});
		});

		it("refuses anonymous callers too", async () => {
			await api().post("/api/v1/routing/cues").send(cuesBody).expect(403);
		});

		it.each(PRO_ACCOUNTS)("%s: gets cues", async (account) => {
			const { token } = await makeAccount(account);
			const res = await api()
				.post("/api/v1/routing/cues")
				.set("Authorization", `Bearer ${token}`)
				.send(cuesBody)
				.expect(200);
			expect(Array.isArray(res.body.cues)).toBe(true);
		});
	});

	describe("free features", () => {
		it.each(FREE_ACCOUNTS)("%s: GPX export stays open", async (account) => {
			const { user, token } = await makeAccount(account);
			const [route] = await seedRoutes(user, 1);
			await api().get(`/api/v1/routes/${route.id}/gpx`).set("Authorization", `Bearer ${token}`).expect(200);
		});
	});
});

describe("Pro gates with billing disabled (self-host)", () => {
	let app: INestApplication;
	let orm: MikroORM;

	beforeAll(async () => {
		app = await createTestApp();
		orm = app.get(MikroORM);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	it("gates nothing: saving past the cap, collections and PATs all work", async () => {
		await clearDatabase(app);
		const { user, accessToken } = await createTestUserWithAuth(app, { email: "selfhost@example.com" });
		const auth = { Authorization: `Bearer ${accessToken}` };
		await withRequestContext(app, async () => {
			const em = orm.em.fork();
			for (let i = 0; i < FREE_SAVED_ROUTE_LIMIT + 1; i++) {
				em.create(Route, {
					name: `Self-host ${i}`,
					visibility: "private",
					tags: [],
					favourite: false,
					waypoints: [
						{ coord: [4.35, 50.85], type: "routed" },
						{ coord: [4.36, 50.86], type: "routed" },
					],
					user: user.id,
				});
			}
			await em.flush();
		});

		await http(app)
			.post("/api/v1/routes")
			.set(auth)
			.send({
				name: "Past the cap",
				waypoints: [
					{ coord: [4.35, 50.85], type: "routed" },
					{ coord: [4.36, 50.86], type: "routed" },
				],
			})
			.expect(201);
		await http(app).post("/api/v1/collections").set(auth).send({ name: "Mine" }).expect(201);
		const pat = await http(app).post("/api/v1/auth/tokens").set(auth).send({ label: "cli", scope: "read" }).expect(201);
		await http(app).get("/api/v1/routes").set("Authorization", `Bearer ${pat.body.token}`).expect(200);
	});
});

function http(app: INestApplication) {
	return request(app.getHttpServer());
}
