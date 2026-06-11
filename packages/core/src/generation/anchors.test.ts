import { describe, expect, it } from "bun:test";
import type { Coordinate } from "../types";
import { haversineDistance } from "../utils/geospatial";
import { anchoredViaFraction, anchorSnapRadiusKm, injectRequiredAnchors, snapViasToAnchors } from "./anchors";
import { destinationPoint, planCandidate } from "./fan";
import type { GenerationAnchor } from "./types";

const GHENT: Coordinate = [3.7174, 51.0543];

const anchorAt = (coordinate: Coordinate, ref?: string): GenerationAnchor => ({ coordinate, ref });

describe("anchorSnapRadiusKm", () => {
	it("scales with the loop radius and stays within bounds", () => {
		expect(anchorSnapRadiusKm(2)).toBe(0.5);
		expect(anchorSnapRadiusKm(40)).toBeGreaterThan(0.5);
		expect(anchorSnapRadiusKm(40)).toBeLessThan(5);
		expect(anchorSnapRadiusKm(500)).toBe(5);
	});
});

describe("snapViasToAnchors", () => {
	it("moves a via onto the nearest in-range anchor and records it", () => {
		const plan = planCandidate(GHENT, 90, 40);
		const near = anchorAt(destinationPoint(plan.viaPoints[0], 45, 0.3), "45");
		const far = anchorAt(destinationPoint(plan.viaPoints[0], 45, 30), "99");

		const snapped = snapViasToAnchors(plan, [far, near], 1);
		expect(snapped.viaPoints[0]).toEqual(near.coordinate);
		expect(snapped.viaAnchors?.[0]?.ref).toBe("45");
		expect(snapped.viaPoints[1]).toEqual(plan.viaPoints[1]);
		expect(snapped.viaAnchors?.[1]).toBeUndefined();
	});

	it("never assigns two vias to the same anchor", () => {
		const plan = planCandidate(GHENT, 90, 10);
		const between: Coordinate = [
			(plan.viaPoints[0][0] + plan.viaPoints[1][0]) / 2,
			(plan.viaPoints[0][1] + plan.viaPoints[1][1]) / 2,
		];
		const snapped = snapViasToAnchors(plan, [anchorAt(between, "7")], 50);
		const anchored = (snapped.viaAnchors ?? []).filter(Boolean);
		expect(anchored).toHaveLength(1);
	});

	it("returns the plan unchanged when no anchor is in range", () => {
		const plan = planCandidate(GHENT, 90, 40);
		const far = anchorAt(destinationPoint(GHENT, 180, 100), "1");
		expect(snapViasToAnchors(plan, [far], 1)).toBe(plan);
	});

	it("returns the plan unchanged for an empty pool", () => {
		const plan = planCandidate(GHENT, 90, 40);
		expect(snapViasToAnchors(plan, [], 1)).toBe(plan);
	});
});

describe("injectRequiredAnchors", () => {
	it("inserts the anchor at the least-detour position in the loop", () => {
		const plan = planCandidate(GHENT, 90, 40);
		// Just off the segment between via 0 and via 1: insertion belongs there.
		const between: Coordinate = [
			(plan.viaPoints[0][0] + plan.viaPoints[1][0]) / 2,
			(plan.viaPoints[0][1] + plan.viaPoints[1][1]) / 2,
		];
		const anchor: GenerationAnchor = { coordinate: between, name: "Kasteel", required: true };

		const injected = injectRequiredAnchors(plan, [anchor], GHENT);
		expect(injected.viaPoints).toHaveLength(plan.viaPoints.length + 1);
		expect(injected.viaPoints[1]).toEqual(between);
		expect(injected.viaAnchors?.[1]?.name).toBe("Kasteel");
	});

	it("keeps existing anchor metadata aligned after insertion", () => {
		const plan = planCandidate(GHENT, 90, 40);
		const nodeAnchor = anchorAt(destinationPoint(plan.viaPoints[2], 0, 0.1), "52");
		const snapped = snapViasToAnchors(plan, [nodeAnchor], 1);

		const poi: GenerationAnchor = {
			coordinate: destinationPoint(GHENT, 90, 1),
			name: "Cafe",
			required: true,
		};
		const injected = injectRequiredAnchors(snapped, [poi], GHENT);
		const refIndex = injected.viaAnchors?.findIndex((a) => a?.ref === "52");
		expect(refIndex).toBeGreaterThanOrEqual(0);
		expect(injected.viaPoints[refIndex as number]).toEqual(nodeAnchor.coordinate);
	});

	it("adds no detour beyond the crow-flies minimum for its slot", () => {
		const plan = planCandidate(GHENT, 90, 40);
		const anchor: GenerationAnchor = { coordinate: destinationPoint(GHENT, 90, 2), required: true };
		const injected = injectRequiredAnchors(plan, [anchor], GHENT);

		const tour = (vias: Coordinate[]) => {
			const cycle = [GHENT, ...vias, GHENT];
			let km = 0;
			for (let i = 0; i < cycle.length - 1; i++) km += haversineDistance(cycle[i], cycle[i + 1]);
			return km;
		};
		// Inserting anywhere else must not beat the chosen slot.
		const chosen = tour(injected.viaPoints);
		for (let i = 0; i <= plan.viaPoints.length; i++) {
			const alternative = [...plan.viaPoints.slice(0, i), anchor.coordinate, ...plan.viaPoints.slice(i)];
			expect(chosen).toBeLessThanOrEqual(tour(alternative) + 1e-9);
		}
	});
});

describe("anchoredViaFraction", () => {
	it("counts only vias carrying a Node ref", () => {
		const plan = planCandidate(GHENT, 90, 40);
		expect(anchoredViaFraction(plan)).toBe(0);

		const near = anchorAt(destinationPoint(plan.viaPoints[0], 45, 0.2), "45");
		const snapped = snapViasToAnchors(plan, [near], 1);
		expect(anchoredViaFraction(snapped)).toBeCloseTo(1 / 3);
	});
});
