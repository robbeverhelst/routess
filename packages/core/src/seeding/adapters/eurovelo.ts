import { calculatePathDistance } from "../../utils/geospatial";
import { toRouteSlug } from "../../utils/slug";
import { parseGpxTracks } from "../gpx";
import type { SeedAdapter, SeedRoute, SeedSourceMeta } from "../types";

// EuroVelo: the European Cyclists' Federation publishes the official EuroVelo
// network as GPX, open since 2024 under ODbL with a fixed attribution string.
// One green source; the headline cross-border seed (ADR 0033, epic #248).
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

// EuroVelo route names are stable identifiers ("EuroVelo 5 - Via Romea
// (Francigena)"), so a slug of the name is a durable sourceRecordId across
// refreshes. parse is pure over one fetched GPX document.
export const euroVeloAdapter: SeedAdapter = {
	meta: EUROVELO_SOURCE,
	parse(payload: string): SeedRoute[] {
		const tracks = parseGpxTracks(payload);
		const routes: SeedRoute[] = [];
		for (const track of tracks) {
			const name = track.name?.trim();
			if (!name || track.points.length < 2) continue;
			routes.push({
				sourceRecordId: toRouteSlug(name),
				name,
				activity: "cycle",
				geometry: track.points,
				tags: ["eurovelo", "long-distance"],
				distance: Math.round(calculatePathDistance(track.points) * 1000),
			});
		}
		return routes;
	},
};
