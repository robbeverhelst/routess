import type { Waypoint, WaypointType } from "@routess/core";
import { selectSmartWaypoints } from "@routess/core";
import { checkNearRoad } from "@/features/routing/utils/RoutingUtils";
import { Logger } from "@/lib/logger";
import type { Coordinate } from "@/types/map";

const ROUTESS_GPX_NS = "https://routess.app/gpx/1";

// A waypoint as parsed from a GPX file. `type` is optional because it comes
// from our own namespaced extension, which other writers do not emit.
type ParsedGpxWaypoint = Omit<Waypoint, "type"> & { type?: WaypointType };

const readWaypointType = (rtept: Element): WaypointType | undefined => {
	const extensions = rtept.getElementsByTagName("extensions");
	for (let i = 0; i < extensions.length; i++) {
		const nsMatches = extensions[i].getElementsByTagNameNS(ROUTESS_GPX_NS, "type");
		const typeEl = nsMatches.length > 0 ? nsMatches[0] : extensions[i].getElementsByTagName("routess:type")[0];
		const value = typeEl?.textContent?.trim();
		if (value === "routed" || value === "direct") return value;
	}
	return undefined;
};

const parseRtept = (rtept: Element): ParsedGpxWaypoint | null => {
	const latStr = rtept.getAttribute("lat");
	const lonStr = rtept.getAttribute("lon");
	if (!latStr || !lonStr) return null;
	const lat = parseFloat(latStr);
	const lon = parseFloat(lonStr);
	if (Number.isNaN(lat) || Number.isNaN(lon)) {
		Logger.warn(`[GPXService] Skipped invalid route point: lat='${latStr}', lon='${lonStr}'`);
		return null;
	}
	const nameEl = rtept.getElementsByTagName("name")[0];
	const name = nameEl?.textContent?.trim();
	const type = readWaypointType(rtept);
	return { coord: [lon, lat], ...(type ? { type } : {}), ...(name ? { name } : {}) };
};

// Direct-child lookup: rte.getElementsByTagName("name") would also match
// rtept names, so only immediate children count.
const directChildText = (parent: Element | undefined, tagName: string): string | undefined => {
	if (!parent) return undefined;
	for (let i = 0; i < parent.children.length; i++) {
		if (parent.children[i].tagName === tagName) return parent.children[i].textContent?.trim() || undefined;
	}
	return undefined;
};

const readRouteName = (xmlDoc: Document): string | undefined =>
	directChildText(xmlDoc.getElementsByTagName("metadata")[0], "name") ??
	directChildText(xmlDoc.getElementsByTagName("rte")[0], "name") ??
	directChildText(xmlDoc.getElementsByTagName("trk")[0], "name");

const parseTrkpt = (trkpt: Element): Coordinate | null => {
	const latStr = trkpt.getAttribute("lat");
	const lonStr = trkpt.getAttribute("lon");
	if (!latStr || !lonStr) return null;
	const lat = parseFloat(latStr);
	const lon = parseFloat(lonStr);
	if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
	return [lon, lat];
};

/**
 * Parses a GPX string. When the file was written by Routess, each rtept carries
 * a routess:type extension that is read directly. Foreign files leave Type
 * undefined; processGPXWaypoints falls back to a road-proximity heuristic.
 */
export interface ParsedGpxFile {
	waypoints?: ParsedGpxWaypoint[];
	trackPoints?: Coordinate[];
	name?: string;
	// True when the file had no rtepts and waypoints were thinned out of the
	// track, so they are synthetic control points rather than authored stops.
	waypointsDerivedFromTrack?: boolean;
	error?: string;
}

