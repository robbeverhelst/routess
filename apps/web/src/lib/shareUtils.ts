import type { Coordinate, Waypoint } from "@routess/core";
import { deflate, inflate } from "pako";
import { Logger } from "@/lib/logger";

// Wire format v1: canonical Waypoint[]. Compact under gzip; readers pass it
// straight to the rest of the app without translation.
interface WireRouteShareV1 {
	waypoints: Waypoint[];
	locked?: boolean;
}

// Legacy wire format v0: parallel coordinate + boolean-flag arrays.
// Read-only — preserved so old links keep resolving. New shares always emit v1.
interface WireRouteShareV0 {
	w: Coordinate[];
	f: boolean[];
	l?: boolean;
}

export interface SharedRoute {
	waypoints: Waypoint[];
	isLocked: boolean;
}

function uint8ArrayToUrlSafeBase64(array: Uint8Array): string {
	let binaryString = "";
	array.forEach((byte) => {
		binaryString += String.fromCharCode(byte);
	});
	return btoa(binaryString).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function urlSafeBase64ToUint8Array(base64String: string): Uint8Array {
	let paddedBase64 = base64String;
	if (paddedBase64.length % 4 === 2) paddedBase64 += "==";
	else if (paddedBase64.length % 4 === 3) paddedBase64 += "=";

	const binaryString = atob(paddedBase64.replace(/-/g, "+").replace(/_/g, "/"));
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
	return bytes;
}

const isLegacyV0 = (parsed: unknown): parsed is WireRouteShareV0 =>
	typeof parsed === "object" &&
	parsed !== null &&
	Array.isArray((parsed as WireRouteShareV0).w) &&
	Array.isArray((parsed as WireRouteShareV0).f);

const isV1 = (parsed: unknown): parsed is WireRouteShareV1 =>
	typeof parsed === "object" && parsed !== null && Array.isArray((parsed as WireRouteShareV1).waypoints);

export function serializeAndCompress(waypoints: Waypoint[], isLocked: boolean): string | null {
	try {
		const data: WireRouteShareV1 = { waypoints, locked: isLocked };
		const compressed = deflate(JSON.stringify(data));
		return uint8ArrayToUrlSafeBase64(compressed);
	} catch (error) {
		Logger.error("[ShareUtils] Error serializing/compressing data:", error);
		return null;
	}
}

export function decompressAndParse(encodedData: string): SharedRoute | null {
	try {
		const compressed = urlSafeBase64ToUint8Array(encodedData);
		const jsonString = new TextDecoder().decode(inflate(compressed));
		const parsed = JSON.parse(jsonString) as unknown;

		if (isV1(parsed)) {
			return { waypoints: parsed.waypoints, isLocked: parsed.locked ?? false };
		}

		if (isLegacyV0(parsed)) {
			const waypoints: Waypoint[] = parsed.w.map((coord, i) => ({
				coord,
				type: parsed.f[i] ? "direct" : "routed",
			}));
			return { waypoints, isLocked: parsed.l ?? false };
		}

		Logger.error("[ShareUtils] Decompressed data is not in a recognized format.");
		return null;
	} catch (error) {
		Logger.error("[ShareUtils] Error decompressing/parsing data:", error);
		return null;
	}
}
