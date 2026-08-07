import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { trackEvent } from "../track";

describe("trackEvent opt-out gate", () => {
	const track = vi.fn();

	beforeEach(() => {
		track.mockClear();
		window.umami = { track };
		useRedesignSettingsStore.setState({ analyticsEnabled: true });
		vi.spyOn(navigator, "doNotTrack", "get").mockReturnValue(null);
		window.doNotTrack = undefined;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		window.umami = undefined;
	});

	it("dispatches to umami while analytics is enabled", () => {
		trackEvent({ name: "user_logged_out", properties: {} });
		expect(track).toHaveBeenCalledOnce();
	});

	it("sends nothing once the user opts out in settings", () => {
		useRedesignSettingsStore.setState({ analyticsEnabled: false });
		trackEvent({ name: "user_logged_out", properties: {} });
		expect(track).not.toHaveBeenCalled();
	});

	it("honours the browser Do Not Track signal even when the setting is on", () => {
		vi.spyOn(navigator, "doNotTrack", "get").mockReturnValue("1");
		trackEvent({ name: "user_logged_out", properties: {} });
		expect(track).not.toHaveBeenCalled();
	});
});
