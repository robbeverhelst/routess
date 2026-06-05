import type { ApiRoute } from "@routess/api-client";
import { trackEvent } from "@/lib/analytics/track";
import { Logger } from "@/lib/logger";
import { generateGPXString } from "./GPXService";

const safeFilename = (name: string): string => {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return `${slug || "route"}.gpx`;
};

// Downloads a saved route as GPX, independent of the active draft.
export const exportRouteGpx = (route: ApiRoute): boolean => {
	const path = route.geometry && route.geometry.length >= 2 ? route.geometry : route.waypoints.map((wp) => wp.coord);
	const contents = generateGPXString(route.waypoints, path, route.name);
	const blob = new Blob([contents], { type: "application/gpx+xml;charset=utf-8" });
	const url = URL.createObjectURL(blob);

	try {
		const link = document.createElement("a");
		link.href = url;
		link.download = safeFilename(route.name);
		link.click();
	} catch (error) {
		Logger.error("[exportRouteGpx] Failed to export GPX file:", error);
		return false;
	} finally {
		URL.revokeObjectURL(url);
	}

	trackEvent({
		name: "gpx_exported",
		properties: {
			waypoint_count: route.waypoints.length,
			distance_m: Math.round(route.distance ?? 0),
			route_was_saved: true,
		},
	});
	return true;
};
