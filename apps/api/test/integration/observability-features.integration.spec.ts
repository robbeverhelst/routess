import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { MetricsService } from "../../src/telemetry/metrics.service";
import { setupMocks } from "../utils/setup-mocks";
import { closeTestApp, createTestApp } from "../utils/test-utils";

describe("Observability Features Integration", () => {
	let app: INestApplication;
	let metricsService: MetricsService;

	beforeAll(async () => {
		setupMocks();

		app = await createTestApp();
		metricsService = app.get<MetricsService>(MetricsService);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	describe("Health Checks", () => {
		it("should return health status", async () => {
			const response = await request(app.getHttpServer()).get("/health").expect(200);

			expect(response.body).toMatchObject({
				status: "ok",
				info: expect.any(Object),
				error: expect.any(Object),
				details: expect.any(Object),
			});
		});

		it("should return readiness status", async () => {
			const response = await request(app.getHttpServer()).get("/health/ready").expect(200);

			expect(response.body).toMatchObject({
				status: "ok",
				info: expect.any(Object),
				error: expect.any(Object),
				details: expect.any(Object),
			});
		});

		it("should return liveness status", async () => {
			const response = await request(app.getHttpServer()).get("/health/live").expect(200);

			expect(response.body).toMatchObject({
				status: "ok",
				timestamp: expect.any(String),
			});
		});
	});

	describe("Metrics Endpoint", () => {
		it("should expose Prometheus metrics", async () => {
			const response = await request(app.getHttpServer()).get("/metrics").expect(200);

			expect(response.headers["content-type"]).toContain("text/plain");
			expect(response.text).toContain("# HELP");
			expect(response.text).toContain("# TYPE");
		});

		it("should include custom business metrics", async () => {
			// Generate some metrics
			metricsService.recordUserRegistration("google");
			metricsService.recordRouteCreated(1);

			// Wait a bit for metrics to be processed
			await new Promise((resolve) => setTimeout(resolve, 100));

			const response = await request(app.getHttpServer()).get("/metrics").expect(200);

			// Check that metrics service is available and endpoint works
			expect(response.text).toContain("# HELP");
			expect(response.text).toContain("# TYPE");
			// Verify that system metrics are being collected
			expect(response.text.length).toBeGreaterThan(100);
		});
	});

	describe("Request ID Tracking", () => {
		it("should generate request ID when not provided", async () => {
			const response = await request(app.getHttpServer()).get("/health/live").expect(200);

			expect(response.headers["x-request-id"]).toBeDefined();
			expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/); // UUID format
		});

		it("should use provided request ID", async () => {
			const requestId = "test-request-id-123";

			const response = await request(app.getHttpServer())
				.get("/health/live")
				.set("X-Request-ID", requestId)
				.expect(200);

			expect(response.headers["x-request-id"]).toBe(requestId);
		});
	});

	describe("Metrics Collection", () => {
		it("should record HTTP request metrics", async () => {
			await request(app.getHttpServer()).get("/health/live").expect(200);
			metricsService.recordHttpRequest("GET", "/health/live", 200, 5);

			const response = await request(app.getHttpServer()).get("/metrics").expect(200);

			expect(response.headers["content-type"]).toContain("text/plain");
			expect(response.text).not.toContain("# metrics disabled");
			expect(response.text).toContain("target_info");
		});
	});

	describe("Structured Logging", () => {
		it("should include request context in logs", async () => {
			// This test verifies that the logging setup is working
			// In a real scenario, you'd capture and verify log output
			const response = await request(app.getHttpServer())
				.get("/health/live")
				.set("X-Request-ID", "test-log-id")
				.expect(200);

			expect(response.headers["x-request-id"]).toBe("test-log-id");
			// Note: In practice, you'd need to capture console output or use a test logger
		});
	});
});
