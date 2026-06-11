import { describe, expect, it } from "bun:test";
import type { Coordinate } from "../types";
import { calculateBearing, haversineDistance } from "../utils/geospatial";
import { destinationPoint } from "./fan";
import { isochroneContourKm, planIsochroneCandidates } from "./isochrone";

const OSTEND: Coordinate = [2.9201, 51.2154];

/** A frontier ring covering only the given bearing arc (a coastal start). */
const frontierArc = (fromDeg: number, toDeg: number, radiusKm: number): Coordinate[] => {
	const ring: Coordinate[] = [];
	for (let deg = fromDeg; deg <= toDeg; deg += 5) {
		ring.push(destinationPoint(OSTEND, deg, radiusKm));
	}
	return ring;
};

describe("isochroneContourKm", () => {
	it("sizes the contour well below half the target", () => {
		expect(isochroneContourKm(40)).toBeCloseTo(40 / 2.6);
	});
});

describe("planIsochroneCandidates", () => {
	it("places two distinct vias on the frontier per usable bearing", () => {
		const frontier = frontierArc(0, 355, 10);
		const plans = planIsochroneCandidates(OSTEND, frontier, "any");
		expect(plans.length).toBeGreaterThanOrEqual(6);
		for (const plan of plans) {
			expect(plan.viaPoints).toHaveLength(2);
			for (const via of plan.viaPoints) {
				expect(haversineDistance(OSTEND, via)).toBeCloseTo(10, 0);
			}
			expect(haversineDistance(plan.viaPoints[0], plan.viaPoints[1])).toBeGreaterThan(0.2);
		}
	});

	it("skips bearings the frontier never extends toward (the sea side)", () => {
		// Land only to the south: frontier covers 90°..270°.
		const frontier = frontierArc(90, 270, 10);
		const plans = planIsochroneCandidates(OSTEND, frontier, "any");
		expect(plans.length).toBeGreaterThan(0);
		for (const plan of plans) {
			for (const via of plan.viaPoints) {
				const bearing = calculateBearing(OSTEND, via);
				expect(bearing).toBeGreaterThanOrEqual(60);
				expect(bearing).toBeLessThanOrEqual(300);
			}
		}
	});

	it("respects heading and excluded bearings", () => {
		const frontier = frontierArc(0, 355, 10);
		const south = planIsochroneCandidates(OSTEND, frontier, "south");
		expect(south.length).toBeGreaterThan(0);
		for (const plan of south) {
			expect(plan.bearingDeg).toBeGreaterThanOrEqual(135);
			expect(plan.bearingDeg).toBeLessThanOrEqual(225);
		}

		const excluded = planIsochroneCandidates(OSTEND, frontier, "any", [0, 45, 90, 135, 180, 225, 270, 315]);
		expect(excluded).toEqual([]);
	});

	it("returns nothing for a degenerate frontier", () => {
		expect(planIsochroneCandidates(OSTEND, [], "any")).toEqual([]);
		expect(planIsochroneCandidates(OSTEND, [OSTEND, OSTEND], "any")).toEqual([]);
	});
});
