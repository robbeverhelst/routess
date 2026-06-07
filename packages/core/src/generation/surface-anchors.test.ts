import { describe, expect, it } from "bun:test";
import type { Coordinate } from "../types";
import { haversineDistance } from "../utils/geospatial";
import { destinationPoint } from "./fan";
import { collectSurfaceAnchors, planSurfaceAnchoredCandidates, type SurfaceAnchor } from "./surface-anchors";
import type { CandidateEdge } from "./types";

const GHENT: Coordinate = [3.7174, 51.0543];

const edge = (surface: string, lengthKm: number, midpoint?: Coordinate): CandidateEdge => ({
	surface,
	lengthKm,
	midpoint,
});

const at = (bearing: number, km: number) => destinationPoint(GHENT, bearing, km);

describe("collectSurfaceAnchors", () => {
	it("collapses a matching run into one anchor at its halfway edge", () => {
		const edges = [
			edge("paved", 2, at(90, 2)),
			edge("gravel", 1, at(90, 3.5)),
			edge("dirt", 1, at(90, 4.5)),
			edge("gravel", 1, at(90, 5.5)),
			edge("paved", 2, at(90, 7)),
		];
		const anchors = collectSurfaceAnchors([{ edges }], "unpaved", GHENT, 30);
		expect(anchors).toHaveLength(1);
		expect(anchors[0].lengthKm).toBe(3);
		expect(haversineDistance(anchors[0].point, at(90, 4.5))).toBeLessThan(0.01);
	});

	it("drops runs shorter than the minimum", () => {
		const edges = [edge("paved", 5, at(90, 2)), edge("gravel", 0.2, at(90, 4)), edge("paved", 5, at(90, 6))];
		expect(collectSurfaceAnchors([{ edges }], "unpaved", GHENT, 30)).toHaveLength(0);
	});

	it("ignores matching edges without a midpoint", () => {
		const edges = [edge("gravel", 2, undefined)];
		expect(collectSurfaceAnchors([{ edges }], "unpaved", GHENT, 30)).toHaveLength(0);
	});

	it("dedupes runs from different candidates at the same place, keeping the longest", () => {
		const a = [edge("gravel", 3, at(90, 4))];
		const b = [edge("gravel", 2, at(90, 4.1))];
		const anchors = collectSurfaceAnchors([{ edges: a }, { edges: b }], "unpaved", GHENT, 30);
		expect(anchors).toHaveLength(1);
		expect(anchors[0].lengthKm).toBe(3);
	});

	it("filters runs the loop cannot plausibly visit (too close or too far)", () => {
		const edges = [edge("gravel", 1, at(90, 0.2)), edge("paved", 1, at(90, 1)), edge("gravel", 1, at(90, 15))];
		expect(collectSurfaceAnchors([{ edges }], "unpaved", GHENT, 30)).toHaveLength(0);
	});

	it("returns anchors longest-first", () => {
		const edges = [
			edge("gravel", 1, at(0, 4)),
			edge("paved", 1, at(45, 4)),
			edge("gravel", 3, at(90, 4)),
			edge("paved", 1, at(135, 4)),
			edge("gravel", 2, at(180, 4)),
		];
		const anchors = collectSurfaceAnchors([{ edges }], "unpaved", GHENT, 30);
		expect(anchors.map((a) => a.lengthKm)).toEqual([3, 2, 1]);
	});
});

describe("planSurfaceAnchoredCandidates", () => {
	const anchor = (bearing: number, km: number, lengthKm: number): SurfaceAnchor => ({
		point: at(bearing, km),
		lengthKm,
	});

	it("returns nothing without anchors", () => {
		expect(planSurfaceAnchoredCandidates(GHENT, [], 30)).toEqual([]);
	});

	it("plans a single-via loop from one anchor", () => {
		const plans = planSurfaceAnchoredCandidates(GHENT, [anchor(90, 4, 2)], 30);
		expect(plans).toHaveLength(1);
		expect(plans[0].viaPoints).toHaveLength(1);
		expect(plans[0].bearingDeg).toBeCloseTo(90, 0);
	});

	it("admits anchors longest-first while the chord perimeter fits the budget", () => {
		const plans = planSurfaceAnchoredCandidates(GHENT, [anchor(90, 4, 5), anchor(0, 4, 3), anchor(270, 20, 2)], 30);
		// The 20km-west anchor would blow the 30km loop's chord budget.
		expect(plans[0].viaPoints).toHaveLength(2);
		for (const via of plans[0].viaPoints) {
			expect(haversineDistance(GHENT, via)).toBeLessThan(5);
		}
	});

	it("returns a descending-via-count cascade for fallback routing", () => {
		const many = [0, 30, 60, 90, 120, 150, 180].map((b) => anchor(b, 3, 2));
		const plans = planSurfaceAnchoredCandidates(GHENT, many, 80);
		const counts = plans.map((p) => p.viaPoints.length);
		// Strictly descending, ending at a single via.
		for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThan(counts[i - 1]);
		expect(counts[counts.length - 1]).toBe(1);
	});

	it("orders vias in loop-visiting order around the centroid", () => {
		const plans = planSurfaceAnchoredCandidates(GHENT, [anchor(90, 4, 3), anchor(180, 4, 2), anchor(0, 4, 1)], 40);
		expect(plans[0].viaPoints).toHaveLength(3);
		// East must sit between north and south in the visiting sequence.
		const bearings = plans[0].viaPoints.map((via) => {
			const [lon, lat] = via;
			return Math.atan2(lon - GHENT[0], lat - GHENT[1]);
		});
		const eastIndex = bearings.findIndex((b) => Math.abs(b - Math.PI / 2) < 0.2);
		expect(eastIndex).toBe(1);
	});
});
