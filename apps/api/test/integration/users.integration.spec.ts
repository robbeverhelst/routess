import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Route } from "src/entities/route.entity";
import { User } from "src/entities/user.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, generateTestJWT } from "../utils";

describe("Users Integration Tests", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let testUser: User;
	let authToken: string;

	beforeAll(async () => {
		app = await createTestApp();
		orm = app.get(MikroORM);
	});

	beforeEach(async () => {
		await clearDatabase(app);
		orm.em.clear();

		testUser = orm.em.create(User, {
			email: "test@example.com",
			name: "Test User",
			googleId: "google-test-123",
			avatar: "https://example.com/test.jpg",
			isEmailVerified: true,
		});

		await orm.em.persistAndFlush(testUser);
		authToken = await generateTestJWT(testUser.id, testUser.email, app);
		orm.em.clear();
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	describe("GET /users/me", () => {
		it("should return authenticated user's profile", async () => {
			const response = await supertest(app.getHttpServer())
				.get("/api/v1/users/me")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body).toMatchObject({
				id: testUser.id,
				email: "test@example.com",
				name: "Test User",
				isEmailVerified: true,
				statistics: {
					totalRoutes: 0,
					totalDistance: 0,
				},
			});
		});

		it("should include route statistics", async () => {
			const route1 = orm.em.create(Route, {
				name: "Route 1",
				user: testUser,
				waypoints: [{ coord: [13.405, 52.52], type: "routed" }],
				distance: 5000,
			});

			const route2 = orm.em.create(Route, {
				name: "Route 2",
				user: testUser,
				waypoints: [{ coord: [13.415, 52.53], type: "routed" }],
				distance: 3000,
			});

			await orm.em.persistAndFlush([route1, route2]);

			const response = await supertest(app.getHttpServer())
				.get("/api/v1/users/me")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.statistics).toEqual({
				totalRoutes: 2,
				totalDistance: 8000,
			});
		});

		it("should fail without authentication", async () => {
			await supertest(app.getHttpServer()).get("/api/v1/users/me").expect(401);
		});
	});

	describe("PATCH /users/me", () => {
		it("should update own profile", async () => {
			const updateData = {
				name: "Updated Name",
				avatar: "https://example.com/new-picture.jpg",
			};

			const response = await supertest(app.getHttpServer())
				.patch("/api/v1/users/me")
				.set("Authorization", `Bearer ${authToken}`)
				.send(updateData)
				.expect(200);

			expect(response.body.name).toBe("Updated Name");
			expect(response.body.avatar).toBe("https://example.com/new-picture.jpg");

			orm.em.clear();
			const updatedUser = await orm.em.findOneOrFail(User, { id: testUser.id });
			expect(updatedUser.name).toBe("Updated Name");
		});

		it("should reject protected fields", async () => {
			await supertest(app.getHttpServer())
				.patch("/api/v1/users/me")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ email: "hijack@example.com" })
				.expect(400);
		});
	});

	describe("DELETE /users/me", () => {
		it("should soft delete own account and routes", async () => {
			const route = orm.em.create(Route, {
				name: "Route 1",
				user: testUser,
				waypoints: [{ coord: [13.405, 52.52], type: "routed" }],
				distance: 5000,
			});
			await orm.em.persistAndFlush(route);

			await supertest(app.getHttpServer())
				.delete("/api/v1/users/me")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			orm.em.clear();
			const deletedUser = await orm.em.findOneOrFail(User, { id: testUser.id });
			const deletedRoute = await orm.em.findOneOrFail(Route, { id: route.id });

			expect(deletedUser.deletedAt).toBeDefined();
			expect(deletedRoute.deletedAt).toBeDefined();
		});

		it("should invalidate the active session after deletion", async () => {
			await supertest(app.getHttpServer())
				.delete("/api/v1/users/me")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			await supertest(app.getHttpServer())
				.get("/api/v1/users/me")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(401);
		});
	});
});
