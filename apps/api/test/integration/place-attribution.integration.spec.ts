import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Route } from "src/entities/route.entity";
import { User } from "src/entities/user.entity";
import { PlacesService } from "src/places/places.service";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, generateTestJWT, withRequestContext } from "../utils";

// Place attribution (#233): saving a Route persists its bbox synchronously and
// derives the Place asynchronously through the (stubbed) geocoder.

const originalFetch = globalThis.fetch;

function stubMapboxGeocoder(city: string, region: string, countryCode: string): void {
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url.startsWith("https://api.mapbox.com/geocoding/")) {
			return new Response(
				JSON.stringify({
					features: [
						{
							text: city,
							place_type: ["place"],
							context: [
								{ id: "region.1", text: region },
								{ id: "country.1", text: "Belgium", short_code: countryCode.toLowerCase() },
							],
						},
					],
				}),
			);
		}
		return originalFetch(input, init);
	}) as typeof fetch;
}

async function pollForPlace(app: INestApplication, routeId: number, timeoutMs = 3000): Promise<Route | null> {
	const orm = app.get(MikroORM);
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const route = await withRequestContext(app, () => orm.em.fork().findOne(Route, { id: routeId }, { refresh: true }));
		if (route?.placeCity) return route;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	return withRequestContext(app, () => orm.em.fork().findOne(Route, { id: routeId }, { refresh: true }));
}

describe("Place attribution on save", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let authToken: string;

	beforeAll(async () => {
		process.env.MAPBOX_PUBLIC_TOKEN = "pk.test-token";
		app = await createTestApp();
		orm = app.get(MikroORM);
	});

	beforeEach(async () => {
		await clearDatabase(app);
		const user = orm.em.create(User, {
			email: "place@example.com",
			name: "Place Tester",
			googleId: "google-place-123",
		});
		await orm.em.persist(user).flush();
		authToken = await generateTestJWT(user.id, user.email, app);
	});

	afterAll(async () => {
		globalThis.fetch = originalFetch;
		delete process.env.MAPBOX_PUBLIC_TOKEN;
		await closeTestApp(app);
	});

	it("persists the bbox synchronously and the Place asynchronously on create", async () => {
		stubMapboxGeocoder("Gent", "Oost-Vlaanderen", "BE");
		const res = await supertest(app.getHttpServer())
			.post("/api/v1/routes")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				name: "Gravelrondje Blaarmeersen",
				waypoints: [
					{ coord: [3.7, 51.04], type: "routed" },
					{ coord: [3.75, 51.06], type: "routed" },
				],
				geometry: [
					[3.7, 51.04],
					[3.72, 51.05],
					[3.75, 51.06],
				],
				distance: 12000,
			})
			.expect(201);

		const route = await pollForPlace(app, res.body.id);
		expect(route?.bboxMinLng).toBeCloseTo(3.7);
		expect(route?.bboxMaxLng).toBeCloseTo(3.75);
		expect(route?.bboxMinLat).toBeCloseTo(51.04);
		expect(route?.bboxMaxLat).toBeCloseTo(51.06);
		expect(route?.placeCity).toBe("Gent");
		expect(route?.placeRegion).toBe("Oost-Vlaanderen");
		expect(route?.placeCountryCode).toBe("BE");

		// #233: route API responses include the place.
		const getRes = await supertest(app.getHttpServer())
			.get(`/api/v1/routes/${res.body.id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.expect(200);
		expect(getRes.body.placeCity).toBe("Gent");
	});

	it("re-derives the Place when the start moves on update", async () => {
		stubMapboxGeocoder("Gent", "Oost-Vlaanderen", "BE");
		const created = await supertest(app.getHttpServer())
			.post("/api/v1/routes")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				name: "Verhuisde route",
				waypoints: [
					{ coord: [3.7, 51.04], type: "routed" },
					{ coord: [3.75, 51.06], type: "routed" },
				],
				geometry: [
					[3.7, 51.04],
					[3.75, 51.06],
				],
				distance: 9000,
			})
			.expect(201);
		await pollForPlace(app, created.body.id);

		stubMapboxGeocoder("Brugge", "West-Vlaanderen", "BE");
		await supertest(app.getHttpServer())
			.patch(`/api/v1/routes/${created.body.id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				geometry: [
					[3.22, 51.2],
					[3.25, 51.22],
				],
			})
			.expect(200);

		const deadline = Date.now() + 3000;
		let route: Route | null = null;
		while (Date.now() < deadline) {
			route = await withRequestContext(app, () =>
				orm.em.fork().findOne(Route, { id: created.body.id }, { refresh: true }),
			);
			if (route?.placeCity === "Brugge") break;
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		expect(route?.placeCity).toBe("Brugge");
		expect(route?.bboxMinLng).toBeCloseTo(3.22);
	});

	it("backfill fills missing bbox and Place, and is idempotent", async () => {
		stubMapboxGeocoder("Gent", "Oost-Vlaanderen", "BE");
		// Seed a legacy-shaped route: geometry but no bbox, no place.
		const routeId = await withRequestContext(app, async () => {
			const em = orm.em.fork();
			const user = await em.findOneOrFail(User, { email: "place@example.com" });
			const route = em.create(Route, {
				name: "Legacy route",
				user: user.id,
				waypoints: [
					{ coord: [3.7, 51.04], type: "routed" },
					{ coord: [3.75, 51.06], type: "routed" },
				],
				geometry: [
					[3.7, 51.04],
					[3.75, 51.06],
				],
				visibility: "public",
				tags: [],
			});
			await em.persist(route).flush();
			return route.id;
		});

		const places = app.get(PlacesService);
		const first = await withRequestContext(app, () => places.backfillMissing({ geocodeDelayMs: 0 }));
		expect(first).toEqual({ boxed: 1, placed: 1 });

		const route = await withRequestContext(app, () => orm.em.fork().findOne(Route, { id: routeId }, { refresh: true }));
		expect(route?.bboxMinLng).toBeCloseTo(3.7);
		expect(route?.placeCity).toBe("Gent");

		// Second run finds nothing left to fill.
		const second = await withRequestContext(app, () => places.backfillMissing({ geocodeDelayMs: 0 }));
		expect(second).toEqual({ boxed: 0, placed: 0 });
	});

	it("fails open: geocoder outage leaves the Place null and the save succeeds", async () => {
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.startsWith("https://api.mapbox.com/geocoding/")) {
				return new Response("upstream down", { status: 503 });
			}
			return originalFetch(input, init);
		}) as typeof fetch;

		const res = await supertest(app.getHttpServer())
			.post("/api/v1/routes")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				name: "Zonder plaats",
				waypoints: [
					{ coord: [3.7, 51.04], type: "routed" },
					{ coord: [3.75, 51.06], type: "routed" },
				],
				distance: 5000,
			})
			.expect(201);

		// Give the fire-and-forget derivation a moment to fail.
		await new Promise((resolve) => setTimeout(resolve, 200));
		const route = await withRequestContext(app, () =>
			orm.em.fork().findOne(Route, { id: res.body.id }, { refresh: true }),
		);
		expect(route?.placeCity).toBeNull();
		// bbox still derived from waypoints even without geometry.
		expect(route?.bboxMinLng).toBeCloseTo(3.7);
	});
});
