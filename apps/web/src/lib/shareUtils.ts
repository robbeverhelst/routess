import pako from "pako";
import { Logger } from "@/lib/logger";
import type { Coordinate } from "@/types/map";

interface RouteShareData {
	w: Coordinate[];
	f: boolean[];
	l?: boolean;
}

// Helper to convert Uint8Array to URL-safe Base64 string
function uint8ArrayToUrlSafeBase64(array: Uint8Array): string {
	let binaryString = "";
	array.forEach((byte) => {
		binaryString += String.fromCharCode(byte);
	});
	return btoa(binaryString)
		.replace(/\+/g, "-") // Convert '+' to '-'
		.replace(/\//g, "_") // Convert '/' to '_'
		.replace(/=/g, ""); // Remove padding '='
}

// Helper to convert URL-safe Base64 string back to Uint8Array
function urlSafeBase64ToUint8Array(base64String: string): Uint8Array {
	// Add padding back if necessary
	let paddedBase64 = base64String;
	if (paddedBase64.length % 4 === 2) {
		paddedBase64 += "==";
	} else if (paddedBase64.length % 4 === 3) {
		paddedBase64 += "=";
	}

	const binaryString = atob(paddedBase64.replace(/-/g, "+").replace(/_/g, "/"));
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

export function serializeAndCompress(
	waypoints: Coordinate[],
	directFlags: boolean[],
	isLocked: boolean,
): string | null {
	try {
		const data: RouteShareData = { w: waypoints, f: directFlags, l: isLocked };
		const jsonString = JSON.stringify(data);
		const compressedData = pako.deflate(jsonString);
		return uint8ArrayToUrlSafeBase64(compressedData);
	} catch (error) {
		Logger.error("[ShareUtils] Error serializing/compressing data:", error);
		return null;
	}
}

export function decompressAndParse(encodedData: string): RouteShareData | null {
	try {
		const compressedData = urlSafeBase64ToUint8Array(encodedData);
		const jsonString = pako.inflate(compressedData, { to: "string" });
		const parsedData = JSON.parse(jsonString) as RouteShareData;

		// Basic validation
		if (parsedData && Array.isArray(parsedData.w) && Array.isArray(parsedData.f)) {
			return parsedData;
		}
		Logger.error("[ShareUtils] Decompressed data is not in the expected format.");
		return null;
	} catch (error) {
		Logger.error("[ShareUtils] Error decompressing/parsing data:", error);
		return null;
	}
}
