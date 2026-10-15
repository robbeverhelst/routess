import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { stubProperty, unstubAll } from "@/test/helpers";
import { getAnonymousId } from "../anonymous-id";
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

describe("trackEvent anonymous id", () => {
	const track = vi.fn();

	beforeEach(() => {
		track.mockClear();
		localStorage.clear();
		window.umami = { track };
		useRedesignSettingsStore.setState({ analyticsEnabled: true });
		stubProperty(navigator, "doNotTrack", null);
		window.doNotTrack = undefined;
	});

	afterEach(() => {
		unstubAll();
		window.umami = undefined;
	});

	it("attaches the same anon_id to every event from this device", () => {
		trackEvent({ name: "user_logged_out", properties: {} });
		trackEvent({ name: "discover_opened", properties: {} });
		const first = track.mock.calls[0][1].anon_id;
		expect(first).toMatch(/^[0-9a-f-]{36}$/);
		expect(track.mock.calls[1][1].anon_id).toBe(first);
	});

	it("does not mint an id while analytics is off, and forgets it on opt-out", () => {
		const id = getAnonymousId();
		useRedesignSettingsStore.getState().setAnalyticsEnabled(false);
		expect(localStorage.getItem("routess.anon_id")).toBeNull();
		trackEvent({ name: "user_logged_out", properties: {} });
		expect(localStorage.getItem("routess.anon_id")).toBeNull();

		useRedesignSettingsStore.getState().setAnalyticsEnabled(true);
		trackEvent({ name: "user_logged_out", properties: {} });
		expect(track.mock.calls[0][1].anon_id).not.toBe(id);
	});

	it("forgets the id once Do Not Track is switched on", () => {
		trackEvent({ name: "user_logged_out", properties: {} });
		expect(localStorage.getItem("routess.anon_id")).not.toBeNull();
		stubProperty(navigator, "doNotTrack", "1");
		trackEvent({ name: "user_logged_out", properties: {} });
		expect(localStorage.getItem("routess.anon_id")).toBeNull();
	});
});
