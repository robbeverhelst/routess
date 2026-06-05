import type { Waypoint, WaypointType } from "@routess/core";
import { selectSmartWaypoints } from "@routess/core";
import { checkNearRoad } from "@/features/routing/utils/RoutingUtils";
import { Logger } from "@/lib/logger";
import type { Coordinate } from "@/types/map";

const ROUTESS_GPX_NS = "https://routess.app/gpx/1";

const escapeXml = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");

// A waypoint as parsed from GPX. Type is present iff the source carried our
// extension; foreign GPX produces undefined and falls through to the
// road-proximity heuristic in processGPXWaypoints.
export interface ParsedGpxWaypoint {
	coord: Coordinate;
	type?: WaypointType;
	name?: string;
}

/**
 * Generates a GPX data string from waypoints and route path.
 * Embeds the Waypoint Type in a Routess-namespaced extension so round-trips
 * through this app preserve routed/direct semantics. Foreign tools ignore
 * unknown extensions cleanly.
 */
export const generateGPXString = (waypoints: Waypoint[], routePath: Coordinate[], name?: string): string => {
	const routeName = name?.trim() ? escapeXml(name.trim()) : "Exported Route";
	let gpxString = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Routess" xmlns="http://www.topografix.com/GPX/1/1" xmlns:routess="${ROUTESS_GPX_NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${routeName}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
`;

	if (waypoints.length > 0) {
		gpxString += `  <rte>\n    <name>${routeName}</name>\n`;
		waypoints.forEach((waypoint) => {
			const lat = waypoint.coord[1];
			const lon = waypoint.coord[0];
			gpxString += `    <rtept lat="${lat}" lon="${lon}">\n`;
			if (waypoint.name) {
				gpxString += `      <name>${escapeXml(waypoint.name)}</name>\n`;
			}
			gpxString += `      <extensions>\n`;
			gpxString += `        <routess:type>${waypoint.type}</routess:type>\n`;
			gpxString += `      </extensions>\n`;
			gpxString += `    </rtept>\n`;
		});
		gpxString += `  </rte>\n`;
	}

	if (routePath.length > 0) {
		gpxString += `  <trk>\n    <name>Calculated Route</name>\n    <trkseg>\n`;
		routePath.forEach((coord: Coordinate) => {
			const lat = coord[1];
			const lon = coord[0];
			gpxString += `      <trkpt lat="${lat}" lon="${lon}"></trkpt>\n`;
		});
		gpxString += `    </trkseg>\n  </trk>\n`;
	}

	gpxString += `</gpx>`;
	return gpxString;
};

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
export const parseGPXFile = async (
	gpxString: string,
): Promise<{
	waypoints?: ParsedGpxWaypoint[];
	trackPoints?: Coordinate[];
	error?: string;
}> => {
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

		if (rteptElements.length > 0) {
			const waypoints = rteptElements.map(parseRtept).filter((wp): wp is ParsedGpxWaypoint => wp !== null);

			if (waypoints.length === 0) {
				return { error: "Could not extract any valid waypoints from the GPX route points." };
			}

			if (trkptElements.length > 0) {
				const trackPoints = trkptElements.map(parseTrkpt).filter((c): c is Coordinate => c !== null);
				Logger.info(`[GPXService] Parsed ${waypoints.length} waypoints + ${trackPoints.length} track points.`);
				return { waypoints, trackPoints };
			}

			Logger.info(`[GPXService] Parsed ${waypoints.length} waypoints.`);
			return { waypoints };
		}

		if (trkptElements.length > 0) {
			const allTrackPoints = trkptElements.map(parseTrkpt).filter((c): c is Coordinate => c !== null);
			if (allTrackPoints.length === 0) {
				return { error: "Could not extract any valid track points from the GPX file." };
			}
			const smartCoords = selectSmartWaypoints(allTrackPoints);
			const waypoints: ParsedGpxWaypoint[] = smartCoords.map((coord) => ({ coord }));
			Logger.info(`[GPXService] Converted ${allTrackPoints.length} track points to ${waypoints.length} waypoints.`);
			return { waypoints };
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
