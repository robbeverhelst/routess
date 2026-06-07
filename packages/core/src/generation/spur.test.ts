import { describe, expect, it } from "bun:test";
import type { Coordinate } from "../types";
import { destinationPoint } from "./fan";
import { detectSpurVias, repairSpurVias } from "./spur";

const GHENT: Coordinate = [3.7174, 51.0543];

// A clean ~12.5km circular loop sampled every ~110m.
function circle(radiusKm = 2): Coordinate[] {
	const points: Coordinate[] = [];
	for (let deg = 0; deg <= 360; deg += 1) {
		points.push(destinationPoint(GHENT, deg, radiusKm));
	}
	return points;
}

// Insert an out-and-back spur of `lengthKm` perpendicular to the loop at the
// given angle: out along a line, back over the same points.
function withSpur(loop: Coordinate[], atIndex: number, lengthKm: number): { geometry: Coordinate[]; tip: Coordinate } {
	const junction = loop[atIndex];
	const out: Coordinate[] = [];
	const steps = Math.max(2, Math.round(lengthKm / 0.05));
	for (let s = 1; s <= steps; s++) {
		out.push(destinationPoint(junction, 45, (lengthKm * s) / steps));
	}
	const back = [...out].reverse().slice(1);
	const geometry = [...loop.slice(0, atIndex + 1), ...out, ...back, junction, ...loop.slice(atIndex + 1)];
	return { geometry, tip: out[out.length - 1] };
}

describe("detectSpurVias", () => {
	it("finds nothing on a clean loop", () => {
		const loop = circle();
		const vias = [loop[90], loop[180], loop[270]];
		expect(detectSpurVias(loop, vias, 12)).toEqual([]);
	});

	it("detects a via sitting at the tip of an out-and-back spur", () => {
		const loop = circle();
		const { geometry, tip } = withSpur(loop, 90, 0.5);
		const vias = [tip, loop[180], loop[270]];

		const repairs = detectSpurVias(geometry, vias, 12);
		expect(repairs).toHaveLength(1);
		expect(repairs[0].viaIndex).toBe(0);
		expect(repairs[0].excursionKm).toBeGreaterThan(0.8);
		// The junction lands where the spur meets the loop.
		const junction = repairs[0].junction;
		const dKm = Math.hypot((junction[0] - loop[90][0]) * 68, (junction[1] - loop[90][1]) * 111);
		expect(dKm).toBeLessThan(0.08);
	});

	it("does not flag the loop closure at the start point as a spur", () => {
		const loop = circle();
		// Via near the start/end seam of the loop.
		const vias = [loop[2], loop[120], loop[240]];
		expect(detectSpurVias(loop, vias, 12)).toEqual([]);
	});

	it("ignores excursions below the minimum length", () => {
		const loop = circle();
		const { geometry, tip } = withSpur(loop, 90, 0.08);
		const vias = [tip];
		expect(detectSpurVias(geometry, vias, 12)).toEqual([]);
	});
});

describe("repairSpurVias", () => {
	it("moves only the affected via", () => {
		const loop = circle();
		const { geometry, tip } = withSpur(loop, 90, 0.5);
		const untouched = loop[270];
		const result = repairSpurVias(geometry, [tip, untouched], 12);
		expect(result.movedCount).toBe(1);
		expect(result.viaPoints[1]).toEqual(untouched);
		expect(result.viaPoints[0]).not.toEqual(tip);
	});

	it("is a no-op on clean geometry", () => {
		const loop = circle();
		const vias = [loop[90], loop[270]];
		const result = repairSpurVias(loop, vias, 12);
		expect(result.movedCount).toBe(0);
		expect(result.viaPoints).toEqual(vias);
	});
});
