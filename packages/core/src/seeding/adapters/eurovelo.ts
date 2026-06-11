import { calculatePathDistance } from "../../utils/geospatial";
import { toRouteSlug } from "../../utils/slug";
import { parseGpxTracks } from "../gpx";
import type { SeedAdapter, SeedParseContext, SeedRoute, SeedSourceMeta } from "../types";

// EuroVelo: the European Cyclists' Federation publishes the official EuroVelo
// network as GPX, open since 2024 under ODbL with a fixed attribution string.
// One green source; the headline cross-border seed (ADR 0035, epic #248).
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
	// ECF's stable per-route GPX endpoints (en.eurovelo.com/route/get-gpx/{id});
	// labels supply the route names the files themselves do not carry.
	feedUrls: [
		{ url: "https://en.eurovelo.com/route/get-gpx/2", label: "EuroVelo 1 - Atlantic Coast Route" },
		{ url: "https://en.eurovelo.com/route/get-gpx/25", label: "EuroVelo 2 - Capitals Route" },
		{ url: "https://en.eurovelo.com/route/get-gpx/26", label: "EuroVelo 3 - Pilgrims Route" },
		{ url: "https://en.eurovelo.com/route/get-gpx/27", label: "EuroVelo 4 - Central Europe Route" },
		{ url: "https://en.eurovelo.com/route/get-gpx/28", label: "EuroVelo 5 - Via Romea (Francigena)" },
		{ url: "https://en.eurovelo.com/route/get-gpx/29", label: "EuroVelo 6 - Atlantic - Black Sea" },
		{ url: "https://en.eurovelo.com/route/get-gpx/30", label: "EuroVelo 7 - Sun Route" },
		{ url: "https://en.eurovelo.com/route/get-gpx/31", label: "EuroVelo 8 - Mediterranean Route" },
		{ url: "https://en.eurovelo.com/route/get-gpx/32", label: "EuroVelo 9 - Baltic - Adriatic" },
		{ url: "https://en.eurovelo.com/route/get-gpx/33", label: "EuroVelo 10 - Baltic Sea Cycle Route" },
		{ url: "https://en.eurovelo.com/route/get-gpx/34", label: "EuroVelo 11 - East Europe Route" },
		{ url: "https://en.eurovelo.com/route/get-gpx/35", label: "EuroVelo 12 - North Sea Cycle Route" },
		{ url: "https://en.eurovelo.com/route/get-gpx/1", label: "EuroVelo 13 - Iron Curtain Trail" },
		{ url: "https://en.eurovelo.com/route/get-gpx/512", label: "EuroVelo 14 - Waters of Central Europe" },
		{ url: "https://en.eurovelo.com/route/get-gpx/36", label: "EuroVelo 15 - Rhine Cycle Route" },
		{ url: "https://en.eurovelo.com/route/get-gpx/37", label: "EuroVelo 17 - Rhone Cycle Route" },
		{ url: "https://en.eurovelo.com/route/get-gpx/135", label: "EuroVelo 19 - Meuse Cycle Route" },
	],
};

// Official route names for the per-route GPX endpoints, keyed by the short
// code the seed script derives from the filename (ev5.gpx -> ev5).
export const EUROVELO_ROUTE_LABELS: Record<string, string> = {
	ev1: "EuroVelo 1 - Atlantic Coast Route",
	ev2: "EuroVelo 2 - Capitals Route",
	ev3: "EuroVelo 3 - Pilgrims Route",
	ev4: "EuroVelo 4 - Central Europe Route",
	ev5: "EuroVelo 5 - Via Romea (Francigena)",
	ev6: "EuroVelo 6 - Atlantic - Black Sea",
	ev7: "EuroVelo 7 - Sun Route",
	ev8: "EuroVelo 8 - Mediterranean Route",
	ev9: "EuroVelo 9 - Baltic - Adriatic",
	ev10: "EuroVelo 10 - Baltic Sea Cycle Route",
	ev11: "EuroVelo 11 - East Europe Route",
	ev12: "EuroVelo 12 - North Sea Cycle Route",
	ev13: "EuroVelo 13 - Iron Curtain Trail",
	ev14: "EuroVelo 14 - Waters of Central Europe",
	ev15: "EuroVelo 15 - Rhine Cycle Route",
	ev17: "EuroVelo 17 - Rhone Cycle Route",
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
