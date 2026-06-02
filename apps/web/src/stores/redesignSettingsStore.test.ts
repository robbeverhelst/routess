import { normalizeRedesignSettings, useRedesignSettingsStore } from "@/stores/redesignSettingsStore";

describe("redesignSettingsStore", () => {
	it("keeps experimental node-network overlay controls hidden by default", () => {
		expect(useRedesignSettingsStore.getState().showNodeNetworkOverlays).toBe(false);
	});

	it("migrates the legacy combined nodes overlay into separate hiking and cycling toggles", () => {
		const settings = normalizeRedesignSettings({
			overlays: {
				heatmap: true,
				contour: false,
				bike: true,
				surface: false,
				wind: false,
				nodes: true,
			} as unknown as Parameters<typeof normalizeRedesignSettings>[0]["overlays"],
		});

		expect(settings.overlays.hikingNodes).toBe(true);
		expect(settings.overlays.cyclingNodes).toBe(true);
	});

	it("prefers explicit node overlay flags over the legacy combined nodes flag", () => {
		const settings = normalizeRedesignSettings({
			overlays: {
				nodes: true,
				hikingNodes: false,
				cyclingNodes: false,
			} as unknown as Parameters<typeof normalizeRedesignSettings>[0]["overlays"],
		});

		expect(settings.overlays.hikingNodes).toBe(false);
		expect(settings.overlays.cyclingNodes).toBe(false);
	});
});
