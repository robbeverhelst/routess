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
			"bicycle",
		);
		const second = buildSurfaceBreakdownKey(
			[
				[4.3517, 50.8503],
				[4.37, 50.95],
				[4.4025, 51.2194],
			],
			true,
			"bicycle",
		);

		expect(first).not.toBe(second);
	});

	it("changes when the costing mode changes and clears when disabled", () => {
		const bicycle = buildSurfaceBreakdownKey(
			[
				[4.3517, 50.8503],
				[4.4025, 51.2194],
			],
			true,
			"bicycle",
		);
		const auto = buildSurfaceBreakdownKey(
			[
				[4.3517, 50.8503],
				[4.4025, 51.2194],
			],
			true,
			"auto",
		);

		expect(bicycle).not.toBe(auto);
		expect(buildSurfaceBreakdownKey([[4.3517, 50.8503]], false, "bicycle")).toBe("");
	});
});
