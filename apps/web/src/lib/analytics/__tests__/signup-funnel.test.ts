import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackSignInEntry } from "../signup-funnel";
import { trackEvent } from "../track";

vi.mock("../track", () => ({ trackEvent: vi.fn() }));

describe("trackSignInEntry", () => {
	beforeEach(() => {
		vi.mocked(trackEvent).mockClear();
	});

	it("reports the entry point a sign-in CTA was clicked from", () => {
		trackSignInEntry("auth_wall");
		expect(trackEvent).toHaveBeenCalledWith({
			name: "signup_started",
			properties: { entry_point: "auth_wall" },
		});
	});

	it("stays silent when a logout or deletion dropped the user on the sign-in screen", () => {
		trackSignInEntry("session_ended");
		expect(trackEvent).not.toHaveBeenCalled();
	});
});
