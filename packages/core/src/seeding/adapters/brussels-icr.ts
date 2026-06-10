import type { Coordinate } from "../../types";
import { calculatePathDistance } from "../../utils/geospatial";
import { stitchLooseSegments } from "../stitch";
import type { SeedAdapter, SeedRoute, SeedSourceMeta } from "../types";

// Brussels regional cycle routes (ICR/GFR): per-commune MultiLineString
// segments tagged with their route number, published CC0 on
// opendata.brussels. Grouped per ICR number and stitched into one route.
export const BRUSSELS_ICR_SOURCE: SeedSourceMeta = {
	key: "brussels-icr",
	displayName: "Gewestelijke fietsroutes Brussel (ICR/GFR)",
	license: "CC0-1.0",
	attribution: "Brussel Mobiliteit via opendata.brussels (CC0)",
	sourceUrl: "https://opendata.brussel.be/explore/dataset/itineraires-cyclables-regionaux-rbc",
	countries: ["BE"],
	activities: ["cycle"],
	status: "green",
	refreshIntervalDays: 30,
	feedUrl:
		"https://opendata.brussel.be/api/explore/v2.1/catalog/datasets/itineraires-cyclables-regionaux-rbc/exports/geojson",
};

interface IcrFeature {
	geometry?: { type: string; coordinates: unknown };
	properties?: { icr?: string; type?: string };
}

function featurePieces(geometry: IcrFeature["geometry"]): Coordinate[][] {
	if (!geometry) return [];
	if (geometry.type === "LineString") return [geometry.coordinates as Coordinate[]];
	if (geometry.type === "MultiLineString") return geometry.coordinates as Coordinate[][];
	return [];
}

export const brusselsIcrAdapter: SeedAdapter = {
	meta: BRUSSELS_ICR_SOURCE,
	parse(payload: string): SeedRoute[] {
		const collection = JSON.parse(payload) as { features?: IcrFeature[] };
		const byRoute = new Map<string, { pieces: Coordinate[][]; kind?: string }>();
		for (const feature of collection.features ?? []) {
			const icr = feature.properties?.icr?.trim();
			const pieces = featurePieces(feature.geometry);
			if (!icr || pieces.length === 0) continue;
			const group = byRoute.get(icr) ?? { pieces: [] };
			group.pieces.push(...pieces);
			// "Radial / Radiale" -> keep the Dutch half for the name suffix.
			group.kind = group.kind ?? feature.properties?.type?.split("/").pop()?.trim();
			byRoute.set(icr, group);
		}

		const routes: SeedRoute[] = [];
		for (const [icr, group] of byRoute) {
			const geometry = stitchLooseSegments(group.pieces);
			if (geometry.length < 2) continue;
			routes.push({
				sourceRecordId: `icr-${icr.toLowerCase()}`,
				name: `Gewestelijke fietsroute ICR ${icr.toUpperCase()}${group.kind ? ` (${group.kind})` : ""}`,
				description:
					"Aanbevolen fietsroute van Brussel Mobiliteit over rustige wegen, bewegwijzerd door alle 19 gemeenten.",
				activity: "cycle",
				geometry,
				tags: ["icr", "brussel"],
				distance: Math.round(calculatePathDistance(geometry) * 1000),
			});
		}
		return routes;
	},
};
