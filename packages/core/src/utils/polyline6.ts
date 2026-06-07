import type { Coordinate } from "../types";

// Valhalla speaks polyline with precision 1e6 (vs Google's 1e5). Coordinates
// are [longitude, latitude] per the GeoJSON convention used across Routess.

const FACTOR = 1e6;

export function decodePolyline6(encoded: string): Coordinate[] {
	const coords: Coordinate[] = [];
	let index = 0;
	let lat = 0;
	let lng = 0;
	while (index < encoded.length) {
		let result = 0;
		let shift = 0;
		let byte: number;
		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);
		lat += result & 1 ? ~(result >> 1) : result >> 1;

		result = 0;
		shift = 0;
		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);
		lng += result & 1 ? ~(result >> 1) : result >> 1;

		coords.push([lng / FACTOR, lat / FACTOR]);
	}
	return coords;
}

function encodeValue(value: number, out: string[]): void {
	let v = value < 0 ? ~(value << 1) : value << 1;
	while (v >= 0x20) {
		out.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63));
		v >>= 5;
	}
	out.push(String.fromCharCode(v + 63));
}

export function encodePolyline6(coords: Coordinate[]): string {
	const out: string[] = [];
	let prevLat = 0;
	let prevLng = 0;
	for (const [lon, lat] of coords) {
		const latE6 = Math.round(lat * FACTOR);
		const lngE6 = Math.round(lon * FACTOR);
		encodeValue(latE6 - prevLat, out);
		encodeValue(lngE6 - prevLng, out);
		prevLat = latE6;
		prevLng = lngE6;
	}
	return out.join("");
}