export const parseGPXFile = async (gpxString: string): Promise<ParsedGpxFile> => {
	if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
		Logger.error("[GPXService.parseGPXFile] DOMParser is not available.");
		return { error: "GPX parsing is not available in this environment. DOMParser not found." };
	}

	try {
		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(gpxString, "application/xml");

		const parserError = xmlDoc.getElementsByTagName("parsererror");
		if (parserError.length > 0) {
			const errorContent = parserError[0].textContent || "Unknown XML parsing error";
			Logger.error("[GPXService.parseGPXFile] Error parsing GPX XML:", errorContent);
			return { error: `Invalid GPX file: ${errorContent}` };
		}

		const rteptElements = Array.from(xmlDoc.getElementsByTagName("rtept"));
		const trkptElements = Array.from(xmlDoc.getElementsByTagName("trkpt"));
		const name = readRouteName(xmlDoc);
		const named = name ? { name } : {};

		if (rteptElements.length > 0) {
			const waypoints = rteptElements.map(parseRtept).filter((wp): wp is ParsedGpxWaypoint => wp !== null);

			if (waypoints.length === 0) {
				return { error: "Could not extract any valid waypoints from the GPX route points." };
			}

			if (trkptElements.length > 0) {
				const trackPoints = trkptElements.map(parseTrkpt).filter((c): c is Coordinate => c !== null);
				Logger.info(`[GPXService] Parsed ${waypoints.length} waypoints + ${trackPoints.length} track points.`);
				return { waypoints, trackPoints, ...named };
			}

			Logger.info(`[GPXService] Parsed ${waypoints.length} waypoints.`);
			return { waypoints, ...named };
		}

		if (trkptElements.length > 0) {
			const allTrackPoints = trkptElements.map(parseTrkpt).filter((c): c is Coordinate => c !== null);
			if (allTrackPoints.length === 0) {
				return { error: "Could not extract any valid track points from the GPX file." };
			}
			const smartCoords = selectSmartWaypoints(allTrackPoints);
			const waypoints: ParsedGpxWaypoint[] = smartCoords.map((coord) => ({ coord }));
			Logger.info(`[GPXService] Converted ${allTrackPoints.length} track points to ${waypoints.length} waypoints.`);
			return { waypoints, trackPoints: allTrackPoints, waypointsDerivedFromTrack: true, ...named };
		}

		return { error: "No route or track points found in the GPX file." };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error during GPX parsing";
		Logger.error("[GPXService.parseGPXFile] Error parsing GPX:", error);
		return { error: `Error parsing GPX: ${errorMessage}` };
	}
};

// One Matching API request per waypoint, so a long rtept list would otherwise
// fire hundreds of parallel fetches and get rate limited, which used to
// degrade the whole import to direct (straight) legs.
const ROAD_CHECK_CONCURRENCY = 6;

const mapWithConcurrency = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
	const results = new Array<R>(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await fn(items[index]);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
};

/**
 * Materializes ParsedGpxWaypoint[] into Waypoint[]. Waypoints carrying a Type
 * from the source GPX (Routess extension) keep it; waypoints without Type fall
 * back to a road-proximity heuristic. Only a definite off-road verdict yields
 * "direct". When the road check cannot answer, the waypoint stays "routed":
 * downgrading on an API failure turns a whole imported route into straight
 * lines.
 */
export const processGPXWaypoints = async (
	parsed: ParsedGpxWaypoint[],
	accessToken: string,
): Promise<{ finalWaypoints?: Waypoint[]; error?: string }> => {
	if (!parsed || parsed.length === 0) {
		return { error: "No waypoints provided for processing." };
	}

	try {
		const finalWaypoints: Waypoint[] = await mapWithConcurrency(parsed, ROAD_CHECK_CONCURRENCY, async (wp) => {
			if (wp.type) {
				return { coord: wp.coord, type: wp.type, ...(wp.name ? { name: wp.name } : {}) };
			}
			const check = await checkNearRoad(wp.coord, accessToken);
			const offRoad = check ? !check.isValid && !check.unavailable : false;
			return {
				coord: wp.coord,
				type: offRoad ? "direct" : "routed",
				...(wp.name ? { name: wp.name } : {}),
			};
		});

		return { finalWaypoints };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error during waypoint processing";
		Logger.error("[GPXService.processGPXWaypoints] Error processing GPX waypoints:", error);
		return { error: `Error processing GPX waypoints: ${errorMessage}` };
	}
};
