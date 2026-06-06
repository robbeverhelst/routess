import type { Coordinate, RouteActivity, Waypoint } from "@routess/core";
import { calculatePathDistance } from "@routess/core";
import type { CreateRouteRequest } from "@/lib/api";
import type { ParsedGpxFile } from "./GPXService";

export const routeNameFromImport = (gpxName: string | undefined, fileName: string | undefined): string => {
	const fromGpx = gpxName?.trim();
	if (fromGpx) return fromGpx;
	const fromFile = fileName?.replace(/\.[^.]+$/, "").trim();
	return fromFile || "Imported route";
};

/**
 * Builds a CreateRouteRequest from a parsed GPX file for direct save to the
 * library, bypassing the planner. Geometry comes from the track when present
 * (same persistence as a planner save); waypoints without a Type default to
 * routed, matching the draft import path for track-backed files.
 */
export const buildLibraryRoutePayload = (
	parsed: ParsedGpxFile,
	fileName: string | undefined,
	activity: RouteActivity | undefined,
): CreateRouteRequest => {
	const waypoints: Waypoint[] = (parsed.waypoints ?? []).map((wp) => ({
		coord: wp.coord,
		type: wp.type ?? "routed",
		...(wp.name ? { name: wp.name } : {}),
	}));
	const geometry = parsed.trackPoints && parsed.trackPoints.length >= 2 ? parsed.trackPoints : undefined;
	const distancePath: Coordinate[] = geometry ?? waypoints.map((wp) => wp.coord);
	return {
		name: routeNameFromImport(parsed.name, fileName),
		visibility: "private",
		waypoints,
		...(geometry ? { geometry } : {}),
		distance: Math.round(calculatePathDistance(distancePath) * 1000),
		...(activity ? { activity } : {}),
	};
};
