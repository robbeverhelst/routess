import type { ErrorEvent } from "@sentry/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimit, rateLimitBeforeSend } from "./rate-limit";

function eventWithMessage(message: string): ErrorEvent {
	return {
		message,
		exception: { values: [{ type: "Error", value: message }] },
	} as ErrorEvent;
}

describe("rateLimitBeforeSend", () => {
	afterEach(() => {
		__resetRateLimit();
		vi.useRealTimers();
	});

	it("passes through the first 10 events with the same fingerprint", () => {
		for (let i = 0; i < 10; i += 1) {
			expect(rateLimitBeforeSend(eventWithMessage("boom"))).not.toBeNull();
		}
	});

	it("drops the 11th and beyond within the window", () => {
		for (let i = 0; i < 10; i += 1) {
			rateLimitBeforeSend(eventWithMessage("boom"));
		}
		expect(rateLimitBeforeSend(eventWithMessage("boom"))).toBeNull();
		expect(rateLimitBeforeSend(eventWithMessage("boom"))).toBeNull();
	});

	it("treats different fingerprints independently", () => {
		for (let i = 0; i < 10; i += 1) {
			rateLimitBeforeSend(eventWithMessage("boom"));
		}
		expect(rateLimitBeforeSend(eventWithMessage("other"))).not.toBeNull();
	});

	it("resets the bucket after the window expires", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		for (let i = 0; i < 10; i += 1) {
			rateLimitBeforeSend(eventWithMessage("boom"));
		}
		expect(rateLimitBeforeSend(eventWithMessage("boom"))).toBeNull();

		vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
		expect(rateLimitBeforeSend(eventWithMessage("boom"))).not.toBeNull();
	});
});
