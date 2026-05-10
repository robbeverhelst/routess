import { normalizeRedesignSettings } from "@/stores/redesignSettingsStore";

describe("redesignSettingsStore", () => {
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
});
