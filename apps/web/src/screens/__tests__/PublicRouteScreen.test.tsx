import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const route = {
	id: 123,
	name: "Sunday Loop",
	description: "A scenic loop",
	distance: 3500,
	duration: 1200,
	elevationGain: 25,
	visibility: "public",
	tags: ["hilly", "scenic"],
	waypoints: [{ coord: [0, 0] }, { coord: [1, 1] }],
	geometry: [
		[0, 0],
		[1, 1],
		[2, 2],
	],
	user: { name: "Alice" },
};

vi.mock("@/lib/api-queries", () => ({
	useRoute: () => ({ data: route, isLoading: false, isError: false }),
}));
vi.mock("@/lib/api", () => ({
	apiService: { routeGpxUrl: (id: number) => `https://api.test/api/v1/routes/${id}/gpx` },
}));
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));
vi.mock("@/lib/logger", () => ({ Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/utils/mapboxStaticPreview", () => ({
	buildMapboxStaticPreviewUrl: () => "https://maps.test/preview.png",
}));
vi.mock("@/lib/units", () => ({
	useUnits: () => ({
		formatDistanceParts: (km: number) => ({ value: km.toFixed(1), unit: "km" }),
		formatElevationParts: (m: number) => ({ value: String(Math.round(m)), unit: "m" }),
	}),
}));

import { PublicRouteScreen } from "../PublicRouteScreen";

describe("PublicRouteScreen", () => {
	it("renders the route name, stats, tags, preview and a resolved GPX link", () => {
		const { container } = render(<PublicRouteScreen slug="sunday-loop" routeId={123} />);

		// name + description
		expect(screen.getByRole("heading", { level: 1, name: "Sunday Loop" })).toBeTruthy();
		expect(screen.getByText("A scenic loop")).toBeTruthy();

		// map preview image
		const img = screen.getByRole("img") as HTMLImageElement;
		expect(img.src).toBe("https://maps.test/preview.png");

		// distance stat (3500 m -> 3.5 km)
		expect(screen.getByText("3.5")).toBeTruthy();

		// tags rendered as chips
		expect(screen.getByText("#hilly")).toBeTruthy();
		expect(screen.getByText("#scenic")).toBeTruthy();

		// GPX link resolves via the ApiClient helper, not a bare relative path
		const gpxLink = container.querySelector('a[href="https://api.test/api/v1/routes/123/gpx"]');
		expect(gpxLink).not.toBeNull();

		// canonical title written to the document
		expect(document.title).toContain("Sunday Loop");
		expect(document.title).toContain("routess");
	});
});
