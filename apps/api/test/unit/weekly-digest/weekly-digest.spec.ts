import type { PublicRouteSummaryDto } from "../../../src/routes/dto/public-route-summary.dto";
import { nextSentHistory, pickDigestRoutes, searchBoxAround } from "../../../src/weekly-digest/digest-picks";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "../../../src/weekly-digest/unsubscribe-token";

function summary(slugId: string, ownerId?: number): PublicRouteSummaryDto {
	return {
		id: 1,
		name: slugId,
		slugId,
		updatedAt: "2026-10-01T00:00:00Z",
		user: ownerId ? { id: ownerId, name: "x", handle: "x", idHash: "h" } : undefined,
	};
}

describe("unsubscribe token", () => {
	it("round-trips the user id", () => {
		expect(verifyUnsubscribeToken("s", createUnsubscribeToken("s", 42))).toBe(42);
	});

	it("rejects another secret, a swapped user id and garbage", () => {
		const token = createUnsubscribeToken("s", 42);
		expect(verifyUnsubscribeToken("other", token)).toBeNull();
		expect(verifyUnsubscribeToken("s", token.replace(/^42\./, "43."))).toBeNull();
		expect(verifyUnsubscribeToken("s", "42")).toBeNull();
		expect(verifyUnsubscribeToken("s", "")).toBeNull();
	});
});

describe("digest picks", () => {
	it("builds a minLng,minLat,maxLng,maxLat box around the area centre", () => {
		const [minLng, minLat, maxLng, maxLat] = searchBoxAround({ minLat: 51, maxLat: 51.1, minLng: 3.7, maxLng: 3.8 })
			.split(",")
			.map(Number);
		expect(minLat).toBeCloseTo(51.05 - 25 / 111, 3);
		expect(maxLat).toBeCloseTo(51.05 + 25 / 111, 3);
		expect(minLng).toBeLessThan(3.75);
		expect(maxLng).toBeGreaterThan(3.75);
	});

	it("stays within valid coordinates near the antimeridian and poles", () => {
		const [minLng, minLat, maxLng, maxLat] = searchBoxAround({
			minLat: 89.9,
			maxLat: 89.95,
			minLng: 179.9,
			maxLng: 180,
		})
			.split(",")
			.map(Number);
		expect(maxLng).toBeLessThanOrEqual(180);
		expect(maxLat).toBeLessThanOrEqual(90);
		expect(minLng).toBeGreaterThanOrEqual(-180);
		expect(minLat).toBeGreaterThanOrEqual(-90);
	});

	it("takes three, skipping the user's own routes and ones already sent", () => {
		const picks = pickDigestRoutes(
			[summary("own", 7), summary("old"), summary("a", 8), summary("b"), summary("c"), summary("d")],
			7,
			["old"],
		);
		expect(picks.map((p) => p.slugId)).toEqual(["a", "b", "c"]);
	});

	it("keeps the sent history bounded", () => {
		const previous = Array.from({ length: 30 }, (_, i) => `s${i}`);
		const next = nextSentHistory(previous, [summary("new")]);
		expect(next).toHaveLength(30);
		expect(next.at(-1)).toBe("new");
		expect(next[0]).toBe("s1");
	});
});
