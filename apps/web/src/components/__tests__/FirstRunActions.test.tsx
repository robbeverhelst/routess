import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "@/lib/analytics/track";
import { useModalsStore } from "@/stores/modalsStore";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { FirstRunActions } from "../FirstRunActions";

vi.mock("@/lib/analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));

describe("FirstRunActions", () => {
	beforeEach(() => {
		vi.mocked(trackEvent).mockClear();
		useRedesignSettingsStore.getState().setFirstRunActionsDismissed(false);
		useModalsStore.getState().closeModal();
	});

	it("offers both ways to start a route", () => {
		render(<FirstRunActions />);

		expect(screen.getByRole("button", { name: /plan.loopHeroTitle/ })).toBeTruthy();
		expect(screen.getByRole("button", { name: /firstRun.drawItMyself/ })).toBeTruthy();
	});

	it("opens the loop generator and stays dismissed afterwards", () => {
		render(<FirstRunActions />);
		fireEvent.click(screen.getByRole("button", { name: /plan.loopHeroTitle/ }));

		expect(useModalsStore.getState().modal).toBe("loop");
		// Dismissed for good: they've seen the generator, re-offering it on every
		// empty map would nag.
		expect(useRedesignSettingsStore.getState().firstRunActionsDismissed).toBe(true);
		expect(trackEvent).toHaveBeenCalledWith({
			name: "first_run_action_chosen",
			properties: { choice: "generate" },
		});
	});

	it("swaps the buttons for a tap hint when the user chooses to draw", () => {
		render(<FirstRunActions />);
		fireEvent.click(screen.getByRole("button", { name: /firstRun.drawItMyself/ }));

		expect(screen.getByText("firstRun.tapHint")).toBeTruthy();
		expect(screen.queryByRole("button", { name: /firstRun.drawItMyself/ })).toBeNull();
		expect(trackEvent).toHaveBeenCalledWith({
			name: "first_run_action_chosen",
			properties: { choice: "draw" },
		});
	});

	it("keeps the drawing choice unpersisted so a reload offers both paths again", () => {
		render(<FirstRunActions />);
		fireEvent.click(screen.getByRole("button", { name: /firstRun.drawItMyself/ }));

		expect(useRedesignSettingsStore.getState().firstRunActionsDismissed).toBe(false);
	});
});
