import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Route } from "src/entities/route.entity";
import { User } from "src/entities/user.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, generateTestJWT } from "../utils";

describe("Routes Integration Tests", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let testUser: User;
	let otherUser: User;
	let authToken: string;
	let otherAuthToken: string;

	beforeAll(async () => {
		app = await createTestApp();
		orm = app.get(MikroORM);
	});

	beforeEach(async () => {
		await clearDatabase(app);

		// Create test users
		testUser = orm.em.create(User, {
			email: "test@example.com",
			name: "Test User",
			googleId: "google-test-123",
			avatar: "https://example.com/test.jpg",
		});

		otherUser = orm.em.create(User, {
			email: "other@example.com",
			name: "Other User",
			googleId: "google-other-123",
			avatar: "https://example.com/other.jpg",
		});

		await orm.em.persistAndFlush([testUser, otherUser]);

		// Generate auth tokens
		authToken = generateTestJWT(testUser.id, testUser.email, app);
		otherAuthToken = generateTestJWT(otherUser.id, otherUser.email, app);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	describe("POST /routes", () => {
		it("should create a new route for authenticated user", async () => {
			const routeData = {
				name: "Test Route",
				description: "A test route description",
				waypoints: [
					{ lat: 52.52, lng: 13.405, timestamp: new Date().toISOString(), type: "routed" },
					{ lat: 52.521, lng: 13.406, timestamp: new Date().toISOString(), type: "routed" },
				],
				distance: 1500,
				// duration: 900,
				elevationGain: 50,
				startAddress: "Berlin, Germany",
				endAddress: "Berlin, Germany",
			};

			const response = await supertest(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.send(routeData)
				.expect(201);

			expect(response.body).toHaveProperty("id");
			expect(response.body.name).toBe(routeData.name);
			expect(response.body.user.id).toBe(testUser.id);
			expect(response.body.waypoints).toHaveLength(2);

			// Verify in database
			const route = await orm.em.findOne(Route, { id: response.body.id });
			expect(route).toBeDefined();
			expect(route?.user.id).toBe(testUser.id);
		});

		it("should fail to create route without authentication", async () => {
			const routeData = {
				name: "Test Route",
				waypoints: [{ lat: 52.52, lng: 13.405, type: "routed" }],
			};

			await supertest(app.getHttpServer()).post("/api/v1/routes").send(routeData).expect(401);
		});

		it("should validate required fields", async () => {
			const invalidRoute = {
				description: "Missing required name field",
			};

			await supertest(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.send(invalidRoute)
				.expect(400);
		});

		it("should require type field for waypoints", async () => {
			const routeWithoutType = {
				name: "Test Route",
				waypoints: [{ lat: 52.52, lng: 13.405 }], // Missing required 'type' field
			};

			await supertest(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.send(routeWithoutType)
				.expect(400);
		});
	});

	describe("GET /routes", () => {
		let userRoute1: Route;
		let userRoute2: Route;
		let otherUserRoute: Route;

		beforeEach(async () => {
			// Create test routes
			userRoute1 = orm.em.create(Route, {
				name: "User Route 1",
				user: testUser,
				waypoints: [{ lat: 52.52, lng: 13.405, type: "routed" }],
				distance: 1000,
				// duration: 600,
			});

			userRoute2 = orm.em.create(Route, {
				name: "User Route 2",
				user: testUser,
				waypoints: [{ lat: 52.53, lng: 13.415, type: "routed" }],
				distance: 2000,
				// duration: 1200,
			});

			otherUserRoute = orm.em.create(Route, {
				name: "Other User Route",
				user: otherUser,
				waypoints: [{ lat: 52.54, lng: 13.425, type: "routed" }],
				distance: 3000,
				// duration: 1800,
			});

			await orm.em.persistAndFlush([userRoute1, userRoute2, otherUserRoute]);
		});

		it("should return only authenticated user's routes", async () => {
			const response = await supertest(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body).toHaveLength(2);
			expect(response.body[0].user.id).toBe(testUser.id);
			expect(response.body[1].user.id).toBe(testUser.id);
		});

		it("should not include soft-deleted routes", async () => {
			// Soft delete one route
			userRoute1.deletedAt = new Date();
			await orm.em.flush();

			const response = await supertest(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body).toHaveLength(1);
			expect(response.body[0].id).toBe(userRoute2.id);
		});

		it("should fail without authentication", async () => {
			await supertest(app.getHttpServer()).get("/api/v1/routes").expect(401);
		});
	});

	describe("GET /routes/:id", () => {
		let testRoute: Route;

		beforeEach(async () => {
			testRoute = orm.em.create(Route, {
				name: "Test Route",
				user: testUser,
				waypoints: [{ lat: 52.52, lng: 13.405, type: "routed" }],
				distance: 1000,
				// duration: 600,
			});
			await orm.em.persistAndFlush(testRoute);
		});

		it("should return route by id for owner", async () => {
			const response = await supertest(app.getHttpServer())
				.get(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.id).toBe(testRoute.id);
			expect(response.body.name).toBe("Test Route");
		});

		it("should return 404 for non-owner", async () => {
			await supertest(app.getHttpServer())
				.get(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${otherAuthToken}`)
				.expect(404);
		});

		it("should return 404 for non-existent route", async () => {
			await supertest(app.getHttpServer())
				.get("/api/v1/routes/999999")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(404);
		});

		it("should return 404 for soft-deleted route", async () => {
			testRoute.deletedAt = new Date();
			await orm.em.flush();

			await supertest(app.getHttpServer())
				.get(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(404);
		});
	});

	describe("PATCH /routes/:id", () => {
		let testRoute: Route;

		beforeEach(async () => {
			testRoute = orm.em.create(Route, {
				name: "Original Name",
				description: "Original Description",
				user: testUser,
				waypoints: [{ lat: 52.52, lng: 13.405, type: "routed" }],
				distance: 1000,
				// duration: 600,
			});
			await orm.em.persistAndFlush(testRoute);
		});

		it("should update route for owner", async () => {
			const updateData = {
				name: "Updated Name",
				description: "Updated Description",
			};

			const response = await supertest(app.getHttpServer())
				.patch(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.send(updateData)
				.expect(200);

			expect(response.body.name).toBe("Updated Name");
			expect(response.body.description).toBe("Updated Description");

			// Verify in database
			await orm.em.refresh(testRoute);
			expect(testRoute.name).toBe("Updated Name");
		});

		it("should return 404 when non-owner tries to update", async () => {
			await supertest(app.getHttpServer())
				.patch(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${otherAuthToken}`)
				.send({ name: "Hacked Name" })
				.expect(404);

			// Verify name wasn't changed
			await orm.em.refresh(testRoute);
			expect(testRoute.name).toBe("Original Name");
		});

		it("should validate update data", async () => {
			const invalidUpdate = {
				waypoints: "not-an-array", // Should be array
			};

			await supertest(app.getHttpServer())
				.patch(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.send(invalidUpdate)
				.expect(400);
		});
	});

	describe("DELETE /routes/:id", () => {
		let testRoute: Route;

		beforeEach(async () => {
			testRoute = orm.em.create(Route, {
				name: "Route to Delete",
				user: testUser,
				waypoints: [{ lat: 52.52, lng: 13.405, type: "routed" }],
				distance: 1000,
				// duration: 600,
			});
			await orm.em.persistAndFlush(testRoute);
		});

		it("should soft delete route for owner", async () => {
			await supertest(app.getHttpServer())
				.delete(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			// Verify soft delete
			await orm.em.refresh(testRoute);
			expect(testRoute.deletedAt).toBeDefined();

			// Verify route is not returned in list
			const response = await supertest(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body).toHaveLength(0);
		});

		it("should return 404 when non-owner tries to delete", async () => {
			await supertest(app.getHttpServer())
				.delete(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${otherAuthToken}`)
				.expect(404);

			// Verify not deleted
			await orm.em.refresh(testRoute);
			expect(testRoute.deletedAt).toBeNull();
		});

		it("should return 404 for already deleted route", async () => {
			testRoute.deletedAt = new Date();
			await orm.em.flush();

			await supertest(app.getHttpServer())
				.delete(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(404);
		});
	});
});
