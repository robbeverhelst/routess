import type { Coordinate, Waypoint, WaypointType } from "@routess/core";

export interface ParsedGpx {
	name?: string;
	waypoints: Waypoint[];
	trackPoints: Coordinate[];
}

function unescapeXml(value: string): string {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&");
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function attrCoord(attrs: string): Coordinate | null {
	const lat = attrs.match(/\blat="([-\d.]+)"/);
	const lon = attrs.match(/\blon="([-\d.]+)"/);
	if (!lat || !lon) return null;
	const latNum = Number(lat[1]);
	const lonNum = Number(lon[1]);
	if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
	return [lonNum, latNum];
}

function parsePoint(attrs: string, inner: string): Waypoint | null {
	const coord = attrCoord(attrs);
	if (!coord) return null;
	const name = inner.match(/<name>([^<]*)<\/name>/);
	const type = inner.match(/<routess:type>(routed|direct)<\/routess:type>/);
	return {
		coord,
		type: (type?.[1] as WaypointType | undefined) ?? "routed",
		...(name?.[1] ? { name: unescapeXml(name[1]) } : {}),
	};
}

// Regex-based GPX reader covering the subset Routess emits plus plain
// exports from other tools (trk-only files, standalone wpt elements).
// Node has no DOMParser, hence no reuse of the web GPXService.
export function parseGpx(xml: string): ParsedGpx {
	const metaName = xml.match(/<metadata>[\s\S]*?<name>([^<]*)<\/name>[\s\S]*?<\/metadata>/);
	const blockName = xml.match(/<(?:rte|trk)>\s*<name>([^<]*)<\/name>/);
	const name = metaName?.[1] || blockName?.[1];

	const waypoints: Waypoint[] = [];
	for (const tag of ["rtept", "wpt"] as const) {
		const pattern = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, "g");
		for (const match of xml.matchAll(pattern)) {
			const waypoint = parsePoint(match[1], match[2] ?? "");
			if (waypoint) waypoints.push(waypoint);
		}
		if (waypoints.length > 0) break;
	}

	const trackPoints: Coordinate[] = [];
	for (const match of xml.matchAll(/<trkpt\b([^>]*?)(?:\/>|>[\s\S]*?<\/trkpt>)/g)) {
		const coord = attrCoord(match[1]);
		if (coord) trackPoints.push(coord);
	}

	return { ...(name ? { name: unescapeXml(name) } : {}), waypoints, trackPoints };
}

// Mirrors the GPX 1.1 shape the API serves on GET /routes/:ref/gpx.
export function buildGpx(args: { name: string; waypoints: Waypoint[]; geometry?: Coordinate[] }): string {
	const parts: string[] = [];
	parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
	parts.push(
		`<gpx version="1.1" creator="Routess CLI" xmlns="http://www.topografix.com/GPX/1/1" xmlns:routess="https://routess.app/gpx/1">`,
	);
	parts.push("  <metadata>");
	parts.push(`    <name>${escapeXml(args.name)}</name>`);
	parts.push("  </metadata>");
	if (args.waypoints.length > 0) {
		parts.push("  <rte>");
		parts.push(`    <name>${escapeXml(args.name)}</name>`);
		for (const w of args.waypoints) {
			const [lng, lat] = w.coord;
			parts.push(`    <rtept lat="${lat}" lon="${lng}">`);
			if (w.name) parts.push(`      <name>${escapeXml(w.name)}</name>`);
			parts.push("      <extensions>");
			parts.push(`        <routess:type>${w.type}</routess:type>`);
			parts.push("      </extensions>");
			parts.push("    </rtept>");
		}
		parts.push("  </rte>");
	}
	if (args.geometry && args.geometry.length > 0) {
		parts.push("  <trk>");
		parts.push(`    <name>${escapeXml(args.name)}</name>`);
		parts.push("    <trkseg>");
		for (const [lng, lat] of args.geometry) {
			parts.push(`      <trkpt lat="${lat}" lon="${lng}"></trkpt>`);
		}
		parts.push("    </trkseg>");
		parts.push("  </trk>");
	}
	parts.push("</gpx>");
	return parts.join("\n");
}
