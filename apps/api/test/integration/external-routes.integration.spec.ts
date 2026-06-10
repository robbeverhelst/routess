import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { type RouteActivity, routeBoundingBox, type SeedRoute } from "@routess/core";
import { ExternalRoute } from "src/entities/external-route.entity";
import { Route } from "src/entities/route.entity";
import { SeedSource } from "src/entities/seed-source.entity";
import { ExternalRoutesService } from "src/external-routes/external-routes.service";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";

const GEOMETRY: [number, number][] = [
	[3.72, 51.05],
	[3.74, 51.06],
	[3.76, 51.07],
];

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
	seed: { name: string; sourceRecordId: string; distance?: number; tags?: string[]; activity?: RouteActivity },
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

describe("ExternalRoutes (ADR 0033)", () => {
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

	it("unions ExternalRoutes into GET /routes/public?gate=public alongside user routes", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		const orm = app.get(MikroORM);
		await withRequestContext(app, async () => {
			const route = orm.em.create(Route, {
				name: "Alice loop",
				user: user.id,
				waypoints: [
					{ coord: [4.4, 51.2] as [number, number], type: "routed" as const },
					{ coord: [4.41, 51.21] as [number, number], type: "routed" as const },
				],
				visibility: "public",
				distance: 30_000,
				publishedAt: new Date(),
				bboxMinLat: 51.2,
				bboxMaxLat: 51.21,
				bboxMinLng: 4.4,
				bboxMaxLng: 4.41,
			});
			await orm.em.persist(route).flush();
		});
		const sourceId = await createSeedSource(app);
		await createExternalRoute(app, sourceId, { name: "EuroVelo 5", sourceRecordId: "eurovelo-5" });

		const res = await supertest(app.getHttpServer()).get("/api/v1/routes/public?gate=public").expect(200);
		expect(res.headers["x-total-count"]).toBe("2");
		const names = res.body.map((r: { name: string }) => r.name).sort();
		expect(names).toEqual(["Alice loop", "EuroVelo 5"]);

		const external = res.body.find((r: { name: string }) => r.name === "EuroVelo 5");
		expect(external.source).toMatchObject({ key: "eurovelo", license: "ODbL-1.0" });
		expect(external.slugId).toBe(`eurovelo-5-x${external.id}`);
		expect(external.user).toBeUndefined();
	});

	it("includes quality ExternalRoutes in the indexable gate and drops too-short ones", async () => {
		const sourceId = await createSeedSource(app);
		await createExternalRoute(app, sourceId, { name: "EuroVelo 5", sourceRecordId: "ev5", distance: 45_000 });
		await createExternalRoute(app, sourceId, { name: "Stub", sourceRecordId: "stub", distance: 500, tags: [] });

		const res = await supertest(app.getHttpServer()).get("/api/v1/routes/public?gate=indexable").expect(200);
		expect(res.body.map((r: { name: string }) => r.name)).toEqual(["EuroVelo 5"]);
	});

	it("serves a single ExternalRoute detail with attribution", async () => {
		const sourceId = await createSeedSource(app);
		const id = await createExternalRoute(app, sourceId, { name: "EuroVelo 5", sourceRecordId: "ev5" });

		const res = await supertest(app.getHttpServer()).get(`/api/v1/external-routes/${id}`).expect(200);
		expect(res.body).toMatchObject({ id, name: "EuroVelo 5", kind: "external" });
		expect(res.body.source.attribution).toContain("EuroVelo");
		expect(res.body.slugId).toBe(`eurovelo-5-x${id}`);
	});

	it("exports GPX with the source attribution embedded", async () => {
		const sourceId = await createSeedSource(app);
		const id = await createExternalRoute(app, sourceId, { name: "EuroVelo 5", sourceRecordId: "ev5" });

		const res = await supertest(app.getHttpServer()).get(`/api/v1/external-routes/${id}/gpx`).expect(200);
		expect(res.text).toContain("<copyright author=");
		expect(res.text).toContain("EuroVelo");
	});

	it("refreshDueSources pulls due feed sources, skips manual ones, and reports stats", async () => {
		const service = app.get(ExternalRoutesService);
		const orm = app.get(MikroORM);
		await withRequestContext(app, async () => {
			// One automatic source (feedUrl) and one manual (no feedUrl).
			await service.ensureSource({
				key: "eurovelo",
				displayName: "EuroVelo",
				license: "ODbL-1.0",
				attribution: "© EuroVelo / ECF, ODbL",
				sourceUrl: "https://eurovelo.com",
				countries: ["BE"],
				activities: ["cycle"],
				status: "green",
				refreshIntervalDays: 30,
				feedUrl: "https://example.test/eurovelo.gpx",
			});
			const manual = orm.em.create(SeedSource, {
				key: "manual-source",
				displayName: "Manual",
				license: "CC-BY-4.0",
				attribution: "© Manual",
				sourceUrl: "https://example.test",
				countries: ["BE"],
				activities: ["cycle"],
				status: "green",
				refreshIntervalDays: 30,
			});
			await orm.em.persist(manual).flush();
		});

		const gpx = `<gpx><metadata><name>EuroVelo network</name></metadata><trk><name>EuroVelo 5 - Via Romea (Francigena)</name><trkseg>
			<trkpt lat="51.05" lon="3.72"></trkpt><trkpt lat="51.06" lon="3.74"></trkpt><trkpt lat="51.07" lon="3.76"></trkpt>
		</trkseg></trk></gpx>`;
		const fetched: string[] = [];
		const fakeFetch = async (url: string) => {
			fetched.push(url);
			return gpx;
		};

		const first = await withRequestContext(app, () => service.refreshDueSources(fakeFetch));
		expect(fetched).toEqual(["https://example.test/eurovelo.gpx"]);
		expect(first.find((r) => r.source === "eurovelo")?.result).toMatchObject({ inserted: 1 });
		expect(first.find((r) => r.source === "manual-source")?.skipped).toBe("manual");

		// Immediately after a sync the source is not due again.
		const second = await withRequestContext(app, () => service.refreshDueSources(fakeFetch));
		expect(second.find((r) => r.source === "eurovelo")?.skipped).toBe("not-due");

		const stats = await withRequestContext(app, () => service.sourceStats());
		const ev = stats.find((s) => s.key === "eurovelo");
		expect(ev).toMatchObject({ routeCount: 1, removedCount: 0, automatic: true });
		expect(ev?.lastRefreshedAt).toBeTruthy();
		expect(ev?.nextRefreshAt).toBeTruthy();
		const manualStats = stats.find((s) => s.key === "manual-source");
		expect(manualStats).toMatchObject({ routeCount: 0, automatic: false, nextRefreshAt: null });
	});

	it("upserts idempotently on (source, sourceRecordId): re-running does not duplicate", async () => {
		await createSeedSource(app);
		const service = app.get(ExternalRoutesService);
		const seeds: SeedRoute[] = [
			{ sourceRecordId: "ev5", name: "EuroVelo 5", activity: "cycle", geometry: GEOMETRY, distance: 45_000 },
			{ sourceRecordId: "ev7", name: "EuroVelo 7", activity: "cycle", geometry: GEOMETRY, distance: 60_000 },
		];

		const first = await withRequestContext(app, () => service.upsertSeedRoutes("eurovelo", seeds));
		expect(first).toMatchObject({ inserted: 2, updated: 0, unchanged: 0, removed: 0 });

		const second = await withRequestContext(app, () => service.upsertSeedRoutes("eurovelo", seeds));
		expect(second).toMatchObject({ inserted: 0, updated: 0, unchanged: 2, removed: 0 });

		// Dropping ev7 from the feed soft-deletes it; re-adding revives it.
		const third = await withRequestContext(app, () => service.upsertSeedRoutes("eurovelo", [seeds[0]]));
		expect(third).toMatchObject({ inserted: 0, unchanged: 1, removed: 1 });

		const res = await supertest(app.getHttpServer()).get("/api/v1/routes/public?gate=public").expect(200);
		expect(res.body.map((r: { name: string }) => r.name)).toEqual(["EuroVelo 5"]);
	});
});
