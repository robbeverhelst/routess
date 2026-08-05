import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { routeBoundingBox } from "@routess/core";
import type { RouteActivity, RouteVisibility } from "src/entities/route.entity";
import { Route } from "src/entities/route.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";

interface SeedRoute {
	name: string;
	visibility: RouteVisibility;
	distance?: number;
	description?: string;
	tags?: string[];
	activity?: RouteActivity;
	geometry?: [number, number][];
	publishedAt?: Date;
	placeCity?: string;
	placeRegion?: string;
	placeCountryCode?: string;
}

async function createRoute(app: INestApplication, userId: number, seed: SeedRoute): Promise<number> {
	const orm = app.get(MikroORM);
	return withRequestContext(app, async () => {
		const waypoints: { coord: [number, number]; type: "routed" }[] = [
			{ coord: [4.4, 51.2], type: "routed" },
			{ coord: [4.41, 51.21], type: "routed" },
		];
		// Mirror the service: persist the bbox the geometry implies (ADR 0030).
		const box = routeBoundingBox(seed.geometry ?? waypoints.map((w) => w.coord));
		const route = orm.em.create(Route, {
			name: seed.name,
			user: userId,
			waypoints,
			visibility: seed.visibility,
			distance: seed.distance,
			description: seed.description,
			tags: seed.tags ?? [],
			activity: seed.activity,
			geometry: seed.geometry,
			publishedAt: seed.publishedAt,
			placeCity: seed.placeCity,
			placeRegion: seed.placeRegion,
			placeCountryCode: seed.placeCountryCode,
			bboxMinLat: box?.minLat,
			bboxMaxLat: box?.maxLat,
			bboxMinLng: box?.minLng,
			bboxMaxLng: box?.maxLng,
		});
		await orm.em.persist(route).flush();
		return route.id;
	});
}

const indexable: SeedRoute = {
	name: "Kastelenroute Gent",
	visibility: "public",
	distance: 45_000,
	tags: ["gravel"],
};

describe("GET /routes/public", () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await createTestApp();
	});

	beforeEach(async () => {
		await clearDatabase(app);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	it("returns indexable public routes anonymously with a total count", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await createRoute(app, user.id, indexable);
		const res = await supertest(app.getHttpServer()).get("/api/v1/routes/public").expect(200);
		expect(res.headers["x-total-count"]).toBe("1");
		expect(res.body).toHaveLength(1);
		expect(res.body[0]).toMatchObject({ name: "Kastelenroute Gent", distance: 45_000 });
		expect(typeof res.body[0].updatedAt).toBe("string");
	});

	it("excludes unlisted, private, and below-the-gate public routes", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await createRoute(app, user.id, { ...indexable, name: "Unlisted", visibility: "unlisted" });
		await createRoute(app, user.id, { ...indexable, name: "Private", visibility: "private" });
		await createRoute(app, user.id, { ...indexable, name: "Too short", distance: 500 });
		await createRoute(app, user.id, { ...indexable, name: "Untitled route" });
		await createRoute(app, user.id, { ...indexable, name: "Bare public", tags: [], description: undefined });
		await createRoute(app, user.id, { ...indexable, name: "The keeper" });
		const res = await supertest(app.getHttpServer()).get("/api/v1/routes/public").expect(200);
		expect(res.headers["x-total-count"]).toBe("1");
		expect(res.body.map((r: { name: string }) => r.name)).toEqual(["The keeper"]);
	});

	// The gate is applied in SQL for pagination and re-applied in JS as the
	// authority (#354). These pin the conditions that only the SQL half decides
	// often enough to drift: name floor, the Dutch 'naamloos' default, and a
	// description standing in for tags.
	it("applies every Indexable gate condition, and counts what it returns", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await createRoute(app, user.id, { ...indexable, name: "ab", tags: ["gravel"] });
		await createRoute(app, user.id, { ...indexable, name: "Naamloos ritje", tags: ["gravel"] });
		await createRoute(app, user.id, { ...indexable, name: "UNTITLED shout", tags: ["gravel"] });
		// Near-miss: the gate matches the 'naamloos' prefix, not every word stem.
		await createRoute(app, user.id, { ...indexable, name: "Naamloze rit", tags: ["gravel"] });
		await createRoute(app, user.id, {
			...indexable,
			name: "Described but untagged",
			tags: [],
			description: "A long enough description to clear the gate.",
		});
		await createRoute(app, user.id, { ...indexable, name: "Short description", tags: [], description: "too short" });
		const res = await supertest(app.getHttpServer()).get("/api/v1/routes/public").expect(200);
		expect(res.body.map((r: { name: string }) => r.name).sort()).toEqual(["Described but untagged", "Naamloze rit"]);
		expect(res.headers["x-total-count"]).toBe("2");
	});

	it("paginates with limit and offset", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		for (let i = 0; i < 3; i++) {
			await createRoute(app, user.id, { ...indexable, name: `Route nummer ${i}` });
		}
		const res = await supertest(app.getHttpServer()).get("/api/v1/routes/public?limit=2&offset=2").expect(200);
		expect(res.headers["x-total-count"]).toBe("3");
		expect(res.body).toHaveLength(1);
	});

	it("filters by placeCity under the indexable gate (RegionalHub query, #233)", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await createRoute(app, user.id, { ...indexable, name: "Gentse route", placeCity: "Gent" });
		await createRoute(app, user.id, { ...indexable, name: "Brugse route", placeCity: "Brugge" });
		const res = await supertest(app.getHttpServer()).get("/api/v1/routes/public?placeCity=gent").expect(200);
		expect(res.body.map((r: { name: string }) => r.name)).toEqual(["Gentse route"]);
	});
});

