import { describe, expect, it } from "bun:test";
import type { Coordinate } from "../types";
import { decodePolyline6, encodePolyline6 } from "./polyline6";

describe("polyline6 codec", () => {
	it("round-trips coordinates at 1e6 precision", () => {
		const coords: Coordinate[] = [
			[3.7174, 51.0543],
			[3.7251, 51.0601],
			[3.7048, 51.0712],
			[-0.1276, 51.5072],
		];
		const decoded = decodePolyline6(encodePolyline6(coords));
		expect(decoded).toHaveLength(coords.length);
		for (let i = 0; i < coords.length; i++) {
			expect(decoded[i][0]).toBeCloseTo(coords[i][0], 6);
			expect(decoded[i][1]).toBeCloseTo(coords[i][1], 6);
		}
	});

	it("handles empty input", () => {
		expect(encodePolyline6([])).toBe("");
		expect(decodePolyline6("")).toEqual([]);
	});
});
