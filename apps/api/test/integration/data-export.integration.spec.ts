import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import JSZip from "jszip";
import { Route } from "src/entities/route.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";

describe("Data Export Integration Tests", () => {
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

	it("requires authentication", async () => {
		await supertest(app.getHttpServer()).get("/api/v1/users/me/export").expect(401);
	});

	it("returns a ZIP containing JSON dump, README, and one GPX per route", async () => {
		const { user, accessToken } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await withRequestContext(app, async () => {
			const orm = app.get(MikroORM);
			const route = orm.em.create(Route, {
				name: "Sunday loop",
				user: user.id,
				waypoints: [
					{ coord: [4.4, 51.2], type: "routed" },
					{ coord: [4.41, 51.21], type: "routed" },
				],
				geometry: [
					[4.4, 51.2],
					[4.405, 51.205],
					[4.41, 51.21],
				],
				visibility: "private",
				tags: ["hilly"],
			});
			await orm.em.persist(route).flush();
		});

		const response = await supertest(app.getHttpServer())
			.get("/api/v1/users/me/export")
			.set("Authorization", `Bearer ${accessToken}`)
			.responseType("blob")
			.expect(200);

		expect(response.headers["content-type"]).toContain("application/zip");
		expect(response.headers["content-disposition"]).toMatch(/attachment; filename=".*\.zip"/);

		const zip = await JSZip.loadAsync(response.body);
		const filenames = Object.keys(zip.files).sort();
		expect(filenames).toContain("README.txt");
		expect(filenames).toContain("routess-export.json");
		expect(filenames.some((n) => n.startsWith("routes/") && n.endsWith(".gpx"))).toBe(true);

		const jsonText = await zip.file("routess-export.json")?.async("string");
		expect(jsonText).toBeTruthy();
		const payload = JSON.parse(jsonText ?? "{}");
		expect(payload.user.email).toBe("alice@example.com");
		expect(payload.routes).toHaveLength(1);
		expect(payload.routes[0].name).toBe("Sunday loop");
		expect(payload.routes[0].visibility).toBe("private");
		expect(payload.routes[0].tags).toEqual(["hilly"]);

		const gpxName = filenames.find((n) => n.startsWith("routes/") && n.endsWith(".gpx"));
		const gpxText = (gpxName && (await zip.file(gpxName)?.async("string"))) || "";
		expect(gpxText).toContain("<?xml");
		expect(gpxText).toContain("<gpx");
		expect(gpxText).toContain("<rtept");
		expect(gpxText).toContain("<trkpt");
		// Coordinates from the route should be inside the GPX.
		expect(gpxText).toContain('lat="51.2"');
		expect(gpxText).toContain('lon="4.4"');
	});

	it("returns an empty routes array (still a valid ZIP) for accounts with no routes", async () => {
		const { accessToken } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		const response = await supertest(app.getHttpServer())
			.get("/api/v1/users/me/export")
			.set("Authorization", `Bearer ${accessToken}`)
			.responseType("blob")
			.expect(200);

		const zip = await JSZip.loadAsync(response.body);
		const jsonText = await zip.file("routess-export.json")?.async("string");
		const payload = JSON.parse(jsonText ?? "{}");
		expect(payload.routes).toEqual([]);
		// No GPX entries when there are no routes.
		expect(Object.keys(zip.files).filter((n) => n.endsWith(".gpx"))).toEqual([]);
	});
});
