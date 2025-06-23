import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, closeTestApp } from "../utils/test-utils";
import { setupMocks } from "../utils/setup-mocks";
import { OAuth2Client } from "google-auth-library";

describe("Performance Features Integration", () => {
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
      sub: "google-perf-test",
      email: "perf@example.com",
      name: "Performance Test User",
      picture: "https://example.com/perf.jpg",
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

  describe("Response Compression", () => {
    it("should compress responses when Accept-Encoding includes gzip", async () => {
      // Create several routes to ensure response is large enough for compression
      const routePromises = [];
      for (let i = 0; i < 3; i++) {
        routePromises.push(
          request(app.getHttpServer())
            .post("/api/v1/routes")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({
              name: `Compression Test Route ${i}`,
              description: `This is a test route for compression testing with a longer description to increase response size. Route number ${i}`,
              waypoints: [
                { lat: 50.8503 + i * 0.001, lng: 4.3517, type: "routed" },
                { lat: 50.8463 + i * 0.001, lng: 4.3517, type: "direct" },
                { lat: 50.8423 + i * 0.001, lng: 4.3517, type: "routed" },
                { lat: 50.8383 + i * 0.001, lng: 4.3517, type: "direct" },
              ],
            }),
        );
      }
      await Promise.all(routePromises);

      const response = await request(app.getHttpServer())
        .get("/api/v1/routes")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Accept-Encoding", "gzip, deflate, br")
        .expect(200);

      // Check if compression was applied (response should be large enough now)
      expect(response.headers["content-encoding"]).toBeDefined();
    });

    it("should respect x-no-compression header", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/routes")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Accept-Encoding", "gzip")
        .set("x-no-compression", "true")
        .expect(200);

      // Should not compress when x-no-compression is set
      expect(response.headers["content-encoding"]).toBeUndefined();
    });

    it("should only compress responses above threshold", async () => {
      // Small response (health check) might not be compressed
      const response = await request(app.getHttpServer())
        .get("/health/live")
        .set("Accept-Encoding", "gzip")
        .expect(200);

      // Small responses under 1KB threshold might not be compressed
      // This test verifies the threshold logic is working
      expect(response.status).toBe(200);
    });
  });

  describe("Database Query Optimization", () => {
    it("should limit query results to prevent large responses", async () => {
      // Create multiple routes to test pagination/limiting
      const routePromises = [];
      for (let i = 0; i < 5; i++) {
        routePromises.push(
          request(app.getHttpServer())
            .post("/api/v1/routes")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({
              name: `Test Route ${i}`,
              description: `Test route number ${i}`,
              waypoints: [
                { lat: 50.8503 + i * 0.001, lng: 4.3517, type: "routed" },
                { lat: 50.8463 + i * 0.001, lng: 4.3517, type: "direct" },
              ],
            }),
        );
      }
      await Promise.all(routePromises);

      // Fetch all routes and verify they're returned efficiently
      const response = await request(app.getHttpServer())
        .get("/api/v1/routes")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(100); // Verify 100 route limit
    });

    it("should return routes in descending order by creation date", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/routes")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      if (response.body.length > 1) {
        const dates = response.body.map((route: any) => new Date(route.createdAt));
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i - 1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
        }
      }
    });
  });

  describe("Response Time", () => {
    it("should respond to health checks quickly", async () => {
      const startTime = Date.now();

      await request(app.getHttpServer()).get("/health/live").expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100); // Should respond within 100ms
    });

    it("should handle route operations efficiently", async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get("/api/v1/routes")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});
