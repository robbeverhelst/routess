import type { Coordinate, RouteActivity } from "../../types";
import { calculatePathDistance } from "../../utils/geospatial";
import { stitchLooseSegments } from "../stitch";
import type { SeedAdapter, SeedRoute, SeedSourceMeta } from "../types";

// Named OSM route relations in Belgium (route=bicycle|hiking|foot), excluding
// the rcn/rwn node-network grid (that grid is generation input, not finished
// routes). ODbL like EuroVelo; the relation id is the stable record id. The
// feedUrl is a full-country Overpass query with member geometry; heavy
// (~minutes, tens of MB) but run from the weekly CronJob, not request-time.
export const OSM_BELGIUM_SOURCE: SeedSourceMeta = {
	key: "osm-belgium",
	displayName: "OpenStreetMap route relations (Belgium)",
	license: "ODbL-1.0",
	attribution: "© OpenStreetMap contributors, ODbL",
	sourceUrl: "https://www.openstreetmap.org/copyright",
	countries: ["BE"],
	activities: ["cycle", "walk"],
	status: "green",
	refreshIntervalDays: 30,
	feedUrl:
		"https://overpass-api.de/api/interpreter?data=" +
		encodeURIComponent(
			'[out:json][timeout:600];area["ISO3166-1"="BE"][admin_level=2]->.be;(relation["route"="bicycle"]["network"!="rcn"]["name"](area.be);relation["route"~"^(hiking|foot)$"]["network"!="rwn"]["name"](area.be););out geom;',
		),
};

interface OverpassRelation {
	type: string;
	id: number;
	tags?: Record<string, string>;
	members?: { type: string; role?: string; geometry?: { lat: number; lon: number }[] }[];
}

function activityFor(tags: Record<string, string>): RouteActivity {
	return tags.route === "bicycle" ? "cycle" : "walk";
}

export const osmBelgiumAdapter: SeedAdapter = {
	meta: OSM_BELGIUM_SOURCE,
	parse(payload: string): SeedRoute[] {
		const data = JSON.parse(payload) as { elements?: OverpassRelation[] };
		const routes: SeedRoute[] = [];
		for (const relation of data.elements ?? []) {
			if (relation.type !== "relation") continue;
			const tags = relation.tags ?? {};
			const name = tags.name?.trim();
			if (!name) continue;
			// Superroutes nest other relations; their members carry no geometry
			// here and the child routes are ingested individually anyway.
			const pieces: Coordinate[][] = (relation.members ?? [])
				.filter((m) => m.type === "way" && m.geometry && m.role !== "platform")
				.map((m) => (m.geometry as { lat: number; lon: number }[]).map((p): Coordinate => [p.lon, p.lat]));
			const geometry = stitchLooseSegments(pieces);
			if (geometry.length < 2) continue;
			const network = tags.network?.trim();
			routes.push({
				sourceRecordId: `rel-${relation.id}`,
				name: tags.ref && !name.includes(tags.ref) ? `${name} (${tags.ref})` : name,
				description: tags.description?.trim() || undefined,
				activity: activityFor(tags),
				geometry,
				tags: ["osm", ...(network ? [network] : [])],
				distance: Math.round(calculatePathDistance(geometry) * 1000),
			});
		}
		return routes;
	},
};
