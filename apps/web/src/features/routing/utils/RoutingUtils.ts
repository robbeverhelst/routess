import type { Coordinate } from "@routess/core";
import { haversineDistance } from "@routess/core";
import { LngLat, LngLatBounds, type Map as MapboxMap } from "mapbox-gl";
import { Logger } from "@/lib/logger";

/**
 * Checks if a coordinate is near a road by querying the Mapbox Matching API.
 * @param coords - The coordinate to check [lon, lat].
 * @param accessToken - The Mapbox API access token.
 * @param searchRadiusMeters - The search radius in meters (default is 49m).
 * @returns A promise that resolves to an object indicating if the point is valid (near a road)
 *          and the snapped coordinates if valid.
 */
export const checkNearRoad = async (
	coords: Coordinate,
	accessToken: string,
	searchRadiusMeters: number = 49, // Reverted to 49m default
): Promise<{ isValid: boolean; snappedCoords?: Coordinate }> => {
	try {
		const MAX_MATCHING_API_RADIUS = 49; // Max radius for Mapbox Matching API based on error
		const effectiveRadius = Math.max(1, Math.min(searchRadiusMeters, MAX_MATCHING_API_RADIUS));
		const coordinatesParam = `${coords[0]},${coords[1]};${coords[0]},${coords[1]}`;
		const radiusesParam = `${effectiveRadius};${effectiveRadius}`; // This will now be <= 49
		const url = `https://api.mapbox.com/matching/v5/mapbox/walking/${coordinatesParam}?steps=true&geometries=geojson&access_token=${accessToken}&radiuses=${radiusesParam}`;

		const response = await fetch(url);
		if (!response.ok) {
			Logger.error("[checkNearRoad] Matching API request failed:", response.status, await response.text());
			return { isValid: false };
		}
		const json = await response.json();

		if (json && json.code === "Ok" && json.tracepoints && json.tracepoints.length > 0) {
			const snappedTracepoint = json.tracepoints[0];
			// A null tracepoint means no matching road segment was found within the radius.
			if (snappedTracepoint === null) {
				Logger.info("[checkNearRoad] Point is off-road (tracepoint is null).");
				return { isValid: false };
			}
			if (!snappedTracepoint.location) {
				Logger.info("[checkNearRoad] Tracepoint has no location – treating as off-road.");
				return { isValid: false };
			}
			const snappedCoords = snappedTracepoint.location as Coordinate;
			const dist = haversineDistance(coords, snappedCoords);

			// Use the effectiveRadius (converted to km) for the distance check
			if (dist > effectiveRadius / 1000 + 0.001) {
				// Add 1m tolerance to haversine check vs radius
				Logger.info(
					`[checkNearRoad] Snapped point is too far (Dist: ${dist.toFixed(3)}km, Radius: ${effectiveRadius}m). Deeming off-road.`,
				);
				return { isValid: false };
			}
			Logger.info(
				`[checkNearRoad] Point is on-road (Radius: ${effectiveRadius}m). Snapped from [${coords.join(",")}] to [${snappedCoords.join(",")}] Dist: ${dist.toFixed(3)}km`,
			);
			return { isValid: true, snappedCoords };
		} else {
			Logger.warn(
				"[checkNearRoad] Matching API did not return a successful result or tracepoints:",
				json.code,
				json.message,
			);
			return { isValid: false }; // No match or error
		}
	} catch (error) {
		Logger.error("[checkNearRoad] Error calling Matching API:", error);
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
	const l2 = (v[0] - w[0]) ** 2 + (v[1] - w[1]) ** 2; // Squared Euclidean distance
	if (l2 === 0) return v; // v and w are the same point

	// Calculate the projection of P onto the line VW
	// t = [(P - V) . (W - V)] / |W - V|^2
	let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;

	// Clamp t to the range [0, 1] to ensure the point is on the segment
	t = Math.max(0, Math.min(1, t));

	// Calculate the closest point: V + t * (W - V)
	return [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
};

/**
 * Fits the map view to a given set of coordinates.
 * @param map - The Mapbox map instance.
 * @param coordinates - An array of coordinates to fit the bounds to.
 */
export const zoomToRoute = (map: MapboxMap, coordinates: Coordinate[]): void => {
	if (!map?.getBounds || !coordinates || coordinates.length === 0) {
		Logger.warn("[RoutingUtils.zoomToRoute] Map not ready or no coordinates to zoom to.");
		return;
	}

	// Add a check to see if the map is currently animating
	if (map.isEasing()) {
		Logger.info("[RoutingUtils.zoomToRoute] Map is currently easing, skipping zoom.");
		return;
	}

	try {
		const currentPitch = map.getPitch();
		const currentBearing = map.getBearing();

		const bounds = coordinates.reduce(
			(currentBounds, coord) => {
				return currentBounds.extend(coord);
			},
			new LngLatBounds(coordinates[0], coordinates[0]), // Initialize with the first coordinate
		);

		// Calculate the camera options that would result from fitBounds
		const camera = map.cameraForBounds(bounds, {
			padding: { top: 70, bottom: 70, left: 70, right: 70 },
			maxZoom: 16,
		});

		// Get the map's current camera position
		const currentCenter = map.getCenter();
		const currentZoom = map.getZoom();

		// Define a tolerance for comparison (adjust as needed)
		const centerTolerance = 0.001; // degrees
		const zoomTolerance = 0.1; // zoom levels

		// Check if the calculated camera position is very close to the current one
		if (camera?.center && typeof camera.zoom === "number") {
			// Convert camera.center to LngLat object for reliable access to lng/lat
			const cameraCenterLngLat = LngLat.convert(camera.center);
			const centerDiff =
				Math.abs(cameraCenterLngLat.lng - currentCenter.lng) + Math.abs(cameraCenterLngLat.lat - currentCenter.lat);
			const zoomDiff = Math.abs(camera.zoom - currentZoom);

			if (centerDiff < centerTolerance && zoomDiff < zoomTolerance) {
				Logger.info(
					"[RoutingUtils.zoomToRoute] Map view is already close to optimal for the route, skipping zoom animation.",
				);
				return; // Skip the fitBounds call
			}
		}

		map.fitBounds(bounds, {
			padding: { top: 70, bottom: 70, left: 70, right: 70 }, // Adjusted padding (pixels)
			maxZoom: 16,
			duration: 1000, // Animation duration in milliseconds
			essential: true, // Ensures the animation completes
			pitch: currentPitch, // Preserve current pitch
			bearing: currentBearing, // Preserve current bearing
		});
		Logger.info("[RoutingUtils.zoomToRoute] Adjusted map bounds, preserving pitch and bearing.");
	} catch (error) {
		Logger.error("[RoutingUtils.zoomToRoute] Error fitting bounds:", error);
	}
};

/**
 * Calculates the bounding box of a list of coordinates.
 * @param coordinates An array of coordinates [longitude, latitude].
 * @returns An object with minLng, minLat, maxLng, maxLat, or null if input is empty.
 */
export interface BoundingBox {
	minLng: number;
	minLat: number;
	maxLng: number;
	maxLat: number;
}

export function calculateBoundingBox(coordinates: Coordinate[]): BoundingBox | null {
	if (!coordinates || coordinates.length === 0) {
		return null;
	}

	let minLng = coordinates[0][0];
	let minLat = coordinates[0][1];
	let maxLng = coordinates[0][0];
	let maxLat = coordinates[0][1];

	for (let i = 1; i < coordinates.length; i++) {
		const [lng, lat] = coordinates[i];
		if (lng < minLng) minLng = lng;
		if (lat < minLat) minLat = lat;
		if (lng > maxLng) maxLng = lng;
		if (lat > maxLat) maxLat = lat;
	}
	return { minLng, minLat, maxLng, maxLat };
}

/**
 * Calculates the aspect ratio of a bounding box.
 * The aspect ratio is defined as min_dimension / max_dimension, so it's always <= 1.
 * A value of 1 indicates a square.
 * @param bbox The bounding box object.
 * @returns The aspect ratio (between 0 and 1), or 0 if width/height is zero.
 */
export function calculateAspectRatio(bbox: BoundingBox): number {
	const width = bbox.maxLng - bbox.minLng;
	const height = bbox.maxLat - bbox.minLat;

	if (width === 0 || height === 0) {
		return 0; // Avoid division by zero, and a line has zero aspect ratio in this context
	}
	// Note: This doesn't account for spherical distortion (degrees of longitude
	// cover less distance at higher latitudes). For a simple heuristic, it's often sufficient.
	return Math.min(width, height) / Math.max(width, height);
}
