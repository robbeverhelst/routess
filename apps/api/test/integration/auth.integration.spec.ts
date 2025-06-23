import { INestApplication } from "@nestjs/common";
import supertest from "supertest";
import { createTestApp, clearDatabase, closeTestApp, generateTestJWT } from "../utils";
import { MikroORM } from "@mikro-orm/core";
import { User } from "src/entities/user.entity";
import { OAuth2Client } from "google-auth-library";

describe("Auth Integration Tests", () => {
  let app: INestApplication;
  let orm: MikroORM;
  let mockVerifyIdToken: jest.Mock;

  beforeAll(async () => {
    // Setup OAuth2Client mock
    mockVerifyIdToken = jest.fn();
    (OAuth2Client as any).mockImplementation(() => ({
      verifyIdToken: mockVerifyIdToken,
    }));

    app = await createTestApp();
    orm = app.get(MikroORM);
  });

  beforeEach(async () => {
    await clearDatabase(app);
    mockVerifyIdToken.mockClear();
  });

  afterAll(async () => {
    await closeTestApp(app);
    jest.restoreAllMocks();
  });

  describe("POST /auth/google", () => {
    it("should create a new user when valid Google token is provided", async () => {
      // Mock Google OAuth verification
      const mockGooglePayload = {
        sub: "google-user-123",
        email: "test@example.com",
        name: "Test User",
        picture: "https://example.com/picture.jpg",
      };

      // Set up the mock response
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => mockGooglePayload,
      });

      const response = await supertest(app.getHttpServer())
        .post("/auth/google")
        .send({ credential: "mock-google-token" })
        .expect(201);

      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe("test@example.com");

      // Verify user was created in database
      const user = await orm.em.findOne(User, { email: "test@example.com" });
      expect(user).toBeDefined();
      expect(user?.googleId).toBe("google-user-123");
    });

    it("should return existing user when Google user already exists", async () => {
      // Create existing user
      const existingUser = orm.em.create(User, {
        email: "existing@example.com",
        name: "Existing User",
        googleId: "google-existing-123",
        avatar: "https://example.com/existing.jpg",
      });
      await orm.em.persistAndFlush(existingUser);

      const mockGooglePayload = {
        sub: "google-existing-123",
        email: "existing@example.com",
        name: "Existing User",
        picture: "https://example.com/existing.jpg",
      };

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => mockGooglePayload,
      });

      const response = await supertest(app.getHttpServer())
        .post("/auth/google")
        .send({ credential: "mock-google-token" })
        .expect(201);

      expect(response.body.user.id).toBe(existingUser.id);

      // Verify only one user exists
      const userCount = await orm.em.count(User);
      expect(userCount).toBe(1);
    });

    it("should fail with invalid Google token", async () => {
      mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

      await supertest(app.getHttpServer())
        .post("/auth/google")
        .send({ credential: "invalid-token" })
        .expect(401);
    });

    it("should fail without credential", async () => {
      await supertest(app.getHttpServer()).post("/auth/google").send({}).expect(400);
    });
  });

  describe("JWT Authentication", () => {
    let testUser: User;
    let validToken: string;

    beforeEach(async () => {
      // Create test user
      testUser = orm.em.create(User, {
        email: "jwt-test@example.com",
        name: "JWT Test User",
        googleId: "google-jwt-test",
        avatar: "https://example.com/jwt-test.jpg",
      });
      await orm.em.persistAndFlush(testUser);

      // Get valid JWT token
      validToken = generateTestJWT(testUser.id, testUser.email, app);
    });

    it("should access protected route with valid JWT", async () => {
      await supertest(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(200);
    });

    it("should fail to access protected route without JWT", async () => {
      await supertest(app.getHttpServer()).get("/auth/me").expect(401);
    });

    it("should fail to access protected route with invalid JWT", async () => {
      await supertest(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });
  });
});
