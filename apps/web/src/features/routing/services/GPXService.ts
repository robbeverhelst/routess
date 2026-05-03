import type { Waypoint } from "@routess/core";
import { selectSmartWaypoints } from "@routess/core";
import { setCurrentRoutePath } from "@/features/routing/services/RouteCalculationService";
import { checkNearRoad } from "@/features/routing/utils/RoutingUtils";
import { Logger } from "@/lib/logger";
import type { Coordinate } from "@/types/map";

// Re-export the heuristic so callers that imported it from GPXService keep working.
export const convertTrackToSmartWaypoints = (trackPoints: Coordinate[]): Coordinate[] => selectSmartWaypoints(trackPoints);

/**
 * Generates a GPX data string from waypoints and route path.
 * Exports both waypoints (for editing) and track (for exact route display).
 * @param waypoints - An array of waypoint coordinates for editing.
 * @param routePath - An array of coordinates representing the calculated route path.
 * @returns A string containing the GPX data.
 */
export const generateGPXString = (waypoints: Waypoint[], routePath: Coordinate[]): string => {
	let gpxString = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="WebApp Route Planner" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Exported Route</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
`;

	if (waypoints.length > 0) {
		gpxString += `  <rte>\n    <name>Route Waypoints</name>\n`;
		waypoints.forEach((waypoint, index) => {
			const lat = waypoint.coord[1];
			const lon = waypoint.coord[0];
			gpxString += `    <rtept lat="${lat}" lon="${lon}">\n`;
			gpxString += `      <name>Waypoint ${index + 1}</name>\n`;
			gpxString += `    </rtept>\n`;
		});
		gpxString += `  </rte>\n`;
	}

	// Export the exact calculated route path for precise display
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

/**
 * Parses a GPX string and extracts waypoints and optional track points.
 * If both route points and track points exist, returns both for hybrid editing/display.
 * If only track points exist, converts them to smart waypoints for editing.
 * @param gpxString - The GPX data as a string.
 * @returns A promise that resolves to an object containing waypoints, optional trackPoints, or an error message.
 */
export const parseGPXFile = async (
	gpxString: string,
): Promise<{
	waypoints?: Coordinate[];
	trackPoints?: Coordinate[];
	error?: string;
}> => {
	// Check for DOMParser availability (browser environment)
	if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
		Logger.error(
			"[GPXService.parseGPXFile] DOMParser is not available. GPX parsing currently requires a browser environment.",
		);
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

		const rteptElements = xmlDoc.getElementsByTagName("rtept");
		const trkptElements = xmlDoc.getElementsByTagName("trkpt");

		if (rteptElements.length > 0) {
			// Use route points as waypoints (preferred approach)
			Logger.info(`[GPXService.parseGPXFile] Found ${rteptElements.length} <rtept> elements, using as waypoints.`);
			const waypoints: Coordinate[] = [];

			for (let i = 0; i < rteptElements.length; i++) {
				const latStr = rteptElements[i].getAttribute("lat");
				const lonStr = rteptElements[i].getAttribute("lon");
				if (latStr && lonStr) {
					const latNum = parseFloat(latStr);
					const lonNum = parseFloat(lonStr);
					if (!Number.isNaN(lonNum) && !Number.isNaN(latNum)) {
						waypoints.push([lonNum, latNum]);
					} else {
						Logger.warn(`[GPXService.parseGPXFile] Skipped invalid route point: lat='${latStr}', lon='${lonStr}'`);
					}
				}
			}

			if (waypoints.length === 0) {
				Logger.warn("[GPXService.parseGPXFile] No valid waypoints extracted from route points.");
				return { error: "Could not extract any valid waypoints from the GPX route points." };
			}

			// Check if we also have track points for exact route display
			if (trkptElements.length > 0) {
				Logger.info(
					`[GPXService.parseGPXFile] Also found ${trkptElements.length} track points for exact route display.`,
				);
				const trackPoints: Coordinate[] = [];
				for (let i = 0; i < trkptElements.length; i++) {
					const latStr = trkptElements[i].getAttribute("lat");
					const lonStr = trkptElements[i].getAttribute("lon");
					if (latStr && lonStr) {
						const latNum = parseFloat(latStr);
						const lonNum = parseFloat(lonStr);
						if (!Number.isNaN(lonNum) && !Number.isNaN(latNum)) {
							trackPoints.push([lonNum, latNum]);
						}
					}
				}

				Logger.info(
					`[GPXService.parseGPXFile] Successfully parsed ${waypoints.length} waypoints and ${trackPoints.length} track points.`,
				);
				return { waypoints, trackPoints };
			}

			Logger.info(`[GPXService.parseGPXFile] Successfully parsed ${waypoints.length} waypoints from route points.`);
			return { waypoints };
		} else if (trkptElements.length > 0) {
			// Import track points and convert to smart waypoints for editing
			Logger.info(
				`[GPXService.parseGPXFile] Found ${trkptElements.length} <trkpt> elements, converting to smart waypoints.`,
			);

			const allTrackPoints: Coordinate[] = [];
			for (let i = 0; i < trkptElements.length; i++) {
				const latStr = trkptElements[i].getAttribute("lat");
				const lonStr = trkptElements[i].getAttribute("lon");
				if (latStr && lonStr) {
					const latNum = parseFloat(latStr);
					const lonNum = parseFloat(lonStr);
					if (!Number.isNaN(lonNum) && !Number.isNaN(latNum)) {
						allTrackPoints.push([lonNum, latNum]);
					}
				}
			}

			if (allTrackPoints.length === 0) {
				Logger.warn("[GPXService.parseGPXFile] No valid track points extracted from GPX.");
				return { error: "Could not extract any valid track points from the GPX file." };
			}

			// Convert track points to smart waypoints
			const smartWaypoints = convertTrackToSmartWaypoints(allTrackPoints);

			Logger.info(
				`[GPXService.parseGPXFile] Successfully converted ${allTrackPoints.length} track points to ${smartWaypoints.length} smart waypoints.`,
			);
			return { waypoints: smartWaypoints };
		} else {
			Logger.warn("[GPXService.parseGPXFile] No <rtept> or <trkpt> elements found in GPX file.");
			return { error: "No route or track points found in the GPX file." };
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error during GPX parsing";
		Logger.error("[GPXService.parseGPXFile] Error parsing GPX:", error);
		return { error: `Error parsing GPX: ${errorMessage}` };
	}
};

/**
 * Processes raw GPX waypoints to check their proximity to roads and determine direct flags.
 * @param gpxWaypoints - An array of raw waypoint coordinates parsed from a GPX file.
 * @param accessToken - The Mapbox access token for API calls.
 * @returns A promise that resolves to an object containing final waypoints and their direct flags, or an error.
 */
export const processGPXWaypoints = async (
	gpxWaypoints: Coordinate[],
	accessToken: string,
): Promise<{ finalWaypoints?: Waypoint[]; error?: string }> => {
	if (!gpxWaypoints || gpxWaypoints.length === 0) {
		return { error: "No waypoints provided for processing." };
	}

	try {
		Logger.info(`[GPXService.processGPXWaypoints] Checking road proximity for ${gpxWaypoints.length} points...`);
		const roadChecks = await Promise.all(gpxWaypoints.map((coord) => checkNearRoad(coord, accessToken)));
		Logger.info("[GPXService.processGPXWaypoints] Road proximity checks complete.");

		const finalWaypoints: Waypoint[] = gpxWaypoints.map((coord, index) => ({
			coord,
			type: roadChecks[index]?.isValid ? "routed" : "direct",
		}));

		return { finalWaypoints };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error during waypoint processing";
		Logger.error("[GPXService.processGPXWaypoints] Error processing GPX waypoints:", error);
		return { error: `Error processing GPX waypoints: ${errorMessage}` };
	}
};

/**
 * Processes hybrid GPX data with both waypoints and track points.
 * Sets the track points directly as the route path for exact display.
 * For hybrid imports, waypoints are set as non-direct to avoid drawing connecting lines.
 * @param waypoints - Waypoint coordinates for editing.
 * @param trackPoints - Track point coordinates for exact route display.
 * @returns A promise that resolves to processed waypoints and flags, with track points set as route path.
 */
export const processHybridGPXData = async (
	waypoints: Coordinate[],
	trackPoints: Coordinate[],
): Promise<{ finalWaypoints?: Waypoint[]; error?: string }> => {
	try {
		Logger.info(
			`[GPXService.processHybridGPXData] Processing hybrid GPX: ${waypoints.length} waypoints, ${trackPoints.length} track points.`,
		);

		setCurrentRoutePath(trackPoints);
		Logger.info(`[GPXService.processHybridGPXData] Set ${trackPoints.length} track points as exact route path.`);

		const finalWaypoints: Waypoint[] = waypoints.map((coord) => ({ coord, type: "routed" }));
		return { finalWaypoints };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error during hybrid GPX processing";
		Logger.error("[GPXService.processHybridGPXData] Error processing hybrid GPX data:", error);
		return { error: `Error processing hybrid GPX data: ${errorMessage}` };
	}
};
