import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import type { RouteVisibility } from "src/entities/route.entity";
import { Route } from "src/entities/route.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";

interface SeedRoute {
	name: string;
	visibility: RouteVisibility;
	distance?: number;
	description?: string;
	tags?: string[];
}

async function createRoute(app: INestApplication, userId: number, seed: SeedRoute): Promise<number> {
	const orm = app.get(MikroORM);
	return withRequestContext(app, async () => {
		const route = orm.em.create(Route, {
			name: seed.name,
			user: userId,
			waypoints: [
				{ coord: [4.4, 51.2], type: "routed" },
				{ coord: [4.41, 51.21], type: "routed" },
			],
			visibility: seed.visibility,
			distance: seed.distance,
			description: seed.description,
			tags: seed.tags ?? [],
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

	it("paginates with limit and offset", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		for (let i = 0; i < 3; i++) {
			await createRoute(app, user.id, { ...indexable, name: `Route nummer ${i}` });
		}
		const res = await supertest(app.getHttpServer()).get("/api/v1/routes/public?limit=2&offset=2").expect(200);
		expect(res.headers["x-total-count"]).toBe("3");
		expect(res.body).toHaveLength(1);
	});
});
