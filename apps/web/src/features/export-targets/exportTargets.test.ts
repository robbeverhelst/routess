import { describe, expect, it } from "bun:test";

import {
	type ExportTarget,
	type ExportTargetId,
	getEnabledExportTargets,
	parseExportTargetsFlag,
} from "./exportTargets";

function fakeTarget(id: ExportTargetId): ExportTarget {
	return { id, displayName: id, send: async () => ({}) };
}

describe("parseExportTargetsFlag", () => {
	it("is off when unset or empty", () => {
		expect(parseExportTargetsFlag(undefined)).toEqual([]);
		expect(parseExportTargetsFlag("")).toEqual([]);
	});

	it("parses a comma list, trimming, lowercasing and deduplicating", () => {
		expect(parseExportTargetsFlag(" Garmin, strava ,garmin")).toEqual(["garmin", "strava"]);
	});

	it("drops unknown ids", () => {
		expect(parseExportTargetsFlag("garmin,komoot")).toEqual(["garmin"]);
	});
});

describe("getEnabledExportTargets", () => {
	const registry = new Map<ExportTargetId, ExportTarget>([["garmin", fakeTarget("garmin")]]);

	it("returns nothing when the flag is off, even with adapters", () => {
		expect(getEnabledExportTargets(undefined, registry)).toEqual([]);
	});

	it("returns only flagged targets that have an adapter", () => {
		expect(getEnabledExportTargets("garmin,strava", registry).map((t) => t.id)).toEqual(["garmin"]);
	});

	it("returns nothing by default: no adapters are registered yet", () => {
		expect(getEnabledExportTargets("garmin,strava")).toEqual([]);
	});
});
