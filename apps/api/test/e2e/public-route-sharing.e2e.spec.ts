import type { INestApplication } from "@nestjs/common";
import { buildRouteSlugId, parseRouteSlugId } from "@routess/core";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth } from "../utils";

const waypoints = [
	{ coord: [13.405, 52.52], timestamp: new Date().toISOString(), type: "routed" },
	{ coord: [13.409, 52.524], timestamp: new Date().toISOString(), type: "routed" },
];
const geometry = [
	[13.405, 52.52],
	[13.407, 52.522],
	[13.409, 52.524],
];

describe("Public route sharing E2E", () => {
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

	async function createRoute(token: string, overrides: Record<string, unknown>) {
		const res = await supertest(app.getHttpServer())
			.post("/api/v1/routes")
			.set("Authorization", `Bearer ${token}`)
			.send({ name: "Sunday Loop", waypoints, geometry, distance: 3500, duration: 1200, elevationGain: 25, ...overrides })
			.expect(201);
		return res.body;
	}

	it("creates a public route, normalising tags, and serves it to anonymous viewers", async () => {
		const { accessToken } = await createTestUserWithAuth(app, { email: "owner@example.com", googleId: "g-owner" });

		const created = await createRoute(accessToken, {
			visibility: "public",
			tags: ["Hilly", "Weekend Loop", "  Scenic  "],
		});
		// tag normalisation through the real ValidationPipe
		expect(created.tags).toEqual(["hilly", "weekend-loop", "scenic"]);
		expect(created.visibility).toBe("public");

		// the public page's data path: GET with NO auth header
		const anon = await supertest(app.getHttpServer()).get(`/api/v1/routes/${created.id}`).expect(200);
		expect(anon.body.name).toBe("Sunday Loop");
		expect(anon.body.tags).toEqual(["hilly", "weekend-loop", "scenic"]);
		expect(anon.body.geometry?.length).toBe(3);

		// the slug logic the share link / public URL is built from
		expect(buildRouteSlugId(anon.body.name, created.id)).toBe(`sunday-loop-${created.id}`);
		expect(parseRouteSlugId(`sunday-loop-${created.id}`)).toEqual({ slug: "sunday-loop", id: created.id });
	});

	it("serves GPX for a public route to anonymous viewers", async () => {
		const { accessToken } = await createTestUserWithAuth(app, { email: "gpx@example.com", googleId: "g-gpx" });
		const created = await createRoute(accessToken, { visibility: "public" });

		const res = await supertest(app.getHttpServer()).get(`/api/v1/routes/${created.id}/gpx`).expect(200);
		expect(res.headers["content-type"]).toContain("application/gpx+xml");
		expect(res.headers["content-disposition"]).toContain(".gpx");
		expect(res.text).toContain("<gpx");
		expect(res.text).toContain("<name>Sunday Loop</name>");
		expect(res.text).toContain("<trkpt"); // geometry
		expect(res.text).toContain("<rtept"); // waypoints
	});

	it("marks unlisted GPX noindex and keeps public GPX indexable", async () => {
		const { accessToken } = await createTestUserWithAuth(app, { email: "u@example.com", googleId: "g-u" });
		const unlisted = await createRoute(accessToken, { visibility: "unlisted" });
		const pub = await createRoute(accessToken, { visibility: "public" });

		const unlistedRes = await supertest(app.getHttpServer()).get(`/api/v1/routes/${unlisted.id}/gpx`).expect(200);
		expect(unlistedRes.headers["x-robots-tag"]).toBe("noindex");

		const pubRes = await supertest(app.getHttpServer()).get(`/api/v1/routes/${pub.id}/gpx`).expect(200);
		expect(pubRes.headers["x-robots-tag"]).toBeUndefined();
	});

	it("404s a private route and its GPX to anonymous viewers", async () => {
		const { accessToken } = await createTestUserWithAuth(app, { email: "p@example.com", googleId: "g-p" });
		const priv = await createRoute(accessToken, { visibility: "private" });

		await supertest(app.getHttpServer()).get(`/api/v1/routes/${priv.id}`).expect(404);
		await supertest(app.getHttpServer()).get(`/api/v1/routes/${priv.id}/gpx`).expect(404);
	});
});
