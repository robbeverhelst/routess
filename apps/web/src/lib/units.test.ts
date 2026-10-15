import { describe, expect, it } from "bun:test";
import {
	formatDistance,
	formatDistanceParts,
	formatDurationClockParts,
	formatElevation,
	formatPaceParts,
	formatSpeed,
} from "./units";

describe("formatDistanceParts", () => {
	it("shows metres under 1 km and km with two decimals above", () => {
		expect(formatDistanceParts(0.42, "km")).toEqual({ value: "420", unit: "m" });
		expect(formatDistanceParts(12.345, "km")).toEqual({ value: "12.35", unit: "km" });
	});

	it("shows feet under 0.1 mi and miles with two decimals above", () => {
		expect(formatDistanceParts(0.1, "mi")).toEqual({ value: "328", unit: "ft" });
		expect(formatDistanceParts(16.09344, "mi")).toEqual({ value: "10.00", unit: "mi" });
	});

	it("switches unit at the 1 km and 0.1 mi boundaries", () => {
		expect(formatDistanceParts(1, "km")).toEqual({ value: "1.00", unit: "km" });
		expect(formatDistanceParts(0.161, "mi")).toEqual({ value: "0.10", unit: "mi" });
	});
});

describe("formatDistance", () => {
	it("joins value and unit", () => {
		expect(formatDistance(5, "km")).toBe("5.00 km");
		expect(formatDistance(0.25, "km")).toBe("250 m");
	});
});

describe("formatSpeed", () => {
	it("formats km/h and mph to one decimal", () => {
		expect(formatSpeed(25, "km")).toBe("25.0 km/h");
		expect(formatSpeed(32.18688, "mi")).toBe("20.0 mph");
	});
});

describe("formatPaceParts", () => {
	it("turns a speed into minutes:seconds per km or mile", () => {
		expect(formatPaceParts(12, "km")).toEqual({ value: "5:00", unit: "/km" });
		expect(formatPaceParts(9.656064, "mi")).toEqual({ value: "10:00", unit: "/mi" });
	});

	it("pads seconds to two digits", () => {
		expect(formatPaceParts(11.5, "km")).toEqual({ value: "5:13", unit: "/km" });
	});

	it("returns null for zero, negative, non-finite and absurdly slow speeds", () => {
		expect(formatPaceParts(0, "km")).toBeNull();
		expect(formatPaceParts(-5, "km")).toBeNull();
		expect(formatPaceParts(Number.NaN, "km")).toBeNull();
		expect(formatPaceParts(Number.POSITIVE_INFINITY, "km")).toBeNull();
		expect(formatPaceParts(0.5, "km")).toBeNull();
	});
});

describe("formatDurationClockParts", () => {
	it("shows whole minutes under an hour", () => {
		expect(formatDurationClockParts(47 * 60)).toEqual({ value: "47", unit: "min" });
		expect(formatDurationClockParts(29)).toEqual({ value: "0", unit: "min" });
	});

	it("shows h:mm from an hour up", () => {
		expect(formatDurationClockParts(3600)).toEqual({ value: "1:00", unit: "h" });
		expect(formatDurationClockParts(66 * 60)).toEqual({ value: "1:06", unit: "h" });
	});

	it("rounds to the nearest minute before choosing the unit", () => {
		expect(formatDurationClockParts(59 * 60 + 31)).toEqual({ value: "1:00", unit: "h" });
	});
});

describe("formatElevation", () => {
	it("rounds metres, or converts to feet", () => {
		expect(formatElevation(123.6, "km")).toBe("124 m");
		expect(formatElevation(100, "mi")).toBe("328 ft");
	});
});
