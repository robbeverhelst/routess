import { beforeEach, describe, expect, it, vi } from "bun:test";

import {
	handleAPIError,
	handleLocationError,
	handleNetworkError,
	handleRoutingError,
} from "@/lib/errors/error-handler";
import { ErrorCategory, ErrorSeverity } from "@/lib/errors/types";

// Mock the logger
vi.mock("@/lib/logger", () => ({
	Logger: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
	withoutTelemetry: (fn: () => unknown) => fn(),
}));

// Mock the toast system
const mockShowToast = vi.fn();
vi.mock("@/lib/errors/ErrorToast", () => ({
	showErrorToast: mockShowToast,
}));

// Mock Sentry so test runs don't try to ship events
vi.mock("@sentry/react", () => ({
	captureException: vi.fn(),
}));

describe("Error Handler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockShowToast.mockClear();
	});

	describe("Specific Error Handlers", () => {
		it("should handle API errors correctly", () => {
			const error = new Error("API request failed");
			const context = "UserService";

			handleAPIError(error, context);

			// The function should handle the error (exact behavior depends on implementation)
			// We're mainly testing that it doesn't throw
			expect(() => handleAPIError(error, context)).not.toThrow();
		});

		it("should handle network errors correctly", () => {
			const error = new Error("Network connection failed");
			const context = "MapboxAPI";

			handleNetworkError(error, context);

			expect(() => handleNetworkError(error, context)).not.toThrow();
		});

		it("should handle location errors correctly", () => {
			const error = new Error("Geolocation permission denied");
			const context = "LocationService";

			handleLocationError(error, context);

			expect(() => handleLocationError(error, context)).not.toThrow();
		});

		it("should handle routing errors correctly", () => {
			const error = new Error("Route calculation failed");
			const context = "RouteCalculationService";

			handleRoutingError(error, context);

			expect(() => handleRoutingError(error, context)).not.toThrow();
		});

		it("should handle API errors with retry function", () => {
			const error = new Error("Temporary API failure");
			const context = "UserService";
			const retryFn = vi.fn();

			handleAPIError(error, context, retryFn);

			expect(() => handleAPIError(error, context, retryFn)).not.toThrow();
		});

		it("should handle network errors with retry function", () => {
			const error = new Error("Connection timeout");
			const context = "MapboxAPI";
			const retryFn = vi.fn();

			handleNetworkError(error, context, retryFn);

			expect(() => handleNetworkError(error, context, retryFn)).not.toThrow();
		});

		it("should handle routing errors with retry function", () => {
			const error = new Error("Route service unavailable");
			const context = "RouteCalculationService";
			const retryFn = vi.fn();

			handleRoutingError(error, context, retryFn);

			expect(() => handleRoutingError(error, context, retryFn)).not.toThrow();
		});
	});

	describe("Error Categories", () => {
		it("should have correct error category values", () => {
			expect<string>(ErrorCategory.NETWORK).toBe("network");
			expect<string>(ErrorCategory.API).toBe("api");
			expect<string>(ErrorCategory.LOCATION).toBe("location");
			expect<string>(ErrorCategory.ROUTING).toBe("routing");
			expect<string>(ErrorCategory.MAP).toBe("map");
			expect<string>(ErrorCategory.AUTH).toBe("auth");
			expect<string>(ErrorCategory.VALIDATION).toBe("validation");
			expect<string>(ErrorCategory.UNKNOWN).toBe("unknown");
		});
	});

	describe("Error Severities", () => {
		it("should have correct error severity values", () => {
			expect<string>(ErrorSeverity.LOW).toBe("low");
			expect<string>(ErrorSeverity.MEDIUM).toBe("medium");
			expect<string>(ErrorSeverity.HIGH).toBe("high");
			expect<string>(ErrorSeverity.CRITICAL).toBe("critical");
		});
	});
});
