import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { REGIONAL_HUB_MIN_INDEXABLE_ROUTES, routeBoundingBox } from "@routess/core";
import { ExternalRoute } from "src/entities/external-route.entity";
import type { RouteActivity, RouteVisibility } from "src/entities/route.entity";
import { Route } from "src/entities/route.entity";
import { SeedSource } from "src/entities/seed-source.entity";
import { PlacesService } from "src/places/places.service";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";

const GEOMETRY: [number, number][] = [
	[3.7, 51.04],
	[3.72, 51.05],
	[3.75, 51.06],
];

interface SeedRoute {
	name: string;
	visibility?: RouteVisibility;
	distance?: number;
	description?: string;
	tags?: string[];
	activity?: RouteActivity;
	placeCity?: string;
	placeRegion?: string;
	placeCountryCode?: string;
}

async function createRoute(app: INestApplication, userId: number, seed: SeedRoute): Promise<number> {
	const orm = app.get(MikroORM);
	return withRequestContext(app, async () => {
		const box = routeBoundingBox(GEOMETRY);
		const route = orm.em.create(Route, {
			name: seed.name,
			user: userId,
			waypoints: [
				{ coord: [3.7, 51.04], type: "routed" },
				{ coord: [3.75, 51.06], type: "routed" },
			],
			visibility: seed.visibility ?? "public",
			distance: seed.distance ?? 45_000,
			description: seed.description,
			tags: seed.tags ?? ["gravel"],
			activity: seed.activity ?? "cycle",
			geometry: GEOMETRY,
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

async function createSeedSource(app: INestApplication): Promise<number> {
	const orm = app.get(MikroORM);
	return withRequestContext(app, async () => {
		const source = orm.em.create(SeedSource, {
			key: "eurovelo",
			displayName: "EuroVelo (European Cyclists' Federation)",
			license: "ODbL-1.0",
			attribution: "© EuroVelo / European Cyclists' Federation, ODbL",
			sourceUrl: "https://eurovelo.com",
			countries: ["BE"],
			activities: ["cycle"],
			status: "green",
			refreshIntervalDays: 30,
		});
		await orm.em.persist(source).flush();
		return source.id;
	});
}

async function createExternalRoute(
	app: INestApplication,
	sourceId: number,
	seed: SeedRoute & { sourceRecordId: string },
): Promise<number> {
	const orm = app.get(MikroORM);
	return withRequestContext(app, async () => {
		const box = routeBoundingBox(GEOMETRY);
		const route = orm.em.create(ExternalRoute, {
			name: seed.name,
			geometry: GEOMETRY,
			tags: seed.tags ?? ["eurovelo"],
			distance: seed.distance ?? 45_000,
			activity: seed.activity ?? "cycle",
			placeCity: seed.placeCity,
			placeRegion: seed.placeRegion,
			placeCountryCode: seed.placeCountryCode,
			source: sourceId,
			sourceRecordId: seed.sourceRecordId,
			contentHash: `hash-${seed.sourceRecordId}`,
			bboxMinLat: box?.minLat,
			bboxMaxLat: box?.maxLat,
			bboxMinLng: box?.minLng,
			bboxMaxLng: box?.maxLng,
		});
		await orm.em.persist(route).flush();
		return route.id;
	});
}

const gent = { placeCity: "Gent", placeRegion: "Oost-Vlaanderen", placeCountryCode: "BE" };

describe("GET /places/hubs (RegionalHubs, #236)", () => {
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

	it("lists a place once it clears the threshold, and not below it", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		for (let i = 0; i < REGIONAL_HUB_MIN_INDEXABLE_ROUTES - 1; i++) {
			await createRoute(app, user.id, { name: `Gentse lus ${i}`, ...gent });
		}
		const below = await supertest(app.getHttpServer()).get("/api/v1/places/hubs?activity=cycle").expect(200);
		expect(below.body).toEqual([]);

		await createRoute(app, user.id, { name: "Gentse lus 4", ...gent });
		const at = await supertest(app.getHttpServer()).get("/api/v1/places/hubs?activity=cycle").expect(200);
		expect(at.body).toHaveLength(1);
		expect(at.body[0]).toMatchObject({
			slug: "gent",
			city: "Gent",
			region: "Oost-Vlaanderen",
			countryCode: "BE",
			activity: "cycle",
			indexableCount: REGIONAL_HUB_MIN_INDEXABLE_ROUTES,
		});
		expect(typeof at.body[0].lastModified).toBe("string");
	});

	it("unions Routes and ExternalRoutes at read time (ADR 0035)", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		const sourceId = await createSeedSource(app);
		for (let i = 0; i < 3; i++) {
			await createRoute(app, user.id, { name: `Gentse lus ${i}`, ...gent });
		}
		await createExternalRoute(app, sourceId, { name: "EuroVelo 5", sourceRecordId: "ev5", ...gent });
		await createExternalRoute(app, sourceId, { name: "Schelderoute", sourceRecordId: "schelde", ...gent });
		const res = await supertest(app.getHttpServer()).get("/api/v1/places/hubs?activity=cycle").expect(200);
		expect(res.body).toHaveLength(1);
		expect(res.body[0]).toMatchObject({ slug: "gent", indexableCount: 5 });
	});

	it("only counts routes clearing the Indexable gate", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		for (let i = 0; i < 4; i++) {
			await createRoute(app, user.id, { name: `Gentse lus ${i}`, ...gent });
		}
		// None of these may push Gent over the threshold.
		await createRoute(app, user.id, { name: "Te kort", distance: 500, ...gent });
		await createRoute(app, user.id, { name: "Untitled route", ...gent });
		await createRoute(app, user.id, { name: "Kaal", tags: [], description: undefined, ...gent });
		await createRoute(app, user.id, { name: "Verborgen", visibility: "private", ...gent });
		await createRoute(app, user.id, { name: "Zonder plaats" });
		const res = await supertest(app.getHttpServer()).get("/api/v1/places/hubs?activity=cycle").expect(200);
		expect(res.body).toEqual([]);
	});

	it("scopes hubs per activity", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		for (let i = 0; i < 5; i++) {
			await createRoute(app, user.id, { name: `Wandeling ${i}`, activity: "walk", ...gent });
		}
		const cycle = await supertest(app.getHttpServer()).get("/api/v1/places/hubs?activity=cycle").expect(200);
		expect(cycle.body).toEqual([]);
		const walk = await supertest(app.getHttpServer()).get("/api/v1/places/hubs?activity=walk").expect(200);
		expect(walk.body).toHaveLength(1);
		expect(walk.body[0]).toMatchObject({ slug: "gent", activity: "walk", indexableCount: 5 });
	});

	it("groups place casing variants under one slug and transliterates diacritics", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		for (let i = 0; i < 3; i++) {
			await createRoute(app, user.id, { name: `Gentse lus ${i}`, ...gent });
		}
		for (let i = 0; i < 2; i++) {
			await createRoute(app, user.id, { name: `gentse lus ${i + 3}`, ...gent, placeCity: "gent" });
		}
		for (let i = 0; i < 5; i++) {
			await createRoute(app, user.id, {
				name: `Boucle liégeoise ${i}`,
				placeCity: "Liège",
				placeRegion: "Wallonie",
				placeCountryCode: "BE",
			});
		}
		const res = await supertest(app.getHttpServer()).get("/api/v1/places/hubs?activity=cycle").expect(200);
		const slugs = res.body.map((hub: { slug: string }) => hub.slug).sort();
		expect(slugs).toEqual(["gent", "liege"]);
		const gentHub = res.body.find((hub: { slug: string }) => hub.slug === "gent");
		expect(gentHub.indexableCount).toBe(5);
	});

	it("rejects a missing or unknown activity", async () => {
		await supertest(app.getHttpServer()).get("/api/v1/places/hubs").expect(400);
		await supertest(app.getHttpServer()).get("/api/v1/places/hubs?activity=swim").expect(400);
	});
});

