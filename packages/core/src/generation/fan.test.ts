import { describe, expect, it } from "bun:test";
import type { Coordinate } from "../types";
import { calculatePathDistance, haversineDistance } from "../utils/geospatial";
import {
	bearingsForHeading,
	CIRCUITY_FACTOR,
	destinationPoint,
	loopRadiusKm,
	normalizeBearing,
	planCandidate,
	planCandidateFan,
	refinePlanForDistance,
	VIA_POINT_COUNT,
} from "./fan";

const GHENT: Coordinate = [3.7174, 51.0543];

describe("normalizeBearing", () => {
	it("wraps negative and >360 values into 0..360", () => {
		expect(normalizeBearing(-45)).toBe(315);
		expect(normalizeBearing(405)).toBe(45);
		expect(normalizeBearing(0)).toBe(0);
		expect(normalizeBearing(360)).toBe(0);
	});
});

describe("destinationPoint", () => {
	it("travels the requested distance", () => {
		const dest = destinationPoint(GHENT, 90, 10);
		expect(haversineDistance(GHENT, dest)).toBeCloseTo(10, 1);
	});

	it("heads in the requested direction", () => {
		const north = destinationPoint(GHENT, 0, 10);
		expect(north[1]).toBeGreaterThan(GHENT[1]);
		expect(north[0]).toBeCloseTo(GHENT[0], 3);

		const east = destinationPoint(GHENT, 90, 10);
		expect(east[0]).toBeGreaterThan(GHENT[0]);
		expect(east[1]).toBeCloseTo(GHENT[1], 3);
	});
});

describe("bearingsForHeading", () => {
	it("sweeps the full circle for any", () => {
		expect(bearingsForHeading("any")).toHaveLength(8);
	});

	it("restricts to a ±45° arc for a compass heading", () => {
		expect(bearingsForHeading("north")).toEqual([315, 337.5, 0, 22.5, 45]);
		expect(bearingsForHeading("east")).toEqual([45, 67.5, 90, 112.5, 135]);
		expect(bearingsForHeading("south")).toEqual([135, 157.5, 180, 202.5, 225]);
		expect(bearingsForHeading("west")).toEqual([225, 247.5, 270, 292.5, 315]);
	});
});

describe("planCandidate", () => {
	it("places via points whose chord loop approximates the target distance", () => {
		const target = 40;
		const plan = planCandidate(GHENT, 0, target);
		expect(plan.viaPoints).toHaveLength(VIA_POINT_COUNT);

		const loop = [GHENT, ...plan.viaPoints, GHENT];
		const chordKm = calculatePathDistance(loop);
		// Chord perimeter × circuity should land on the target.
		expect(chordKm * CIRCUITY_FACTOR).toBeCloseTo(target, 0);
	});

	it("keeps every via point within the loop diameter of the start", () => {
		const target = 40;
		const radius = loopRadiusKm(target);
		const plan = planCandidate(GHENT, 90, target);
		for (const via of plan.viaPoints) {
			expect(haversineDistance(GHENT, via)).toBeLessThanOrEqual(2 * radius + 0.05);
			expect(haversineDistance(GHENT, via)).toBeGreaterThan(0.1);
		}
	});

	it("bulges toward the requested bearing", () => {
		const east = planCandidate(GHENT, 90, 30);
		for (const via of east.viaPoints) {
			expect(via[0]).toBeGreaterThan(GHENT[0]);
		}
	});
});

describe("planCandidateFan", () => {
	it("produces one plan per bearing", () => {
		expect(planCandidateFan(GHENT, "any", 30)).toHaveLength(8);
		expect(planCandidateFan(GHENT, "north", 30)).toHaveLength(5);
	});

	it("excludes already-shown bearings", () => {
		const fan = planCandidateFan(GHENT, "any", 30, [0, 45, 90]);
		expect(fan).toHaveLength(5);
		expect(fan.map((p) => p.bearingDeg)).not.toContain(45);
	});
});

describe("refinePlanForDistance", () => {
	it("returns null when the routed distance is close enough", () => {
		const plan = planCandidate(GHENT, 0, 40);
		expect(refinePlanForDistance(GHENT, plan, 40, 44)).toBeNull();
	});

	it("shrinks the circle when the routed loop overshot", () => {
		const plan = planCandidate(GHENT, 0, 40);
		const refined = refinePlanForDistance(GHENT, plan, 40, 60);
		expect(refined).not.toBeNull();
		const original = calculatePathDistance([GHENT, ...plan.viaPoints, GHENT]);
		const shrunk = calculatePathDistance([GHENT, ...(refined?.viaPoints ?? []), GHENT]);
		expect(shrunk).toBeLessThan(original);
		expect(refined?.bearingDeg).toBe(0);
	});

	it("grows the circle when the routed loop undershot", () => {
		const plan = planCandidate(GHENT, 0, 40);
		const refined = refinePlanForDistance(GHENT, plan, 40, 25);
		expect(refined).not.toBeNull();
		const original = calculatePathDistance([GHENT, ...plan.viaPoints, GHENT]);
		const grown = calculatePathDistance([GHENT, ...(refined?.viaPoints ?? []), GHENT]);
		expect(grown).toBeGreaterThan(original);
	});
});
