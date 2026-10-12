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
// Unlike core's parseGpxTracks it also reads Waypoint names and the
// routess:type extension, which `routes import` needs. Writing goes through
// core's buildRouteGpx.
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
