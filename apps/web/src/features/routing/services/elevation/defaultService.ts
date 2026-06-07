import { ElevationService } from "./ElevationService";
import { ValhallaHeightElevationProvider } from "./ValhallaHeightElevationProvider";

let cachedService: ElevationService | null = null;

// Single shared ElevationService. Sharing it across surfaces (route
// planning, saved-route detail) lets the in-memory result cache hit between
// views; the API's Redis cache dedupes across users (ADR 0031).
export const getDefaultElevationService = (): ElevationService => {
	if (!cachedService) {
		cachedService = new ElevationService(new ValhallaHeightElevationProvider());
	}
	return cachedService;
};
