import type { Coordinate } from "@routess/core";
import { describe, expect, it } from "vitest";
import { computeGainLoss, ElevationService } from "./ElevationService";
import type { ElevationProvider } from "./types";

class StaticProvider implements ElevationProvider {
	constructor(private readonly elevations: (number | null)[]) {}
	async sample(points: Coordinate[]): Promise<(number | null)[]> {
		// Repeat or truncate to match requested length so densification can
		// pick whatever sample count it likes.
		return points.map((_, i) => this.elevations[i % this.elevations.length] ?? null);
	}
}

class RecordingProvider implements ElevationProvider {
	calls: Coordinate[][] = [];
	constructor(private readonly fn: (points: Coordinate[]) => (number | null)[]) {}
	async sample(points: Coordinate[]): Promise<(number | null)[]> {
		this.calls.push(points);
		return this.fn(points);
	}
}

// Two points ~1.1 km apart along the equator-ish, enough to densify into
// many samples at the default 50 m spacing.
const longLine: Coordinate[] = [
	[0, 0],
	[0.01, 0],
];

describe("computeGainLoss", () => {
	it("sums positive deltas as gain", () => {
		const r = computeGainLoss([100, 110, 130, 130]);
		expect(r.gainMeters).toBe(30);
		expect(r.lossMeters).toBe(0);
	});

	it("sums negative deltas as loss", () => {
		const r = computeGainLoss([200, 180, 170]);
		expect(r.gainMeters).toBe(0);
		expect(r.lossMeters).toBe(30);
	});

	it("ignores sub-threshold jitter", () => {
		// Each step is 1 m, below the 1.5 m noise threshold, so neither gain
		// nor loss should accumulate.
		const r = computeGainLoss([100, 101, 100, 101, 100]);
		expect(r.gainMeters).toBe(0);
		expect(r.lossMeters).toBe(0);
	});

	it("handles mixed up/down profile", () => {
		const r = computeGainLoss([100, 150, 120, 180, 160]);
		// Above threshold: +50, -30, +60, -20
		expect(r.gainMeters).toBe(110);
		expect(r.lossMeters).toBe(50);
	});

	it("returns zero on empty/short input", () => {
		expect(computeGainLoss([])).toEqual({ gainMeters: 0, lossMeters: 0 });
		expect(computeGainLoss([100])).toEqual({ gainMeters: 0, lossMeters: 0 });
	});
});

describe("ElevationService.sampleAndCompute", () => {
	it("returns zero metrics for paths shorter than 2 points", async () => {
		const svc = new ElevationService(new StaticProvider([100]));
		const r = await svc.sampleAndCompute([[0, 0]]);
		expect(r).toEqual({ gainMeters: 0, lossMeters: 0, profile: [] });
	});

	it("computes monotonic gain on an ascending profile", async () => {
		// Provider returns ele = 100, 110, 120, ... per sample.
		const provider = new RecordingProvider((points) => points.map((_, i) => 100 + i * 10));
		const svc = new ElevationService(provider);
		const r = await svc.sampleAndCompute(longLine, { smoothingWindow: 1 });
		expect(r.profile.length).toBeGreaterThan(2);
		expect(r.gainMeters).toBeGreaterThan(0);
		expect(r.lossMeters).toBe(0);
		// First profile point starts at distance 0; last equals total length.
		expect(r.profile[0].distanceMeters).toBe(0);
		expect(r.profile[r.profile.length - 1].distanceMeters).toBeGreaterThan(1000);
	});

	it("interpolates null samples instead of treating them as 0 m", async () => {
		// Half the samples come back null — without interpolation we'd see
		// huge spurious deltas dropping to 0 and back up.
		const provider = new RecordingProvider((points) => points.map((_, i) => (i % 2 === 0 ? 200 : null)));
		const svc = new ElevationService(provider);
		const r = await svc.sampleAndCompute(longLine, { smoothingWindow: 1 });
		// All 200 → no gain, no loss.
		expect(r.gainMeters).toBe(0);
		expect(r.lossMeters).toBe(0);
	});

	it("caches results for identical paths", async () => {
		const provider = new RecordingProvider((points) => points.map(() => 150));
		const svc = new ElevationService(provider);
		await svc.sampleAndCompute(longLine);
		await svc.sampleAndCompute(longLine);
		expect(provider.calls.length).toBe(1);
	});

	it("respects maxSamples cap", async () => {
		const provider = new RecordingProvider((points) => points.map(() => 100));
		const svc = new ElevationService(provider);
		await svc.sampleAndCompute(longLine, { maxSamples: 8, smoothingWindow: 1 });
		expect(provider.calls[0].length).toBeLessThanOrEqual(8);
	});
});
