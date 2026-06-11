import { describe, expect, it } from "bun:test";
import type { Coordinate } from "../types";
import { calculateBearing, calculatePathDistance, haversineDistance } from "../utils/geospatial";
import { corridorSanity, planAtoBCandidates, singleDetourOffsetKm } from "./corridor";
import { CIRCUITY_FACTOR, destinationPoint } from "./fan";

const GHENT: Coordinate = [3.7174, 51.0543];
const BRUGES: Coordinate = [3.2247, 51.2093];
const CORRIDOR_KM = haversineDistance(GHENT, BRUGES);

describe("planAtoBCandidates", () => {
	it("nudges quiet alternatives beside the direct plan when the target equals the shortest path", () => {
		const plans = planAtoBCandidates(GHENT, BRUGES, CORRIDOR_KM * CIRCUITY_FACTOR);
		expect(plans).toHaveLength(3);
		expect(plans[0].viaPoints).toEqual([]);
		// The nudged vias sit close to the corridor: a hair longer, much quieter.
		for (const plan of plans.slice(1)) {
			expect(plan.viaPoints).toHaveLength(1);
			const crow = calculatePathDistance([GHENT, ...plan.viaPoints, BRUGES]);
			expect(crow).toBeLessThan(CORRIDOR_KM * 1.05);
		}
	});

	it("spends the stretch budget: detour plans crow-fly near the target", () => {
		const target = CORRIDOR_KM * CIRCUITY_FACTOR * 1.8;
		const plans = planAtoBCandidates(GHENT, BRUGES, target);
		expect(plans.length).toBe(5);

		for (const plan of plans.filter((p) => p.viaPoints.length > 0)) {
			const crow = calculatePathDistance([GHENT, ...plan.viaPoints, BRUGES]);
			expect(crow * CIRCUITY_FACTOR).toBeGreaterThan(target * 0.85);
			expect(crow * CIRCUITY_FACTOR).toBeLessThan(target * 1.15);
		}
	});

	it("detours to both sides of the corridor", () => {
		const target = CORRIDOR_KM * CIRCUITY_FACTOR * 1.8;
		const plans = planAtoBCandidates(GHENT, BRUGES, target);
		const singles = plans.filter((p) => p.viaPoints.length === 1);
		expect(singles).toHaveLength(2);
		// One via lies on each side: their latitudes straddle the corridor.
		const corridorMidLat = (GHENT[1] + BRUGES[1]) / 2;
		const sides = singles.map((p) => Math.sign(p.viaPoints[0][1] - corridorMidLat));
		expect(new Set(sides).size).toBe(2);
	});

	it("respects exclude bearings for regenerate", () => {
		const target = CORRIDOR_KM * CIRCUITY_FACTOR * 1.8;
		const all = planAtoBCandidates(GHENT, BRUGES, target);
		const remaining = planAtoBCandidates(
			GHENT,
			BRUGES,
			target,
			all.map((p) => p.bearingDeg),
		);
		expect(remaining).toEqual([]);
	});

	it("returns nothing when start and end coincide", () => {
		expect(planAtoBCandidates(GHENT, GHENT, 30)).toEqual([]);
	});
});

describe("corridorSanity", () => {
	const target = CORRIDOR_KM * CIRCUITY_FACTOR * 1.5;

	it("accepts a path that stays within the justified detour", () => {
		const offset = singleDetourOffsetKm(CORRIDOR_KM, target);
		const heading = calculateBearing(GHENT, BRUGES);
		const midpoint = destinationPoint(GHENT, heading, CORRIDOR_KM / 2);
		const detour = [GHENT, destinationPoint(midpoint, heading + 90, offset), BRUGES];
		expect(corridorSanity(detour, GHENT, BRUGES, target)).toBe(1);
	});

	it("punishes a path that wanders far outside the corridor", () => {
		const faraway = destinationPoint(GHENT, 180, 60);
		const insane = [GHENT, faraway, BRUGES];
		expect(corridorSanity(insane, GHENT, BRUGES, target)).toBe(0);
	});

	it("scores the direct path as perfectly sane", () => {
		expect(corridorSanity([GHENT, BRUGES], GHENT, BRUGES, target)).toBe(1);
	});
});
