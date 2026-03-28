import { decompressAndParse, serializeAndCompress } from "@/lib/shareUtils";

describe("shareUtils", () => {
	it("round-trips shared route data", () => {
		const encoded = serializeAndCompress(
			[
				[4.3517, 50.8503],
				[4.4025, 51.2194],
			],
			[false, true],
			true,
		);

		expect(encoded).not.toBeNull();
		expect(decompressAndParse(encoded || "")).toEqual({
			w: [
				[4.3517, 50.8503],
				[4.4025, 51.2194],
			],
			f: [false, true],
			l: true,
		});
	});

	it("returns null for invalid shared route data", () => {
		expect(decompressAndParse("definitely-not-valid")).toBeNull();
	});
});
