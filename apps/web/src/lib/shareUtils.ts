import type { Waypoint } from "@routess/core";
import pako from "pako";
import { Logger } from "@/lib/logger";
import type { Coordinate } from "@/types/map";

// Wire format kept stable so existing share links keep working.
// w = waypoint coordinates, f = direct-segment flags, l = optional locked.
interface WireRouteShareData {
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

export function serializeAndCompress(waypoints: Waypoint[], isLocked: boolean): string | null {
	try {
		const data: WireRouteShareData = {
			w: waypoints.map((wp) => wp.coord),
			f: waypoints.map((wp) => wp.type === "direct"),
			l: isLocked,
		};
		const jsonString = JSON.stringify(data);
		const compressedData = pako.deflate(jsonString);
		return uint8ArrayToUrlSafeBase64(compressedData);
	} catch (error) {
		Logger.error("[ShareUtils] Error serializing/compressing data:", error);
		return null;
	}
}

export function decompressAndParse(encodedData: string): SharedRoute | null {
	try {
		const compressedData = urlSafeBase64ToUint8Array(encodedData);
		const jsonString = pako.inflate(compressedData, { to: "string" });
		const parsed = JSON.parse(jsonString) as WireRouteShareData;

		if (!parsed || !Array.isArray(parsed.w) || !Array.isArray(parsed.f)) {
			Logger.error("[ShareUtils] Decompressed data is not in the expected format.");
			return null;
		}

		const waypoints: Waypoint[] = parsed.w.map((coord, i) => ({
			coord,
			type: parsed.f[i] ? "direct" : "routed",
		}));
		return { waypoints, isLocked: parsed.l ?? false };
	} catch (error) {
		Logger.error("[ShareUtils] Error decompressing/parsing data:", error);
		return null;
	}
}
