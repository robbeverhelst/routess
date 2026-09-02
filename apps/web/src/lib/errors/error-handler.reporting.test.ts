import { ApiDomainError } from "@routess/api-client";
import * as Sentry from "@sentry/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleAPIError, handleRoutingError } from "@/lib/errors/error-handler";
import { isTelemetrySuppressed, Logger, withoutTelemetry } from "@/lib/logger";

vi.mock("@sentry/react", () => ({
	captureException: vi.fn(),
	captureMessage: vi.fn(),
}));

vi.mock("@/lib/errors/ErrorToast", () => ({ showErrorToast: vi.fn() }));

const captureException = vi.mocked(Sentry.captureException);
const captureMessage = vi.mocked(Sentry.captureMessage);

const domainError = (code: "UNAUTHORIZED" | "FORBIDDEN" | "INTERNAL", message: string) =>
	new ApiDomainError({ code, message, statusCode: code === "INTERNAL" ? 500 : 401 });

describe("withoutTelemetry", () => {
	it("suppresses only for the duration of the call, and nests", () => {
		expect(isTelemetrySuppressed()).toBe(false);
		withoutTelemetry(() => {
			expect(isTelemetrySuppressed()).toBe(true);
			withoutTelemetry(() => expect(isTelemetrySuppressed()).toBe(true));
			expect(isTelemetrySuppressed()).toBe(true);
		});
		expect(isTelemetrySuppressed()).toBe(false);
	});

	it("restores suppression when the body throws", () => {
		expect(() =>
			withoutTelemetry(() => {
				throw new Error("boom");
			}),
		).toThrow("boom");
		expect(isTelemetrySuppressed()).toBe(false);
	});
});

describe("ErrorHandler reporting", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// The handler used to log the failure (which reports it as a message event)
	// and then report the exception, filing two unrelated GlitchTip issues for
	// one error.
	it("logs the failure with telemetry suppressed, so it is reported once", () => {
		let suppressedWhileLogging: boolean | null = null;
		const spy = vi.spyOn(Logger, "info").mockImplementation(() => {
			suppressedWhileLogging = isTelemetrySuppressed();
		});

		handleRoutingError(new Error("routing blew up"), "recalculate");

		expect(spy).toHaveBeenCalled();
		expect(suppressedWhileLogging).toBe(true);
		expect(captureException).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});

	it.each(["UNAUTHORIZED", "FORBIDDEN"] as const)("does not report %s: the API is answering, not failing", (code) => {
		handleAPIError(domainError(code, "Unauthorized"), "/users/me");

		expect(captureException).not.toHaveBeenCalled();
		expect(captureMessage).not.toHaveBeenCalled();
	});

	it("still reports a genuine API failure", () => {
		handleAPIError(domainError("INTERNAL", "Valhalla request failed"), "/routing/route");

		expect(captureException).toHaveBeenCalledTimes(1);
	});
});
