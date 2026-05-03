import { ElevationService } from "./ElevationService";
import { MapboxTerrainRgbElevationProvider } from "./MapboxTerrainRgbElevationProvider";

let cachedService: ElevationService | null = null;
let cachedToken: string | null = null;

// Single shared ElevationService keyed by access token. Sharing it across
// surfaces (route planning, saved-route detail) lets the underlying tile
// cache hit between views — opening a saved route that overlaps the area
// the user just routed through reuses already-fetched terrain tiles.
export const getDefaultElevationService = (accessToken: string): ElevationService => {
	if (!cachedService || cachedToken !== accessToken) {
		cachedService = new ElevationService(new MapboxTerrainRgbElevationProvider({ accessToken }));
		cachedToken = accessToken;
	}
	return cachedService;
};
