import type { Coordinate } from "@routess/core";
import { haversineDistance } from "@routess/core";
import { LngLat, LngLatBounds, type Map as MapboxMap } from "mapbox-gl";
import { Logger } from "@/lib/logger";
import { getMatching } from "@/lib/utils/mapbox-api";

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
		const result = await getMatching([coords, coords], accessToken, {
			profile: "mapbox/walking",
			radius: effectiveRadius,
			steps: true,
			geometries: "geojson",
		});
		if (!result.success || !result.data) {
			Logger.error("[checkNearRoad] Matching API request failed:", result.error);
			return { isValid: false };
		}
		const json = result.data;

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
