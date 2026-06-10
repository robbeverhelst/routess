import { calculatePathDistance } from "../../utils/geospatial";
import { toRouteSlug } from "../../utils/slug";
import { parseGpxTracks } from "../gpx";
import type { SeedAdapter, SeedParseContext, SeedRoute, SeedSourceMeta } from "../types";

// EuroVelo: the European Cyclists' Federation publishes the official EuroVelo
// network as GPX, open since 2024 under ODbL with a fixed attribution string.
// One green source; the headline cross-border seed (ADR 0033, epic #248).
// Downloads are per-route (https://en.eurovelo.com/route/get-gpx/{id}), one
// file per EV route containing one <trk> per signed stage.
export const EUROVELO_SOURCE: SeedSourceMeta = {
	key: "eurovelo",
	displayName: "EuroVelo (European Cyclists' Federation)",
	license: "ODbL-1.0",
	attribution: "© EuroVelo / European Cyclists' Federation, ODbL",
	sourceUrl: "https://eurovelo.com",
	// EuroVelo spans the continent; the seed concentrates on our launch region
	// but the tracks themselves are pan-European.
	countries: ["BE", "NL", "FR", "DE"],
	activities: ["cycle"],
	status: "green",
	refreshIntervalDays: 30,
};

// Official route names for the per-route GPX endpoints, keyed by the short
// code the seed script derives from the filename (ev5.gpx -> ev5).
export const EUROVELO_ROUTE_LABELS: Record<string, string> = {
	ev1: "EuroVelo 1 - Atlantic Coast Route",
	ev3: "EuroVelo 3 - Pilgrims Route",
	ev4: "EuroVelo 4 - Central Europe Route",
	ev5: "EuroVelo 5 - Via Romea (Francigena)",
	ev12: "EuroVelo 12 - North Sea Cycle Route",
	ev15: "EuroVelo 15 - Rhine Cycle Route",
	ev19: "EuroVelo 19 - Meuse Cycle Route",
};

// ECF stage names look like "01: Canterbury – Dover (Developed + Signed)":
// a stage number, the leg, and a development-status suffix that belongs in
// the description, not the title.
const STAGE_PATTERN = /^(\d+):\s*(.+?)\s*(?:\(([^)]*)\))?$/;

export const euroVeloAdapter: SeedAdapter = {
	meta: EUROVELO_SOURCE,
	parse(payload: string, context?: SeedParseContext): SeedRoute[] {
		const label = context?.label?.trim();
		const evTag = label ? /euro\s?velo\s*(\d+)/i.exec(label)?.[1] : undefined;
		const routes: SeedRoute[] = [];
		for (const track of parseGpxTracks(payload)) {
			const rawName = track.name?.trim();
			if (!rawName || track.points.length < 2) continue;
			const stage = STAGE_PATTERN.exec(rawName);
			const stageNumber = stage?.[1];
			const leg = stage?.[2] ?? rawName;
			const status = stage?.[3] ?? track.desc;
			// "EuroVelo 5 - Via Romea (Francigena), stage 01: Canterbury – Dover".
			// Stable per stage; the status suffix moves to the description so a
			// signage upgrade does not rename (or re-identify) the route.
			const name = label && stageNumber ? `${label}, stage ${stageNumber}: ${leg}` : (label ?? leg);
			const sourceRecordId = label && stageNumber ? `${toRouteSlug(label)}-stage-${stageNumber}` : toRouteSlug(rawName);
			routes.push({
				sourceRecordId,
				name,
				description: status ? `Official EuroVelo stage. Development status: ${status}.` : undefined,
				activity: "cycle",
				geometry: track.points,
				tags: ["eurovelo", ...(evTag ? [`ev${evTag}`] : []), "long-distance"],
				distance: Math.round(calculatePathDistance(track.points) * 1000),
			});
		}
		return routes;
	},
};
