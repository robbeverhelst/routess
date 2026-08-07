import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "@/lib/analytics/track";
import { SignInGate } from "../SignInGate";

vi.mock("@/lib/analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));

describe("SignInGate", () => {
	beforeEach(() => {
		vi.mocked(trackEvent).mockClear();
	});

	it("reports the auth wall once, naming the action the user was blocked from", () => {
		render(<SignInGate title="t" description="d" actionAttempted="view_library" />);

		expect(trackEvent).toHaveBeenCalledTimes(1);
		expect(trackEvent).toHaveBeenCalledWith({
			name: "auth_wall_hit",
			properties: { action_attempted: "view_library" },
		});
	});

	it("does not re-report when the panel re-renders around it", () => {
		const { rerender } = render(<SignInGate title="t" description="d" actionAttempted="view_social" />);
		rerender(<SignInGate title="changed" description="d" actionAttempted="view_social" />);

		expect(trackEvent).toHaveBeenCalledTimes(1);
	});
});
