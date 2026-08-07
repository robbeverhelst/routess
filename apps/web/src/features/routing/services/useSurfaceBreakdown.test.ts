import { buildSurfaceBreakdownKey } from "@/features/routing/services/useSurfaceBreakdown";

describe("buildSurfaceBreakdownKey", () => {
	it("changes when an interior route point changes", () => {
		const first = buildSurfaceBreakdownKey(
			[
				[4.3517, 50.8503],
				[4.36, 50.9],
				[4.4025, 51.2194],
			],
			true,
			"cycle",
		);
		const second = buildSurfaceBreakdownKey(
			[
				[4.3517, 50.8503],
				[4.37, 50.95],
				[4.4025, 51.2194],
			],
			true,
			"cycle",
		);

		expect(first).not.toBe(second);
	});

	it("changes when the activity changes and clears when disabled", () => {
		const cycle = buildSurfaceBreakdownKey(
			[
				[4.3517, 50.8503],
				[4.4025, 51.2194],
			],
			true,
			"cycle",
		);
		const walk = buildSurfaceBreakdownKey(
			[
				[4.3517, 50.8503],
				[4.4025, 51.2194],
			],
			true,
			"walk",
		);

		expect(cycle).not.toBe(walk);
		expect(buildSurfaceBreakdownKey([[4.3517, 50.8503]], false, "cycle")).toBe("");
	});
});
