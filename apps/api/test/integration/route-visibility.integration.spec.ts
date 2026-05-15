import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import type { RouteVisibility } from "src/entities/route.entity";
import { Route } from "src/entities/route.entity";
import { User } from "src/entities/user.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";

async function createRoute(
	app: INestApplication,
	userId: number,
	visibility: RouteVisibility,
	name = "Route",
): Promise<number> {
	const orm = app.get(MikroORM);
	return withRequestContext(app, async () => {
		const route = orm.em.create(Route, {
			name,
			user: userId,
			waypoints: [
				{ coord: [4.4, 51.2], type: "routed" },
				{ coord: [4.41, 51.21], type: "routed" },
			],
			visibility,
			tags: [],
		});
		await orm.em.persistAndFlush(route);
		return route.id;
	});
}

describe("Route Visibility Integration Tests", () => {
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

	describe("GET /routes/:id", () => {
		it("owner can read a private route", async () => {
			const { user, accessToken } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			const id = await createRoute(app, user.id, "private");
			await supertest(app.getHttpServer())
				.get(`/api/v1/routes/${id}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
		});

		it("anonymous viewer gets 404 (not 403) on a private route", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			const id = await createRoute(app, user.id, "private");
			await supertest(app.getHttpServer()).get(`/api/v1/routes/${id}`).expect(404);
		});

		it("non-owner authenticated user gets 404 on a private route", async () => {
			const { user: alice } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			const { accessToken: bobToken } = await createTestUserWithAuth(app, { email: "bob@example.com" });
			const id = await createRoute(app, alice.id, "private");
			await supertest(app.getHttpServer())
				.get(`/api/v1/routes/${id}`)
				.set("Authorization", `Bearer ${bobToken}`)
				.expect(404);
		});

		it("anonymous viewer can read an unlisted route by direct URL", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			const id = await createRoute(app, user.id, "unlisted");
			const response = await supertest(app.getHttpServer()).get(`/api/v1/routes/${id}`).expect(200);
			expect(response.body.visibility).toBe("unlisted");
		});

		it("anonymous viewer can read a public route", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			const id = await createRoute(app, user.id, "public");
			const response = await supertest(app.getHttpServer()).get(`/api/v1/routes/${id}`).expect(200);
			expect(response.body.visibility).toBe("public");
		});
	});

	describe("GET /routes/by-user/:userId", () => {
		it("returns only public routes — never private or unlisted", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			await createRoute(app, user.id, "private", "Private route");
			await createRoute(app, user.id, "unlisted", "Unlisted route");
			const publicId = await createRoute(app, user.id, "public", "Public route");

			const response = await supertest(app.getHttpServer()).get(`/api/v1/routes/by-user/${user.id}`).expect(200);
			expect(response.body).toHaveLength(1);
			expect(response.body[0].id).toBe(publicId);
			expect(response.body[0].visibility).toBe("public");
		});

		it("returns an empty array when the owner has no public routes", async () => {
			const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			await createRoute(app, user.id, "private");
			await createRoute(app, user.id, "unlisted");
			const response = await supertest(app.getHttpServer()).get(`/api/v1/routes/by-user/${user.id}`).expect(200);
			expect(response.body).toHaveLength(0);
		});
	});

	describe("POST /routes — default visibility", () => {
		it("falls back to 'private' when the owner has no preference set", async () => {
			const { accessToken } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			const response = await supertest(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					name: "Default-visibility route",
					waypoints: [
						{ coord: [4.4, 51.2], type: "routed" },
						{ coord: [4.41, 51.21], type: "routed" },
					],
				})
				.expect(201);
			expect(response.body.visibility).toBe("private");
		});

		it("uses the owner's defaultRouteVisibility when set", async () => {
			const { user, accessToken } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				const u = await orm.em.findOneOrFail(User, { id: user.id });
				u.preferences = {
					units: "km",
					showPois: true,
					terrain3d: false,
					autoSnap: true,
					defaultActivity: "Cycling",
					selectedSports: [],
					sportSpeeds: {},
					mapStyle: "outdoors",
					overlays: { heatmap: true, contour: false, bike: true, surface: false, wind: false },
					defaultRouteVisibility: "unlisted",
				};
				await orm.em.persistAndFlush(u);
			});

			const response = await supertest(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					name: "Owner-default route",
					waypoints: [
						{ coord: [4.4, 51.2], type: "routed" },
						{ coord: [4.41, 51.21], type: "routed" },
					],
				})
				.expect(201);
			expect(response.body.visibility).toBe("unlisted");
		});

		it("an explicit visibility in the request body wins over the owner's default", async () => {
			const { accessToken } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			const response = await supertest(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					name: "Explicit-public route",
					visibility: "public",
					waypoints: [
						{ coord: [4.4, 51.2], type: "routed" },
						{ coord: [4.41, 51.21], type: "routed" },
					],
				})
				.expect(201);
			expect(response.body.visibility).toBe("public");
		});
	});
});
