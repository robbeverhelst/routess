// Overpass node-network (knooppunten) fetching and GeoJSON transformation.
// Moved server-side (ADR 0032) so one Overpass fetch per grid cell serves
// every user, instead of every browser re-pulling the same network.

export type NodeNetworkKind = "hiking" | "cycling";

export interface NodeNetworkBbox {
	south: number;
	west: number;
	north: number;
	east: number;
}

interface OverpassNodeElement {
	type: "node";
	id: number;
	lat: number;
	lon: number;
	tags?: Record<string, string>;
}

interface OverpassWayElement {
	type: "way";
	id: number;
	geometry?: { lat: number; lon: number }[];
	tags?: Record<string, string>;
}

interface OverpassRelationElement {
	type: "relation";
	id: number;
	members?: {
		type: string;
		ref: number;
		role?: string;
		geometry?: { lat: number; lon: number }[];
	}[];
	tags?: Record<string, string>;
}

export interface OverpassResponse {
	elements: (OverpassNodeElement | OverpassWayElement | OverpassRelationElement)[];
}

export type NodeFeatureProps = {
	kind: NodeNetworkKind;
	ref?: string;
	fromRef?: string;
	toRef?: string;
	name?: string;
};

// Minimal GeoJSON shapes (the API has no @types/geojson dependency); the
// wire format matches what mapbox-gl consumes on the web side.
interface PointGeometry {
	type: "Point";
	coordinates: [number, number];
}

interface LineStringGeometry {
	type: "LineString";
	coordinates: [number, number][];
}

export interface NodeFeature {
	type: "Feature";
	id: string;
	geometry: PointGeometry | LineStringGeometry;
	properties: NodeFeatureProps;
}

export interface NodeFeatureCollection {
	type: "FeatureCollection";
	features: NodeFeature[];
}

function classify(network: string | undefined): NodeNetworkKind | null {
	if (!network) return null;
	if (network === "rwn" || network === "lwn") return "hiking";
	if (network === "rcn" || network === "lcn") return "cycling";
	return null;
}

function classifyNode(tags: Record<string, string>): NodeNetworkKind | null {
	if (tags.rwn_ref || tags.lwn_ref) return "hiking";
	if (tags.rcn_ref || tags.lcn_ref) return "cycling";
	return classify(tags.network);
}

function pickRef(tags: Record<string, string>): string | undefined {
	return tags.rwn_ref ?? tags.lwn_ref ?? tags.rcn_ref ?? tags.lcn_ref ?? tags.ref;
}

function parseConnectionRef(ref: string | undefined): Pick<NodeFeatureProps, "fromRef" | "toRef"> {
	if (!ref) return {};
	const parts = ref
		.split(/[-–—>/]/)
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length < 2) return {};
	return { fromRef: parts[0], toRef: parts[parts.length - 1] };
}

export function buildNodeNetworkQuery(bbox: NodeNetworkBbox): string {
	const { south, west, north, east } = bbox;
	const bboxStr = `${south},${west},${north},${east}`;
	return `[out:json][timeout:25];
(
  node["rwn_ref"](${bboxStr});
  node["lwn_ref"](${bboxStr});
  node["rcn_ref"](${bboxStr});
  node["lcn_ref"](${bboxStr});
  node["network:type"="node_network"]["ref"](${bboxStr});
  relation["type"="route"]["network:type"="node_network"]["network"~"^[lr][wc]n$"](${bboxStr});
);
out geom;`;
}

export function nodeFeaturesFromOverpass(data: OverpassResponse): NodeFeature[] {
	const features: NodeFeature[] = [];

	for (const el of data.elements) {
		if (el.type === "node") {
			const tags = el.tags ?? {};
			const kind = classifyNode(tags);
			if (!kind) continue;
			const ref = pickRef(tags);
			if (!ref) continue;
			features.push({
				type: "Feature",
				id: `n${el.id}`,
				geometry: { type: "Point", coordinates: [el.lon, el.lat] },
				properties: { kind, ref, name: tags.name },
			});
		} else if (el.type === "way") {
			const tags = el.tags ?? {};
			const kind = classify(tags.network);
			if (!kind) continue;
			if (!el.geometry || el.geometry.length < 2) continue;
			features.push({
				type: "Feature",
				id: `w${el.id}`,
				geometry: {
					type: "LineString",
					coordinates: el.geometry.map((p) => [p.lon, p.lat]),
				},
				properties: { kind, name: tags.name },
			});
		} else if (el.type === "relation") {
			const tags = el.tags ?? {};
			const kind = classify(tags.network);
			if (!kind) continue;

			for (const [index, member] of (el.members ?? []).entries()) {
				if (member.type !== "way" || !member.geometry || member.geometry.length < 2) continue;
				features.push({
					type: "Feature",
					id: `r${el.id}-w${member.ref}-${index}`,
					geometry: {
						type: "LineString",
						coordinates: member.geometry.map((p) => [p.lon, p.lat]),
					},
					properties: { kind, ref: tags.ref, ...parseConnectionRef(tags.ref), name: tags.name },
				});
			}
		}
	}

	return features;
}
