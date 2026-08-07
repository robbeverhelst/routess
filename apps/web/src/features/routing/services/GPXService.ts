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
	// track. The draft flow then re-routes via the road-proximity heuristic
	// instead of pinning the raw track as exact geometry.
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

/**
 * Materializes ParsedGpxWaypoint[] into Waypoint[]. Waypoints carrying a Type
 * from the source GPX (Routess extension) keep it; waypoints without Type fall
 * back to a road-proximity heuristic.
 */
export const processGPXWaypoints = async (
	parsed: ParsedGpxWaypoint[],
	accessToken: string,
): Promise<{ finalWaypoints?: Waypoint[]; error?: string }> => {
	if (!parsed || parsed.length === 0) {
		return { error: "No waypoints provided for processing." };
	}

	try {
		const finalWaypoints: Waypoint[] = await Promise.all(
			parsed.map(async (wp) => {
				if (wp.type) {
					return { coord: wp.coord, type: wp.type, ...(wp.name ? { name: wp.name } : {}) };
				}
				const check = await checkNearRoad(wp.coord, accessToken);
				return {
					coord: wp.coord,
					type: check?.isValid ? "routed" : "direct",
					...(wp.name ? { name: wp.name } : {}),
				};
			}),
		);

		return { finalWaypoints };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error during waypoint processing";
		Logger.error("[GPXService.processGPXWaypoints] Error processing GPX waypoints:", error);
		return { error: `Error processing GPX waypoints: ${errorMessage}` };
	}
};
