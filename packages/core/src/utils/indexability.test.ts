import { describe, expect, it } from "bun:test";
import { isRouteIndexable } from "./indexability";

const base = {
	visibility: "public" as const,
	name: "Kastelenroute Gent",
	distance: 45_000,
	description: "A long loop past three castles south of Ghent.",
	tags: ["gravel"],
};

describe("isRouteIndexable", () => {
	it("accepts a named public route with distance and description", () => {
		expect(isRouteIndexable(base)).toBe(true);
	});

	it("rejects unlisted and private regardless of quality", () => {
		expect(isRouteIndexable({ ...base, visibility: "unlisted" })).toBe(false);
		expect(isRouteIndexable({ ...base, visibility: "private" })).toBe(false);
	});

	it("rejects untitled and too-short names", () => {
		expect(isRouteIndexable({ ...base, name: "Untitled route" })).toBe(false);
		expect(isRouteIndexable({ ...base, name: "Naamloos" })).toBe(false);
		expect(isRouteIndexable({ ...base, name: "ab" })).toBe(false);
	});

	it("rejects routes under the distance floor", () => {
		expect(isRouteIndexable({ ...base, distance: 999 })).toBe(false);
		expect(isRouteIndexable({ ...base, distance: undefined })).toBe(false);
	});

	it("requires a real description or at least one tag", () => {
		expect(isRouteIndexable({ ...base, description: "", tags: [] })).toBe(false);
		expect(isRouteIndexable({ ...base, description: "short", tags: [] })).toBe(false);
		expect(isRouteIndexable({ ...base, description: "", tags: ["gravel"] })).toBe(true);
		expect(isRouteIndexable({ ...base, description: "A genuinely descriptive sentence here.", tags: [] })).toBe(true);
	});
});
