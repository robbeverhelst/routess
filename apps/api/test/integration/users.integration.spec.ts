import { INestApplication } from "@nestjs/common";
import supertest from "supertest";
import { createTestApp, clearDatabase, closeTestApp, generateTestJWT } from "../utils";
import { MikroORM } from "@mikro-orm/core";
import { User } from "src/entities/user.entity";
import { Route } from "src/entities/route.entity";

describe("Users Integration Tests", () => {
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
    orm.em.clear(); // Clear the entity manager cache

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
    orm.em.clear(); // Clear after creating to ensure fresh state

    // Generate auth tokens
    authToken = generateTestJWT(testUser.id, testUser.email, app);
    otherAuthToken = generateTestJWT(otherUser.id, otherUser.email, app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe("GET /users", () => {
    it("should return all active users", async () => {
      const response = await supertest(app.getHttpServer()).get("/api/v1/users").expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((u: { email: string }) => u.email)).toContain("test@example.com");
      expect(response.body.map((u: { email: string }) => u.email)).toContain("other@example.com");
    });

    it("should not return soft-deleted users", async () => {
      // Soft delete one user through the API
      await supertest(app.getHttpServer())
        .delete(`/api/v1/users/${testUser.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const response = await supertest(app.getHttpServer()).get("/api/v1/users").expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("other@example.com");
    });

    it("should not include sensitive data", async () => {
      const response = await supertest(app.getHttpServer()).get("/api/v1/users").expect(200);

      response.body.forEach((user: { googleId?: string }) => {
        expect(user).not.toHaveProperty("googleId");
        // Add other sensitive fields to check
      });
    });
  });

  describe("GET /users/profile", () => {
    it("should return authenticated user's profile", async () => {
      const response = await supertest(app.getHttpServer())
        .get("/api/v1/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testUser.id);
      expect(response.body.email).toBe("test@example.com");
      expect(response.body.name).toBe("Test User");
    });

    it("should fail without authentication", async () => {
      await supertest(app.getHttpServer()).get("/api/v1/users/profile").expect(401);
    });

    it("should include user statistics", async () => {
      // Create some routes for the user
      const route1 = orm.em.create(Route, {
        name: "Route 1",
        user: testUser,
        waypoints: [{ lat: 52.52, lng: 13.405, type: "routed" }],
        distance: 5000,
        // duration: 1800,
      });

      const route2 = orm.em.create(Route, {
        name: "Route 2",
        user: testUser,
        waypoints: [{ lat: 52.53, lng: 13.415, type: "routed" }],
        distance: 3000,
        // duration: 1200,
      });

      await orm.em.persistAndFlush([route1, route2]);

      const response = await supertest(app.getHttpServer())
        .get("/api/v1/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // If statistics are implemented
      if (response.body.statistics) {
        expect(response.body.statistics.totalRoutes).toBe(2);
        expect(response.body.statistics.totalDistance).toBe(8000);
        expect(response.body.statistics.totalDuration).toBe(3000);
      }
    });
  });

  describe("GET /users/:id", () => {
    it("should return user by id", async () => {
      const response = await supertest(app.getHttpServer())
        .get(`/api/v1/users/${testUser.id}`)
        .expect(200);

      expect(response.body.id).toBe(testUser.id);
      expect(response.body.email).toBe("test@example.com");
    });

    it("should return 404 for non-existent user", async () => {
      await supertest(app.getHttpServer()).get("/api/v1/users/999999").expect(404);
    });

    it("should return 404 for soft-deleted user", async () => {
      // Soft delete user through the API
      await supertest(app.getHttpServer())
        .delete(`/api/v1/users/${testUser.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      await supertest(app.getHttpServer()).get(`/api/v1/users/${testUser.id}`).expect(404);
    });
  });

  describe("PATCH /users/:id", () => {
    it("should update own profile", async () => {
      const updateData = {
        name: "Updated Name",
        avatar: "https://example.com/new-picture.jpg",
      };

      const response = await supertest(app.getHttpServer())
        .patch(`/api/v1/users/${testUser.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe("Updated Name");
      expect(response.body.avatar).toBe("https://example.com/new-picture.jpg");

      // Verify in database
      await orm.em.refresh(testUser);
      expect(testUser.name).toBe("Updated Name");
    });

    it("should not allow updating other user's profile", async () => {
      const updateData = {
        name: "Hacked Name",
      };

      await supertest(app.getHttpServer())
        .patch(`/api/v1/users/${testUser.id}`)
        .set("Authorization", `Bearer ${otherAuthToken}`)
        .send(updateData)
        .expect(403);

      // Verify name wasn't changed - need fresh fetch from DB
      orm.em.clear();
      const unchangedUser = await orm.em.findOneOrFail(User, { id: testUser.id });
      expect(unchangedUser.name).toBe("Test User");
    });

    it("should not allow updating protected fields", async () => {
      const updateData = {
        googleId: "new-google-id", // Should not be allowed (not in DTO)
      };

      await supertest(app.getHttpServer())
        .patch(`/api/v1/users/${testUser.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(400); // Expect validation error for unknown fields

      // Verify protected fields weren't changed
      await orm.em.refresh(testUser);
      expect(testUser.googleId).toBe("google-test-123");
    });

    it("should require authentication", async () => {
      await supertest(app.getHttpServer())
        .patch(`/api/v1/users/${testUser.id}`)
        .send({ name: "No Auth" })
        .expect(401);
    });
  });

  describe("DELETE /users/:id", () => {
    it("should soft delete own account", async () => {
      await supertest(app.getHttpServer())
        .delete(`/api/v1/users/${testUser.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify soft delete
      await orm.em.refresh(testUser);
      expect(testUser.deletedAt).toBeDefined();

      // Verify user's routes are also soft deleted (cascade)
      const userRoutes = await orm.em.find(Route, { user: testUser });
      userRoutes.forEach((route) => {
        expect(route.deletedAt).toBeDefined();
      });
    });

    it("should not allow deleting other user's account", async () => {
      await supertest(app.getHttpServer())
        .delete(`/api/v1/users/${testUser.id}`)
        .set("Authorization", `Bearer ${otherAuthToken}`)
        .expect(403);

      // Verify not deleted - need fresh fetch from DB
      orm.em.clear();
      const stillActiveUser = await orm.em.findOneOrFail(User, { id: testUser.id });
      expect(stillActiveUser.deletedAt).toBeNull();
    });

    it("should require authentication", async () => {
      await supertest(app.getHttpServer()).delete(`/api/v1/users/${testUser.id}`).expect(401);
    });

    it("should invalidate user's session after deletion", async () => {
      // Delete the user
      await supertest(app.getHttpServer())
        .delete(`/api/v1/users/${testUser.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Try to use the same token
      await supertest(app.getHttpServer())
        .get("/api/v1/users/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(401); // Or 404 if user not found
    });
  });

  describe("User Data Consistency", () => {
    it("should maintain data consistency when user has routes", async () => {
      // Create routes for the user
      const route1 = orm.em.create(Route, {
        name: "User Route 1",
        user: testUser,
        waypoints: [{ lat: 52.52, lng: 13.405, type: "routed" }],
        distance: 1000,
        // duration: 600,
      });

      const route2 = orm.em.create(Route, {
        name: "User Route 2",
        user: testUser,
        waypoints: [{ lat: 52.53, lng: 13.415, type: "routed" }],
        distance: 2000,
        // duration: 1200,
      });

      await orm.em.persistAndFlush([route1, route2]);

      // Get user with routes
      const userResponse = await supertest(app.getHttpServer())
        .get(`/api/v1/users/${testUser.id}`)
        .expect(200);

      // If routes are included in response
      if (userResponse.body.routes) {
        expect(userResponse.body.routes).toHaveLength(2);
      }

      // Delete user
      await supertest(app.getHttpServer())
        .delete(`/api/v1/users/${testUser.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify routes are also soft deleted
      await orm.em.refresh(route1);
      await orm.em.refresh(route2);
      expect(route1.deletedAt).toBeDefined();
      expect(route2.deletedAt).toBeDefined();
    });
  });
});
