import { generationSeries } from "../../../src/admin/admin.service";

describe("generationSeries", () => {
	const now = new Date("2026-10-11T15:00:00Z");

	it("fills every UTC day in the window, oldest first, with zeros", () => {
		const series = generationSeries([], 3, now);
		expect(series).toEqual([
			{ date: "2026-10-09", started: 0, succeeded: 0, failed: 0 },
			{ date: "2026-10-10", started: 0, succeeded: 0, failed: 0 },
			{ date: "2026-10-11", started: 0, succeeded: 0, failed: 0 },
		]);
	});

	it("routes each ProductEvent count to its column and drops days outside the window", () => {
		const series = generationSeries(
			[
				{ date: "2026-10-11", eventName: "route_generation_started", count: 5 },
				{ date: "2026-10-11", eventName: "route_generation_succeeded", count: 4 },
				{ date: "2026-10-11", eventName: "route_generation_failed", count: 1 },
				{ date: "2026-10-10", eventName: "route_generation_started", count: 2 },
				{ date: "2026-10-01", eventName: "route_generation_started", count: 99 },
				{ date: "2026-10-11", eventName: "route_created", count: 7 },
			],
			2,
			now,
		);
		expect(series).toEqual([
			{ date: "2026-10-10", started: 2, succeeded: 0, failed: 0 },
			{ date: "2026-10-11", started: 5, succeeded: 4, failed: 1 },
		]);
	});
});
