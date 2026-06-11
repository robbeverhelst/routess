#!/usr/bin/env bun
// Transform GDAL GeoJSONSeq (points + multilinestrings layers from the OSM
// driver) into the clean node-network schema the web overlay expects
// (ADR 0033). This is the build-time home of the classification logic that
// used to run per-request in the API's overpass.ts.
//
//   bun transform.ts <points.geojsons> <lines.geojsons> > nodes.geojsons
//
// Output is one GeoJSON Feature per line:
//   Point       { kind, ref, name? }
//   LineString  { kind, fromRef?, toRef?, ref?, name? }

type Kind = "hiking" | "cycling";
type Tags = Record<string, string>;

// GDAL exposes unconfigured tags as an HSTORE string: "a"=>"b","c"=>"d".
function parseOtherTags(value: unknown): Tags {
	if (typeof value !== "string" || !value) return {};
	const tags: Tags = {};
	for (const m of value.matchAll(/"([^"]+)"\s*=>\s*"([^"]*)"/g)) {
		tags[m[1]] = m[2];
	}
	return tags;
}

function tagsOf(props: Record<string, unknown>): Tags {
	const flat: Tags = {};
	for (const [k, v] of Object.entries(props)) {
		if (k === "other_tags") continue;
		if (typeof v === "string" && v) flat[k] = v;
	}
	return { ...parseOtherTags(props.other_tags), ...flat };
}

function classify(network: string | undefined): Kind | null {
	if (network === "rwn" || network === "lwn") return "hiking";
	if (network === "rcn" || network === "lcn") return "cycling";
	return null;
}

function classifyNode(tags: Tags): Kind | null {
	if (tags.rwn_ref || tags.lwn_ref) return "hiking";
	if (tags.rcn_ref || tags.lcn_ref) return "cycling";
	return classify(tags.network);
}

function pickRef(tags: Tags): string | undefined {
	return tags.rwn_ref ?? tags.lwn_ref ?? tags.rcn_ref ?? tags.lcn_ref ?? tags.ref;
}

function parseConnectionRef(ref: string | undefined): { fromRef?: string; toRef?: string } {
	if (!ref) return {};
	const parts = ref
		.split(/[-–—>/]/)
		.map((p) => p.trim())
		.filter(Boolean);
	if (parts.length < 2) return {};
	return { fromRef: parts[0], toRef: parts[parts.length - 1] };
}

const out: string[] = [];
function emit(feature: unknown) {
	out.push(JSON.stringify(feature));
}

async function readFeatures(path: string): Promise<Array<Record<string, unknown>>> {
	const text = await Bun.file(path).text();
	const features: Array<Record<string, unknown>> = [];
	for (const line of text.split("\n")) {
		let trimmed = line.trim();
		if (trimmed.charCodeAt(0) === 0x1e) trimmed = trimmed.slice(1); // strip RS if record-separator framed
		if (!trimmed) continue;
		try {
			features.push(JSON.parse(trimmed));
		} catch {
			// ignore non-feature lines (FeatureCollection wrappers, etc.)
		}
	}
	return features;
}

function eachLineString(geometry: any, fn: (coords: number[][]) => void) {
	if (!geometry) return;
	if (geometry.type === "LineString") fn(geometry.coordinates);
	else if (geometry.type === "MultiLineString") for (const c of geometry.coordinates) fn(c);
}

async function main() {
	const [pointsPath, linesPath] = process.argv.slice(2);
	if (!pointsPath || !linesPath) {
		console.error("usage: bun transform.ts <points.geojsons> <lines.geojsons>");
		process.exit(2);
	}

	let nodes = 0;
	for (const f of await readFeatures(pointsPath)) {
		if ((f.geometry as any)?.type !== "Point") continue;
		const tags = tagsOf((f.properties ?? {}) as Record<string, unknown>);
		const kind = classifyNode(tags);
		if (!kind) continue;
		const ref = pickRef(tags);
		if (!ref) continue;
		emit({
			type: "Feature",
			geometry: f.geometry,
			properties: { kind, ref, ...(tags.name ? { name: tags.name } : {}) },
		});
		nodes++;
	}

	let lines = 0;
	for (const f of await readFeatures(linesPath)) {
		const tags = tagsOf((f.properties ?? {}) as Record<string, unknown>);
		const kind = classify(tags.network);
		if (!kind) continue;
		const conn = parseConnectionRef(tags.ref);
		eachLineString(f.geometry, (coords) => {
			if (!coords || coords.length < 2) return;
			emit({
				type: "Feature",
				geometry: { type: "LineString", coordinates: coords },
				properties: {
					kind,
					...(conn.fromRef ? { fromRef: conn.fromRef } : {}),
					...(conn.toRef ? { toRef: conn.toRef } : {}),
					...(tags.ref ? { ref: tags.ref } : {}),
					...(tags.name ? { name: tags.name } : {}),
				},
			});
			lines++;
		});
	}

	console.error(`[transform] emitted ${nodes} nodes, ${lines} connections`);
	process.stdout.write(`${out.join("\n")}\n`);
}

main();
