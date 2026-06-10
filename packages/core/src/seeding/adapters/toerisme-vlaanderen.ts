import type { Coordinate } from "../../types";
import { calculatePathDistance } from "../../utils/geospatial";
import { toRouteSlug } from "../../utils/slug";
import type { SeedAdapter, SeedRoute, SeedSourceMeta } from "../types";

// Toerisme Vlaanderen icoonroutes: the 9 iconic Flemish long-distance cycle
// routes, published as a weekly-refreshed WFS (Modellicentie gratis
// hergebruik). The license adds two obligations beyond attribution: link the
// meldpunt (carried into each route's description) and keep the data updated
// (satisfied by the scheduled refresh against the stable feedUrl below).
export const TOERISME_VLAANDEREN_ICOONROUTES_SOURCE: SeedSourceMeta = {
	key: "tv-icoonroutes",
	displayName: "Toerisme Vlaanderen icoonroutes",
	license: "Modellicentie-gratis-hergebruik-v1.0",
	attribution: "© Toerisme Vlaanderen / provinciale toeristische organisaties",
	sourceUrl: "https://www.icoonfietsroutes.be",
	countries: ["BE"],
	activities: ["cycle"],
	status: "green",
	// The source refreshes weekly; track it weekly (keep-updated obligation).
	refreshIntervalDays: 7,
	feedUrl:
		"https://geodata.toerismevlaanderen.be/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=routes:icoonroute_trajecten&outputFormat=application/json&srsName=EPSG:4326",
};

// One WFS feature: a knooppunt-to-knooppunt leg of an icoonroute.
interface IcoonrouteFeature {
	geometry?: { type: string; coordinates: unknown };
	properties?: {
		icoonroute?: string;
		begin_geoid?: number;
		end_geoid?: number;
		meldpunt?: string;
		updatedate?: string;
	};
}

interface Segment {
	begin: number;
	end: number;
	coords: Coordinate[];
}

function segmentCoords(geometry: IcoonrouteFeature["geometry"]): Coordinate[] {
	if (!geometry) return [];
	if (geometry.type === "LineString") return geometry.coordinates as Coordinate[];
	if (geometry.type === "MultiLineString") return (geometry.coordinates as Coordinate[][]).flat();
	return [];
}

function squaredDistance(a: Coordinate, b: Coordinate): number {
	return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

// Orders a route's segments into one continuous path. The WFS returns legs in
// arbitrary order; the next leg is found by chaining the begin/end node ids,
// but its coordinate direction is decided geometrically (the data does not
// guarantee that geometry runs begin to end). A leg whose begin never appears
// as an end is the natural start; disconnected components are appended as-is
// (the gap renders as a straight jump, which beats dropping a whole branch).
function stitchSegments(segments: Segment[]): Coordinate[] {
	const unused = [...segments];
	const endIds = new Set(segments.map((s) => s.end));
	const startIndex = unused.findIndex((s) => !endIds.has(s.begin));
	const first = unused.splice(Math.max(startIndex, 0), 1)[0];
	if (!first) return [];
	const path = [...first.coords];
	let cursor = first.end;
	while (unused.length > 0) {
		let index = unused.findIndex((s) => s.begin === cursor);
		let nextCursorIsEnd = true;
		if (index < 0) {
			index = unused.findIndex((s) => s.end === cursor);
			if (index >= 0) nextCursorIsEnd = false;
		}
		if (index < 0) {
			// Chain break (the route has several disconnected components): hop to
			// the geometrically nearest unused leg, not an arbitrary one, so the
			// gap stays a short jump instead of a map-crossing line.
			const tail = path[path.length - 1];
			let best = 0;
			let bestDistance = Number.POSITIVE_INFINITY;
			let bestReversed = false;
			if (tail) {
				for (let i = 0; i < unused.length; i++) {
					const candidate = unused[i];
					const head = candidate?.coords[0];
					const last = candidate?.coords[candidate.coords.length - 1];
					if (!head || !last) continue;
					const headDistance = squaredDistance(tail, head);
					const lastDistance = squaredDistance(tail, last);
					if (headDistance < bestDistance) {
						bestDistance = headDistance;
						best = i;
						bestReversed = false;
					}
					if (lastDistance < bestDistance) {
						bestDistance = lastDistance;
						best = i;
						bestReversed = true;
					}
				}
			}
			index = best;
			nextCursorIsEnd = !bestReversed;
		}
		const segment = unused.splice(index, 1)[0];
		if (!segment) break;
		cursor = nextCursorIsEnd ? segment.end : segment.begin;
		// Orient by geometry: the end nearer the current path tail goes first.
		let coords = segment.coords;
		const tail = path[path.length - 1];
		const head = coords[0];
		const last = coords[coords.length - 1];
		if (tail && head && last && squaredDistance(tail, last) < squaredDistance(tail, head)) {
			coords = [...coords].reverse();
		}
		// Drop the duplicated joint coordinate on connected legs.
		const joint = coords[0];
		path.push(...(tail && joint && tail[0] === joint[0] && tail[1] === joint[1] ? coords.slice(1) : coords));
	}
	return path;
}

export const toerismeVlaanderenIcoonroutesAdapter: SeedAdapter = {
	meta: TOERISME_VLAANDEREN_ICOONROUTES_SOURCE,
	parse(payload: string): SeedRoute[] {
		const collection = JSON.parse(payload) as { features?: IcoonrouteFeature[] };
		const byRoute = new Map<string, { segments: Segment[]; meldpunt?: string; updated?: string }>();
		const seenLegs = new Set<string>();
		for (const feature of collection.features ?? []) {
			const name = feature.properties?.icoonroute?.trim();
			const coords = segmentCoords(feature.geometry);
			if (!name || coords.length < 2) continue;
			// The feed contains a handful of duplicate legs (same node pair,
			// either direction); keep the first.
			const a = feature.properties?.begin_geoid ?? 0;
			const b = feature.properties?.end_geoid ?? 0;
			const legKey = `${name}:${Math.min(a, b)}-${Math.max(a, b)}`;
			if (seenLegs.has(legKey)) continue;
			seenLegs.add(legKey);
			const group = byRoute.get(name) ?? { segments: [] };
			group.segments.push({
				begin: feature.properties?.begin_geoid ?? 0,
				end: feature.properties?.end_geoid ?? 0,
				coords,
			});
			group.meldpunt = group.meldpunt ?? feature.properties?.meldpunt;
			const updated = feature.properties?.updatedate;
			if (updated && (!group.updated || updated > group.updated)) group.updated = updated;
			byRoute.set(name, group);
		}

		const routes: SeedRoute[] = [];
		for (const [name, group] of byRoute) {
			const geometry = stitchSegments(group.segments);
			if (geometry.length < 2) continue;
			const meldpunt = group.meldpunt ? ` Meld problemen op de route via ${group.meldpunt}.` : "";
			routes.push({
				sourceRecordId: toRouteSlug(name),
				name,
				description: `Vlaamse icoonfietsroute langs het bewegwijzerde fietsknooppuntennetwerk.${meldpunt}`,
				activity: "cycle",
				geometry,
				tags: ["icoonroute", "knooppunten"],
				distance: Math.round(calculatePathDistance(geometry) * 1000),
				sourceUpdatedAt: group.updated?.replace(/Z?$/, "T00:00:00Z"),
			});
		}
		return routes;
	},
};
