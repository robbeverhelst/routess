// GPXService.ts - Handles GPX data parsing and generation. 

import type { Coordinate } from '@/types/map';
// Import checkNearRoad from RoutingUtils
import { checkNearRoad } from '@/features/routing/utils/RoutingUtils';
import { Logger } from '@/lib/logger';

// Import RouteCalculationService to set track points directly
import { setCurrentRoutePath } from '@/features/routing/services/RouteCalculationService';

// Helper function to calculate bearing between two coordinates
function calculateBearing(coord1: Coordinate, coord2: Coordinate): number {
  const lat1 = coord1[1] * Math.PI / 180;
  const lat2 = coord2[1] * Math.PI / 180;
  const deltaLon = (coord2[0] - coord1[0]) * Math.PI / 180;
  
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
}

// Helper function to calculate distance between coordinates (Haversine formula)
function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371; // Earth's radius in kilometers
  const lat1 = coord1[1] * Math.PI / 180;
  const lat2 = coord2[1] * Math.PI / 180;
  const deltaLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const deltaLon = (coord2[0] - coord1[0]) * Math.PI / 180;

  const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in kilometers
}

// Helper function to calculate angle difference between two bearings
function angleDifference(bearing1: number, bearing2: number): number {
  let diff = Math.abs(bearing1 - bearing2);
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

/**
 * Converts track points to smart waypoints by detecting significant points
 * @param trackPoints - Array of track coordinates
 * @returns Array of significant waypoints
 */
export function convertTrackToSmartWaypoints(trackPoints: Coordinate[]): Coordinate[] {
  if (trackPoints.length < 2) {
    return trackPoints;
  }

  const waypoints: Coordinate[] = [];
  const minDirectionChangeThreshold = 30; // degrees
  const maxDistanceInterval = 2.0; // kilometers
  const minDistanceBetweenWaypoints = 0.1; // kilometers (100m minimum)
  
  // Always include start point
  waypoints.push(trackPoints[0]);
  let lastWaypointIndex = 0;
  let cumulativeDistance = 0;

  Logger.info(`[GPXService.convertTrackToSmartWaypoints] Processing ${trackPoints.length} track points...`);

  for (let i = 1; i < trackPoints.length - 1; i++) {
    const currentPoint = trackPoints[i];
    const prevPoint = trackPoints[i - 1];
    const lastWaypoint = trackPoints[lastWaypointIndex];

    // Calculate distance from last waypoint
    const distanceFromLastWaypoint = calculateDistance(lastWaypoint, currentPoint);
    const segmentDistance = calculateDistance(prevPoint, currentPoint);
    cumulativeDistance += segmentDistance;

    // Skip if too close to last waypoint
    if (distanceFromLastWaypoint < minDistanceBetweenWaypoints) {
      continue;
    }

    let shouldAddWaypoint = false;
    let reason = '';

    // Check for significant direction change
    if (i >= 2 && i < trackPoints.length - 2) {
      // Look at a wider window for more stable bearing calculation
      const windowSize = Math.min(3, Math.floor(trackPoints.length / 20));
      const beforeIndex = Math.max(0, i - windowSize);
      const afterIndex = Math.min(trackPoints.length - 1, i + windowSize);
      
      const bearingBefore = calculateBearing(trackPoints[beforeIndex], currentPoint);
      const bearingAfter = calculateBearing(currentPoint, trackPoints[afterIndex]);
      const directionChange = angleDifference(bearingBefore, bearingAfter);

      if (directionChange >= minDirectionChangeThreshold) {
        shouldAddWaypoint = true;
        reason = `direction change (${directionChange.toFixed(1)}°)`;
      }
    }

    // Check for distance interval
    if (cumulativeDistance >= maxDistanceInterval) {
      shouldAddWaypoint = true;
      reason = reason ? `${reason} + distance interval` : 'distance interval';
      cumulativeDistance = 0; // Reset cumulative distance
    }

    // Check for elevation change (if available in future)
    // This could be added later if GPX files include elevation data

    if (shouldAddWaypoint) {
      waypoints.push(currentPoint);
      lastWaypointIndex = i;
      Logger.debug(`[GPXService.convertTrackToSmartWaypoints] Added waypoint ${waypoints.length} at index ${i}: ${reason}`);
    }
  }

  // Always include end point (if different from last waypoint)
  const lastPoint = trackPoints[trackPoints.length - 1];
  const lastWaypoint = waypoints[waypoints.length - 1];
  const distanceToEnd = calculateDistance(lastWaypoint, lastPoint);
  
  if (distanceToEnd >= minDistanceBetweenWaypoints) {
    waypoints.push(lastPoint);
  }

  // Ensure we don't have too many waypoints (cap at 15 for usability)
  if (waypoints.length > 15) {
    Logger.info(`[GPXService.convertTrackToSmartWaypoints] Too many waypoints (${waypoints.length}), reducing to 15...`);
    const reducedWaypoints = [waypoints[0]]; // Always keep start
    
    // Keep evenly distributed waypoints from the middle
    const step = Math.max(1, Math.floor((waypoints.length - 2) / 13)); // -2 for start/end, 13 for middle points
    for (let i = step; i < waypoints.length - 1; i += step) {
      if (reducedWaypoints.length < 14) { // Leave room for end point
        reducedWaypoints.push(waypoints[i]);
      }
    }
    
    reducedWaypoints.push(waypoints[waypoints.length - 1]); // Always keep end
    Logger.info(`[GPXService.convertTrackToSmartWaypoints] Reduced to ${reducedWaypoints.length} waypoints`);
    return reducedWaypoints;
  }

  Logger.info(`[GPXService.convertTrackToSmartWaypoints] Generated ${waypoints.length} smart waypoints from ${trackPoints.length} track points`);
  return waypoints;
}

/**
 * Generates a GPX data string from waypoints and route path.
 * Exports both waypoints (for editing) and track (for exact route display).
 * @param waypoints - An array of waypoint coordinates for editing.
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

  // Export waypoints for editing capability
  if (waypoints.length > 0) {
    gpxString += `  <rte>\n    <name>Route Waypoints</name>\n`;
    waypoints.forEach((waypoint: Coordinate, index: number) => {
      const lat = waypoint[1];
      const lon = waypoint[0];
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
export const parseGPXFile = async (gpxString: string): Promise<{ 
  waypoints?: Coordinate[], 
  trackPoints?: Coordinate[],
  error?: string 
}> => {
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
          if (!isNaN(lonNum) && !isNaN(latNum)) {
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
        Logger.info(`[GPXService.parseGPXFile] Also found ${trkptElements.length} track points for exact route display.`);
        const trackPoints: Coordinate[] = [];
        for (let i = 0; i < trkptElements.length; i++) {
          const latStr = trkptElements[i].getAttribute("lat");
          const lonStr = trkptElements[i].getAttribute("lon");
          if (latStr && lonStr) {
            const latNum = parseFloat(latStr);
            const lonNum = parseFloat(lonStr);
            if (!isNaN(lonNum) && !isNaN(latNum)) {
              trackPoints.push([lonNum, latNum]);
            }
          }
        }
        
        Logger.info(`[GPXService.parseGPXFile] Successfully parsed ${waypoints.length} waypoints and ${trackPoints.length} track points.`);
        return { waypoints, trackPoints };
      }
      
      Logger.info(`[GPXService.parseGPXFile] Successfully parsed ${waypoints.length} waypoints from route points.`);
      return { waypoints };
      
    } else if (trkptElements.length > 0) {
      // Import track points and convert to smart waypoints for editing
      Logger.info(`[GPXService.parseGPXFile] Found ${trkptElements.length} <trkpt> elements, converting to smart waypoints.`);
      
      const allTrackPoints: Coordinate[] = [];
      for (let i = 0; i < trkptElements.length; i++) {
        const latStr = trkptElements[i].getAttribute("lat");
        const lonStr = trkptElements[i].getAttribute("lon");
        if (latStr && lonStr) {
          const latNum = parseFloat(latStr);
          const lonNum = parseFloat(lonStr);
          if (!isNaN(lonNum) && !isNaN(latNum)) {
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
      
      Logger.info(`[GPXService.parseGPXFile] Successfully converted ${allTrackPoints.length} track points to ${smartWaypoints.length} smart waypoints.`);
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
  trackPoints: Coordinate[]
): Promise<{ finalWaypoints?: Coordinate[], finalDirectFlags?: boolean[], error?: string }> => {
  try {
    Logger.info(`[GPXService.processHybridGPXData] Processing hybrid GPX: ${waypoints.length} waypoints, ${trackPoints.length} track points.`);
    
    // Set the track points directly as the current route path for exact display
    setCurrentRoutePath(trackPoints);
    Logger.info(`[GPXService.processHybridGPXData] Set ${trackPoints.length} track points as exact route path.`);
    
    // For hybrid imports, we don't want to draw direct lines between waypoints
    // since we already have the exact track path. Set all waypoints as non-direct.
    const finalWaypoints = waypoints;
    const finalDirectFlags = new Array(waypoints.length).fill(false);
    
    Logger.info(`[GPXService.processHybridGPXData] Successfully processed hybrid GPX data. All waypoints set as non-direct to avoid line drawing.`);
    return { finalWaypoints, finalDirectFlags };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error during hybrid GPX processing";
    Logger.error("[GPXService.processHybridGPXData] Error processing hybrid GPX data:", error);
    return { error: `Error processing hybrid GPX data: ${errorMessage}` };
  }
}; 