import type { Waypoint } from "@routess/core";
import pako from "pako";
import { decompressAndParse, serializeAndCompress } from "@/lib/shareUtils";

const encodeLegacyV0 = (w: [number, number][], f: boolean[], l?: boolean): string => {
	const data = { w, f, ...(l !== undefined ? { l } : {}) };
	const compressed = pako.deflate(JSON.stringify(data));
	let binary = "";
	compressed.forEach((byte) => {
		binary += String.fromCharCode(byte);
	});
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

describe("shareUtils", () => {
	it("round-trips shared route data through the v1 wire format", () => {
		const waypoints: Waypoint[] = [
			{ coord: [4.3517, 50.8503], type: "routed" },
			{ coord: [4.4025, 51.2194], type: "direct", name: "Antwerp" },
		];
		const encoded = serializeAndCompress(waypoints, true);

		expect(encoded).not.toBeNull();
		expect(decompressAndParse(encoded || "")).toEqual({ waypoints, isLocked: true });
	});

	it("decodes legacy v0 share links (boolean direct-flag array)", () => {
		const w: [number, number][] = [
			[4.3517, 50.8503],
			[4.4025, 51.2194],
		];
		const f = [false, true];
		const encoded = encodeLegacyV0(w, f, true);

		expect(decompressAndParse(encoded)).toEqual({
			waypoints: [
				{ coord: [4.3517, 50.8503], type: "routed" },
				{ coord: [4.4025, 51.2194], type: "direct" },
			],
			isLocked: true,
		});
	});

	it("returns null for invalid shared route data", () => {
		expect(decompressAndParse("definitely-not-valid")).toBeNull();
	});
});
