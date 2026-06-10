import type { Coordinate } from "../types";

export interface GpxTrack {
	name?: string;
	desc?: string;
	points: Coordinate[];
}

function extractTag(xml: string, tag: "name" | "desc"): string | undefined {
	const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
	const value = match?.[1]?.trim();
	return value ? decodeXml(value) : undefined;
}

function decodeXml(value: string): string {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&");
}

// Pull [lng, lat] pairs from every <trkpt>/<rtept> in a block, tolerant of
// attribute order (lat/lon either way) and self-closing or wrapped tags.
function extractPoints(block: string): Coordinate[] {
	const points: Coordinate[] = [];
	const ptPattern = /<(?:trkpt|rtept)\b([^>]*)>/gi;
	let m: RegExpExecArray | null;
	m = ptPattern.exec(block);
	while (m !== null) {
		const attrs = m[1] ?? "";
		const lat = Number(/\blat\s*=\s*"([-\d.]+)"/i.exec(attrs)?.[1]);
		const lon = Number(/\blon\s*=\s*"([-\d.]+)"/i.exec(attrs)?.[1]);
		if (Number.isFinite(lat) && Number.isFinite(lon)) {
			points.push([lon, lat]);
		}
		m = ptPattern.exec(block);
	}
	return points;
}

// Parse a GPX document into its tracks/routes. Pure and dependency-free so it
// runs in both node (seeding pipeline) and the browser. Each <trk>/<rte>
// becomes one GpxTrack; a nameless segment inherits the <metadata> name.
export function parseGpxTracks(xml: string): GpxTrack[] {
	const metadataBlock = /<metadata\b[\s\S]*?<\/metadata>/i.exec(xml)?.[0] ?? "";
	const fallbackName = extractTag(metadataBlock, "name");

	const tracks: GpxTrack[] = [];
	const blockPattern = /<(trk|rte)\b[\s\S]*?<\/\1>/gi;
	let block: RegExpExecArray | null;
	block = blockPattern.exec(xml);
	while (block !== null) {
		const body = block[0];
		const points = extractPoints(body);
		if (points.length > 0) {
			// Name from the block's own <name>, but skip a <name> that belongs to
			// a nested point: take the first one before the first point tag.
			const head = body.slice(0, body.search(/<(?:trkpt|rtept)\b/i));
			tracks.push({ name: extractTag(head, "name") ?? fallbackName, desc: extractTag(head, "desc"), points });
		}
		block = blockPattern.exec(xml);
	}
	return tracks;
}
