import type { Waypoint } from "../types";

const ROUTESS_GPX_NS = "https://routess.app/gpx/1";

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

// The one GPX builder, shared by web export and the API download endpoints.
// Embeds the Waypoint Type in a routess-namespaced extension so round-trips
// preserve routed/direct semantics; foreign tools ignore unknown extensions.
// `attribution`/`sourceUrl` carry the SeedSource license obligation on
// ExternalRoute exports (ADR 0035).
export function buildRouteGpx(args: {
	name?: string;
	description?: string;
	waypoints: Waypoint[];
	geometry?: [number, number][];
	attribution?: string;
	sourceUrl?: string;
}): string {
	const name = args.name?.trim() || "Exported Route";
	const parts: string[] = [];
	parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
	parts.push(
		`<gpx version="1.1" creator="Routess" xmlns="http://www.topografix.com/GPX/1/1" xmlns:routess="${ROUTESS_GPX_NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
	);
	parts.push("  <metadata>");
	parts.push(`    <name>${escapeXml(name)}</name>`);
	if (args.description) parts.push(`    <desc>${escapeXml(args.description)}</desc>`);
	if (args.attribution) {
		parts.push(`    <copyright author="${escapeXml(args.attribution)}">`);
		if (args.sourceUrl) parts.push(`      <license>${escapeXml(args.sourceUrl)}</license>`);
		parts.push("    </copyright>");
	}
	parts.push(`    <time>${new Date().toISOString()}</time>`);
	parts.push("  </metadata>");

	if (args.waypoints.length > 0) {
		parts.push("  <rte>");
		parts.push(`    <name>${escapeXml(name)}</name>`);
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
		parts.push(`    <name>${escapeXml(name)}</name>`);
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