describe("ExternalRoute place backfill (#236)", () => {
	let app: INestApplication;
	const originalFetch = globalThis.fetch;

	beforeAll(async () => {
		process.env.MAPBOX_PUBLIC_TOKEN = "pk.test-token";
		app = await createTestApp();
	});

	beforeEach(async () => {
		await clearDatabase(app);
	});

	afterAll(async () => {
		globalThis.fetch = originalFetch;
		delete process.env.MAPBOX_PUBLIC_TOKEN;
		await closeTestApp(app);
	});

	it("fills missing Places on ExternalRoutes idempotently", async () => {
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			if (String(input).startsWith("https://api.mapbox.com/geocoding/")) {
				return new Response(
					JSON.stringify({
						features: [
							{
								text: "Gent",
								place_type: ["place"],
								context: [
									{ id: "region.1", text: "Oost-Vlaanderen" },
									{ id: "country.1", text: "Belgium", short_code: "be" },
								],
							},
						],
					}),
				);
			}
			return originalFetch(input, init);
		}) as typeof fetch;

		const sourceId = await createSeedSource(app);
		const id = await createExternalRoute(app, sourceId, { name: "EuroVelo 5", sourceRecordId: "ev5" });
		const places = app.get(PlacesService);

		const first = await withRequestContext(app, () => places.backfillExternalMissing({ geocodeDelayMs: 0 }));
		expect(first.placed).toBe(1);

		const orm = app.get(MikroORM);
		const route = await withRequestContext(app, () =>
			orm.em.fork().findOneOrFail(ExternalRoute, { id }, { refresh: true }),
		);
		expect(route.placeCity).toBe("Gent");
		expect(route.placeRegion).toBe("Oost-Vlaanderen");
		expect(route.placeCountryCode).toBe("BE");

		const second = await withRequestContext(app, () => places.backfillExternalMissing({ geocodeDelayMs: 0 }));
		expect(second.placed).toBe(0);
	});
});
