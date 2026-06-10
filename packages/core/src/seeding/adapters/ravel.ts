import type { Coordinate } from "../../types";
import { calculatePathDistance } from "../../utils/geospatial";
import { toRouteSlug } from "../../utils/slug";
import { stitchLooseSegments } from "../stitch";
import type { SeedAdapter, SeedRoute, SeedSourceMeta } from "../types";

// SPW Wallonia RAVeL + véloroutes, étapes layer: named ride-able stages of the
// international/regional itineraries (CC BY 4.0). Stable ArcGIS GeoJSON query
// as feedUrl, so the source is fully automatic. The local RAVeL lignes (layer
// 3) can become a second source on the same shape later.
export const RAVEL_SOURCE: SeedSourceMeta = {
	key: "ravel",
	displayName: "RAVeL & véloroutes (Service public de Wallonie)",
	license: "CC-BY-4.0",
	attribution: "© Service public de Wallonie (SPW), CC BY 4.0",
	sourceUrl: "https://ravel.wallonie.be",
	countries: ["BE"],
	activities: ["cycle"],
	status: "green",
	refreshIntervalDays: 30,
	feedUrl:
		"https://geoservices.wallonie.be/arcgis/rest/services/MOBILITE/RAVEL_VELOROUTES/MapServer/4/query?where=1%3D1&outFields=*&outSR=4326&f=geojson",
};

interface RavelFeature {
	geometry?: { type: string; coordinates: unknown };
	properties?: {
		ID_PORTION?: string | number;
		NOM?: string;
		DESCRIPT?: string;
		SITE_WEB?: string;
	};
}

function featurePieces(geometry: RavelFeature["geometry"]): Coordinate[][] {
	if (!geometry) return [];
	if (geometry.type === "LineString") return [geometry.coordinates as Coordinate[]];
	if (geometry.type === "MultiLineString") return geometry.coordinates as Coordinate[][];
	return [];
}

export const ravelAdapter: SeedAdapter = {
	meta: RAVEL_SOURCE,
	parse(payload: string): SeedRoute[] {
		const collection = JSON.parse(payload) as { features?: RavelFeature[] };
		const routes: SeedRoute[] = [];
		for (const feature of collection.features ?? []) {
			const name = feature.properties?.NOM?.trim();
			const geometry = stitchLooseSegments(featurePieces(feature.geometry));
			if (!name || geometry.length < 2) continue;
			const itinerary = feature.properties?.DESCRIPT?.trim();
			const site = feature.properties?.SITE_WEB?.trim();
			routes.push({
				sourceRecordId: feature.properties?.ID_PORTION ? `portion-${feature.properties.ID_PORTION}` : toRouteSlug(name),
				name: itinerary ? `${itinerary}: ${name}` : name,
				description: `Bewegwijzerde RAVeL-etappe in Wallonië.${site ? ` Meer info: ${site}` : ""}`,
				activity: "cycle",
				geometry,
				tags: ["ravel"],
				distance: Math.round(calculatePathDistance(geometry) * 1000),
			});
		}
		return routes;
	},
};
