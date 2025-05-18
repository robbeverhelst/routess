import type { Coordinate } from '@/types/map';
import { LngLatBounds, type Map as MapboxMap } from 'mapbox-gl';

/**
 * Calculates the distance between two coordinates using the Haversine formula.
 * @param c1 - The first coordinate [lon, lat].
 * @param c2 - The second coordinate [lon, lat].
 * @returns The distance in kilometers.
 */
export const haversine = (c1: Coordinate, c2: Coordinate): number => {
  const toRad = (v: number) => v * Math.PI / 180;
  const R = 6371; // Earth radius in kilometers
  const dLat = toRad(c2[1] - c1[1]);
  const dLon = toRad(c2[0] - c1[0]);
  const lat1 = toRad(c1[1]);
  const lat2 = toRad(c2[1]);

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Checks if a coordinate is near a road by querying the Mapbox Matching API.
 * @param coords - The coordinate to check [lon, lat].
 * @param accessToken - The Mapbox API access token.
 * @returns A promise that resolves to an object indicating if the point is valid (near a road)
 *          and the snapped coordinates if valid.
 */
export const checkNearRoad = async (
  coords: Coordinate,
  accessToken: string
): Promise<{ isValid: boolean; snappedCoords?: Coordinate }> => {
  try {
    // The Matching API requires at least two coordinates. For a single point check,
    // we can pass the same coordinate twice.
    const coordinatesParam = `${coords[0]},${coords[1]};${coords[0]},${coords[1]}`;
    // Radiuses: The API allows specifying search radiuses for each coordinate.
    // A smaller radius means the point must be closer to a road.
    // Using 49m as it was in the original code (though 50m is a common threshold for snapping).
    const radiusesParam = `49;49`; 
    const url = `https://api.mapbox.com/matching/v5/mapbox/walking/${coordinatesParam}?steps=true&geometries=geojson&access_token=${accessToken}&radiuses=${radiusesParam}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[checkNearRoad] Matching API request failed:', response.status, await response.text());
      return { isValid: false };
    }
    const json = await response.json();

    if (json && json.code === "Ok" && json.tracepoints && json.tracepoints.length > 0) {
      const snappedTracepoint = json.tracepoints[0];
      // A null tracepoint means no matching road segment was found within the radius.
      if (snappedTracepoint === null) {
        console.log('[checkNearRoad] Point is off-road (tracepoint is null).');
        return { isValid: false };
      }
      if (!snappedTracepoint.location) {
  console.log('[checkNearRoad] Tracepoint has no location – treating as off-road.');
  return { isValid: false };
}
const snappedCoords = snappedTracepoint.location as Coordinate;
      // Even if snapped, check Haversine distance as an additional guard or if radius logic is complex.
      // Original code had a 0.05 km (50m) check here too.
      const dist = haversine(coords, snappedCoords); // Calls local haversine
      
      if (dist > 0.05) { // 50 meters threshold
        console.log(`[checkNearRoad] Snapped point is too far (Distance: ${dist.toFixed(3)}km). Deeming off-road.`);
        return { isValid: false };
      }
      console.log(`[checkNearRoad] Point is on-road. Snapped from [${coords.join(',')}] to [${snappedCoords.join(',')}] Dist: ${dist.toFixed(3)}km`);
      return { isValid: true, snappedCoords };
    } else {
      console.warn('[checkNearRoad] Matching API did not return a successful result or tracepoints:', json.code, json.message);
      return { isValid: false }; // No match or error
    }
  } catch (error) {
    console.error('[checkNearRoad] Error calling Matching API:', error);
    // If fetch itself fails, console.timeEnd might not be reached for the fetch timer.
    // No specific timeEnd here, as the overall function duration might be more relevant for catch.
    return { isValid: false }; // Network error or other exception
  }
};

/**
 * Finds the closest point on a line segment to a given point.
 * @param p - The point [lon, lat] to find the closest point to.
 * @param v - The start point [lon, lat] of the line segment.
 * @param w - The end point [lon, lat] of the line segment.
 * @returns The closest point [lon, lat] on the segment to point p.
 */
export const closestPointOnSegment = (p: Coordinate, v: Coordinate, w: Coordinate): Coordinate => {
  // Note: haversine is not directly used here for finding the point, 
  // but this function is often used in conjunction with haversine 
  // to calculate the distance to this closest point.
  const l2 = (v[0] - w[0])**2 + (v[1] - w[1])**2; // Squared Euclidean distance
  if (l2 === 0) return v; // v and w are the same point

  // Calculate the projection of P onto the line VW
  // t = [(P - V) . (W - V)] / |W - V|^2
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;

  // Clamp t to the range [0, 1] to ensure the point is on the segment
  t = Math.max(0, Math.min(1, t));

  // Calculate the closest point: V + t * (W - V)
  return [
    v[0] + t * (w[0] - v[0]),
    v[1] + t * (w[1] - v[1])
  ];
};

/**
 * Fits the map view to a given set of coordinates.
 * @param map - The Mapbox map instance.
 * @param coordinates - An array of coordinates to fit the bounds to.
 */
export const zoomToRoute = (map: MapboxMap, coordinates: Coordinate[]): void => {
  if (!map || !map.getBounds || !coordinates || coordinates.length === 0) {
    console.warn('[RoutingUtils.zoomToRoute] Map not ready or no coordinates to zoom to.');
    return;
  }

  try {
    const currentPitch = map.getPitch();
    const currentBearing = map.getBearing();

    const bounds = coordinates.reduce(
      (currentBounds, coord) => {
        return currentBounds.extend(coord);
      },
      new LngLatBounds(coordinates[0], coordinates[0]) // Initialize with the first coordinate
    );

    map.fitBounds(bounds, {
      padding: { top:70, bottom: 70, left: 70, right: 70 },       // Adjusted padding (pixels)
      maxZoom: 16,
      duration: 1000,    // Animation duration in milliseconds
      essential: true,   // Ensures the animation completes
      pitch: currentPitch,      // Preserve current pitch
      bearing: currentBearing   // Preserve current bearing
    });
    console.log('[RoutingUtils.zoomToRoute] Adjusted map bounds, preserving pitch and bearing.');
  } catch (error) {
    console.error('[RoutingUtils.zoomToRoute] Error fitting bounds:', error);
  }
}; 