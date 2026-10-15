import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { stubProperty, unstubAll } from "@/test/helpers";
import { trackEvent } from "../track";

describe("trackEvent opt-out gate", () => {
	const track = vi.fn();

	beforeEach(() => {
		track.mockClear();
		window.umami = { track };
		useRedesignSettingsStore.setState({ analyticsEnabled: true });
		stubProperty(navigator, "doNotTrack", null);
		window.doNotTrack = undefined;
	});

	afterEach(() => {
		unstubAll();
		window.umami = undefined;
	});

	it("dispatches to umami while analytics is enabled", () => {
		trackEvent({ name: "user_logged_out", properties: {} });
		expect(track).toHaveBeenCalledTimes(1);
	});

	it("sends nothing once the user opts out in settings", () => {
		useRedesignSettingsStore.setState({ analyticsEnabled: false });
		trackEvent({ name: "user_logged_out", properties: {} });
		expect(track).not.toHaveBeenCalled();
	});

	it("honours the browser Do Not Track signal even when the setting is on", () => {
		stubProperty(navigator, "doNotTrack", "1");
		trackEvent({ name: "user_logged_out", properties: {} });
		expect(track).not.toHaveBeenCalled();
	});
});
