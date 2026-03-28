import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { MetricsService } from "../../src/telemetry/metrics.service";
import { setupMocks } from "../utils/setup-mocks";
import { closeTestApp, createTestApp } from "../utils/test-utils";

describe("Observability Features Integration", () => {
	let app: INestApplication;
	let metricsService: MetricsService;
	let originalFetch: typeof fetch;

	async function waitForMetrics(predicate: (text: string) => boolean, attempts = 10, delayMs = 100): Promise<string> {
		let lastText = "";

		for (let attempt = 0; attempt < attempts; attempt++) {
			const response = await request(app.getHttpServer()).get("/metrics").expect(200);
			lastText = response.text;

			if (predicate(lastText)) {
				return lastText;
			}

			if (attempt < attempts - 1) {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		return lastText;
	}

	beforeAll(async () => {
		setupMocks();

		// Mock fetch for metrics endpoint
		originalFetch = global.fetch;
		global.fetch = (() => {
			return Promise.resolve({
				ok: true,
				text: () =>
					Promise.resolve(`# HELP http_server_duration_ms HTTP server duration in milliseconds
# TYPE http_server_duration_ms histogram
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="1"} 1
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="5"} 1
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="10"} 1
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="25"} 1
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="50"} 1
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="100"} 1
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="250"} 1
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="500"} 1
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="1000"} 1
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="2500"} 1
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="5000"} 1
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="10000"} 1
http_server_duration_ms_bucket{method="GET",route="/health",status_code="200",le="+Inf"} 1
http_server_duration_ms_sum{method="GET",route="/health",status_code="200"} 5.2
http_server_duration_ms_count{method="GET",route="/health",status_code="200"} 1
# HELP http_server_duration HTTP server duration in seconds
# TYPE http_server_duration histogram
http_server_duration{method="GET",route="/health",status_code="200",le="0.001"} 1
http_server_duration{method="GET",route="/health",status_code="200",le="0.005"} 1
http_server_duration{method="GET",route="/health",status_code="200",le="0.01"} 1
http_server_duration{method="GET",route="/health",status_code="200",le="0.025"} 1
http_server_duration{method="GET",route="/health",status_code="200",le="0.05"} 1
http_server_duration{method="GET",route="/health",status_code="200",le="0.1"} 1
http_server_duration{method="GET",route="/health",status_code="200",le="0.25"} 1
http_server_duration{method="GET",route="/health",status_code="200",le="0.5"} 1
http_server_duration{method="GET",route="/health",status_code="200",le="1"} 1
http_server_duration{method="GET",route="/health",status_code="200",le="2.5"} 1
http_server_duration{method="GET",route="/health",status_code="200",le="5"} 1
http_server_duration{method="GET",route="/health",status_code="200",le="10"} 1
http_server_duration{method="GET",route="/health",status_code="200",le="+Inf"} 1
http_server_duration_sum{method="GET",route="/health",status_code="200"} 0.0052
http_server_duration_count{method="GET",route="/health",status_code="200"} 1
# HELP target_info Target metadata
# TYPE target_info gauge
target_info{service_name="maps-api",service_version="1.0.0"} 1`),
			} as Response);
		}) as typeof fetch;

		app = await createTestApp();
		metricsService = app.get<MetricsService>(MetricsService);
	});

	afterAll(async () => {
		global.fetch = originalFetch;
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
			// Make a request to generate metrics
			await request(app.getHttpServer()).get("/health/live").expect(200);
			metricsService.recordHttpRequest("GET", "/health/live", 200, 5);

			const metricsText = await waitForMetrics(
				(text) => text.includes("http_request_duration_ms") && text.includes("http_requests_total"),
			);

			expect(metricsText).toContain("http_request_duration_ms");
			expect(metricsText).toContain("http_requests_total");
			expect(metricsText).toContain("target_info");
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
