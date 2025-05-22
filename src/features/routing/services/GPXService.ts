// GPXService.ts - Handles GPX data parsing and generation. 

import type { Coordinate } from '@/types/map';
// Import checkNearRoad from RoutingUtils
import { checkNearRoad } from '@/features/routing/utils/RoutingUtils';
import { Logger } from '@/lib/logger';

/**
 * Generates a GPX data string from waypoints and a route path.
 * @param waypoints - An array of waypoints (coordinates).
 * @param routePath - An array of coordinates representing the calculated route path.
 * @returns A string containing the GPX data.
 */
export const generateGPXString = (waypoints: Coordinate[], routePath: Coordinate[]): string => {
  let gpxString = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="WebApp Route Planner" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Exported Route</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
`;

  if (waypoints.length > 0) {
    gpxString += `  <rte>
    <name>Planned Route Waypoints</name>
`;
    waypoints.forEach((waypoint: Coordinate, index: number) => {
      const lat = waypoint[1];
      const lon = waypoint[0];
      gpxString += `    <rtept lat="${lat}" lon="${lon}">
`;
      gpxString += `      <name>Waypoint ${index + 1}</name>
`;
      gpxString += `    </rtept>
`;
    });
    gpxString += `  </rte>
`;
  }

  if (routePath.length > 0) {
    gpxString += `  <trk>\n    <name>Tracked Path</name>\n    <trkseg>\n`;
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
 * Parses a GPX string and extracts waypoint coordinates.
 * @param gpxString - The GPX data as a string.
 * @returns A promise that resolves to an object containing extracted waypoints or an error message.
 */
export const parseGPXFile = async (gpxString: string): Promise<{ waypoints?: Coordinate[], error?: string }> => {
  // Check for DOMParser availability (browser environment)
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    Logger.error("[GPXService.parseGPXFile] DOMParser is not available. GPX parsing currently requires a browser environment.");
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

    const gpxCoords: Coordinate[] = [];
    const rteptElements = xmlDoc.getElementsByTagName("rtept");
    const trkptElements = xmlDoc.getElementsByTagName("trkpt");

    let pointsToParse: HTMLCollectionOf<Element>;

    if (rteptElements.length > 0) {
      pointsToParse = rteptElements;
      Logger.info(`[GPXService.parseGPXFile] Found ${rteptElements.length} <rtept> elements.`);
    } else if (trkptElements.length > 0) {
      pointsToParse = trkptElements;
      Logger.info(`[GPXService.parseGPXFile] Found ${trkptElements.length} <trkpt> elements.`);
    } else {
      Logger.warn("[GPXService.parseGPXFile] No <rtept> or <trkpt> elements found in GPX file.");
      return { error: "No route or track points found in the GPX file." };
    }

    for (let i = 0; i < pointsToParse.length; i++) {
      const latStr = pointsToParse[i].getAttribute("lat");
      const lonStr = pointsToParse[i].getAttribute("lon");
      if (latStr && lonStr) {
        const latNum = parseFloat(latStr);
        const lonNum = parseFloat(lonStr);
        if (!isNaN(lonNum) && !isNaN(latNum)) {
          gpxCoords.push([lonNum, latNum]);
        } else {
          Logger.warn(`[GPXService.parseGPXFile] Skipped invalid coordinate: lat='${latStr}', lon='${lonStr}'`);
        }
      }
    }

    if (gpxCoords.length === 0) {
      Logger.warn("[GPXService.parseGPXFile] No valid waypoints extracted from GPX.");
      return { error: "Could not extract any waypoints from the GPX file." };
    }
    
    Logger.info(`[GPXService.parseGPXFile] Successfully parsed ${gpxCoords.length} waypoints.`);
    return { waypoints: gpxCoords };

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
  accessToken: string
): Promise<{ finalWaypoints?: Coordinate[], finalDirectFlags?: boolean[], error?: string }> => {
  if (!gpxWaypoints || gpxWaypoints.length === 0) {
    return { error: "No waypoints provided for processing." };
  }

  try {
    Logger.info(`[GPXService.processGPXWaypoints] Checking road proximity for ${gpxWaypoints.length} points...`);
    const roadChecks = await Promise.all(
      gpxWaypoints.map(coord => checkNearRoad(coord, accessToken))
    );
    Logger.info("[GPXService.processGPXWaypoints] Road proximity checks complete.");

    const finalNewWaypoints: Coordinate[] = [];
    const newDirectFlags: boolean[] = [];

    gpxWaypoints.forEach((coord, index) => {
      finalNewWaypoints.push(coord);
      // If roadCheck is valid, it's NOT a direct point. If invalid/off-road, it IS a direct point.
      newDirectFlags.push(!(roadChecks[index]?.isValid));
    });

    Logger.info("[GPXService.processGPXWaypoints] Determined directFlags:", JSON.stringify(newDirectFlags));
    return { finalWaypoints: finalNewWaypoints, finalDirectFlags: newDirectFlags };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error during waypoint processing";
    Logger.error("[GPXService.processGPXWaypoints] Error processing GPX waypoints:", error);
    return { error: `Error processing GPX waypoints: ${errorMessage}` };
  }
}; 