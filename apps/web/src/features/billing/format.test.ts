import { describe, expect, it } from "bun:test";
import { daysLeft } from "./format";

describe("daysLeft", () => {
	const now = new Date("2026-10-11T12:00:00Z");

	it("counts a started day as a day", () => {
		expect(daysLeft("2027-10-11T11:00:00Z", now)).toBe(365);
		expect(daysLeft("2026-10-11T12:00:01Z", now)).toBe(1);
	});

	it("is 0 once Pro ended", () => {
		expect(daysLeft("2026-10-11T12:00:00Z", now)).toBe(0);
		expect(daysLeft("2026-09-01T00:00:00Z", now)).toBe(0);
	});
});
