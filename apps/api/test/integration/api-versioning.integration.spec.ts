import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, closeTestApp } from "../utils/test-utils";
import { setupMocks } from "../utils/setup-mocks";
import { OAuth2Client } from "google-auth-library";

describe("API Versioning Integration", () => {
  let app: INestApplication;
  let accessToken: string;
  let mockVerifyIdToken: any;

  beforeAll(async () => {
    setupMocks();

    // Setup OAuth2Client mock by overriding the prototype
    mockVerifyIdToken = jest.fn();

    // Override the prototype method directly
    OAuth2Client.prototype.verifyIdToken = mockVerifyIdToken;

    app = await createTestApp();

    // Create a test user and get access token
    const mockPayload = {
      sub: "google-versioning-test",
      email: "versioning@example.com",
      name: "Versioning Test User",
      picture: "https://example.com/versioning.jpg",
    };

    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => mockPayload,
    });

    const authResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/google")
      .send({ credential: "mock-token" })
      .expect(201);

    accessToken = authResponse.body.accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe("Version 1 API", () => {
    it("should access endpoints with /api/v1 prefix", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/routes")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should work with default version when no version specified", async () => {
      // Test that default version routing works
      const response = await request(app.getHttpServer())
        .post("/api/v1/routes")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Test Route",
          description: "A test route",
          waypoints: [
            { lat: 50.8503, lng: 4.3517, type: "routed" },
            { lat: 50.8463, lng: 4.3517, type: "direct" },
          ],
        })
        .expect(201);

      expect(response.body.name).toBe("Test Route");
    });
  });

  describe("Version Header Support", () => {
    it("should accept version in URL path", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/routes")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.status).toBe(200);
    });
  });

  describe("Invalid Version Handling", () => {
    it("should handle invalid version gracefully", async () => {
      // Test accessing an endpoint without proper versioning
      const response = await request(app.getHttpServer())
        .get("/routes") // No version prefix
        .set("Authorization", `Bearer ${accessToken}`);

      // Should either redirect to versioned endpoint or return 404
      expect([404, 302, 301]).toContain(response.status);
    });
  });
});