describe("GET /routes/public?gate=public (Discover)", () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await createTestApp();
	});

	beforeEach(async () => {
		await clearDatabase(app);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	it("includes every public route, even below the Indexable gate", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await createRoute(app, user.id, { name: "Bare short public", visibility: "public", distance: 500 });
		await createRoute(app, user.id, { name: "Unlisted", visibility: "unlisted", distance: 9000 });
		await createRoute(app, user.id, { name: "Private", visibility: "private", distance: 9000 });
		const res = await supertest(app.getHttpServer()).get("/api/v1/routes/public?gate=public").expect(200);
		expect(res.headers["x-total-count"]).toBe("1");
		expect(res.body.map((r: { name: string }) => r.name)).toEqual(["Bare short public"]);
	});

	it("orders by publishedAt descending", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await createRoute(app, user.id, {
			name: "Older",
			visibility: "public",
			publishedAt: new Date("2026-01-01T00:00:00Z"),
		});
		await createRoute(app, user.id, {
			name: "Newer",
			visibility: "public",
			publishedAt: new Date("2026-06-01T00:00:00Z"),
		});
		const res = await supertest(app.getHttpServer()).get("/api/v1/routes/public?gate=public").expect(200);
		expect(res.body.map((r: { name: string }) => r.name)).toEqual(["Newer", "Older"]);
	});

	it("filters by viewport bbox overlap, including routes that only pass through", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await createRoute(app, user.id, {
			name: "Inside Ghent",
			visibility: "public",
			geometry: [
				[3.7, 51.0],
				[3.75, 51.05],
			],
		});
		await createRoute(app, user.id, {
			name: "Far away",
			visibility: "public",
			geometry: [
				[5.5, 50.6],
				[5.55, 50.65],
			],
		});
		await createRoute(app, user.id, {
			name: "Long route crossing the viewport",
			visibility: "public",
			geometry: [
				[3.0, 50.8],
				[4.5, 51.3],
			],
		});
		const res = await supertest(app.getHttpServer())
			.get("/api/v1/routes/public?gate=public&bbox=3.6,50.9,3.8,51.1")
			.expect(200);
		expect(res.body.map((r: { name: string }) => r.name).sort()).toEqual([
			"Inside Ghent",
			"Long route crossing the viewport",
		]);
	});

	it("rejects a malformed bbox", async () => {
		await supertest(app.getHttpServer()).get("/api/v1/routes/public?gate=public&bbox=not-a-bbox").expect(400);
		await supertest(app.getHttpServer()).get("/api/v1/routes/public?gate=public&bbox=3.8,51.1,3.6,50.9").expect(400);
	});

	it("filters by activity and distance band", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await createRoute(app, user.id, { name: "Short ride", visibility: "public", activity: "cycle", distance: 10_000 });
		await createRoute(app, user.id, { name: "Long ride", visibility: "public", activity: "cycle", distance: 80_000 });
		await createRoute(app, user.id, { name: "Run", visibility: "public", activity: "run", distance: 10_000 });
		const res = await supertest(app.getHttpServer())
			.get("/api/v1/routes/public?gate=public&activity=cycle&minDistance=5000&maxDistance=30000")
			.expect(200);
		expect(res.body.map((r: { name: string }) => r.name)).toEqual(["Short ride"]);
	});

	it("filters by placeCity case-insensitively", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await createRoute(app, user.id, { name: "Gentse ronde", visibility: "public", placeCity: "Gent" });
		await createRoute(app, user.id, { name: "Brugse ronde", visibility: "public", placeCity: "Brugge" });
		const res = await supertest(app.getHttpServer())
			.get("/api/v1/routes/public?gate=public&placeCity=GENT")
			.expect(200);
		expect(res.body.map((r: { name: string }) => r.name)).toEqual(["Gentse ronde"]);
	});

	it("returns the discover summary shape: slugId, place, owner, downsampled geometry", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		const geometry = Array.from({ length: 500 }, (_, i) => [3.7 + i * 0.0001, 51.0 + i * 0.0001]) as [number, number][];
		const id = await createRoute(app, user.id, {
			name: "Watersportbaan Loop",
			visibility: "public",
			distance: 8000,
			activity: "run",
			geometry,
			publishedAt: new Date("2026-06-01T00:00:00Z"),
			placeCity: "Gent",
			placeRegion: "Oost-Vlaanderen",
			placeCountryCode: "BE",
		});
		const res = await supertest(app.getHttpServer()).get("/api/v1/routes/public?gate=public").expect(200);
		const item = res.body[0];
		expect(item).toMatchObject({
			id,
			slugId: `watersportbaan-loop-${id}`,
			activity: "run",
			placeCity: "Gent",
			placeRegion: "Oost-Vlaanderen",
			placeCountryCode: "BE",
		});
		expect(typeof item.publishedAt).toBe("string");
		expect(item.user.handle).toBeDefined();
		expect(item.geometry.length).toBeLessThanOrEqual(80);
		expect(item.geometry[0]).toEqual(geometry[0]);
		expect(item.geometry.at(-1)).toEqual(geometry.at(-1));
	});
});
