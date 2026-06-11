/**
 * Route and waypoint validation utilities
 */

import { isValidCoordinate } from "@routess/core";
import type { Coordinate } from "@/types/map";

/**
 * Validation result interface
 */
export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Route limits and constraints
 */
export const ROUTE_LIMITS = {
	MIN_WAYPOINTS: 2,
	MAX_WAYPOINTS: 25, // Mapbox Directions API limit
	MIN_DISTANCE_KM: 0.001, // 1 meter
	MAX_DISTANCE_KM: 1000, // 1000 km
	MIN_SEGMENT_DISTANCE_M: 1, // 1 meter minimum between waypoints
} as const;

/**
 * Validates a single coordinate
 */
export const validateCoordinate = (coordinate: unknown): ValidationResult => {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!Array.isArray(coordinate)) {
		errors.push("Coordinate must be an array");
		return { isValid: false, errors, warnings };
	}

	if (coordinate.length !== 2) {
		errors.push("Coordinate must have exactly 2 elements [longitude, latitude]");
		return { isValid: false, errors, warnings };
	}

	const [lon, lat] = coordinate;

	if (typeof lon !== "number" || typeof lat !== "number") {
		errors.push("Coordinate values must be numbers");
		return { isValid: false, errors, warnings };
	}

	if (Number.isNaN(lon) || Number.isNaN(lat)) {
		errors.push("Coordinate values cannot be NaN");
		return { isValid: false, errors, warnings };
	}

	if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
		errors.push("Coordinate values must be finite");
		return { isValid: false, errors, warnings };
	}

	if (lon < -180 || lon > 180) {
		errors.push(`Longitude must be between -180 and 180, got ${lon}`);
	}

	if (lat < -90 || lat > 90) {
		errors.push(`Latitude must be between -90 and 90, got ${lat}`);
	}

	// Warnings for suspicious coordinates
	if (lon === 0 && lat === 0) {
		warnings.push("Coordinate at (0,0) may be invalid");
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
};

/**
 * Validates an array of waypoints
 */
export const validateWaypoints = (waypoints: unknown): ValidationResult => {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!Array.isArray(waypoints)) {
		errors.push("Waypoints must be an array");
		return { isValid: false, errors, warnings };
	}

	if (waypoints.length < ROUTE_LIMITS.MIN_WAYPOINTS) {
		errors.push(`At least ${ROUTE_LIMITS.MIN_WAYPOINTS} waypoints are required`);
	}

	if (waypoints.length > ROUTE_LIMITS.MAX_WAYPOINTS) {
		errors.push(`Maximum ${ROUTE_LIMITS.MAX_WAYPOINTS} waypoints allowed`);
	}

	// Validate each waypoint
	waypoints.forEach((waypoint, index) => {
		const result = validateCoordinate(waypoint);
		if (!result.isValid) {
			errors.push(`Waypoint ${index}: ${result.errors.join(", ")}`);
		}
		if (result.warnings.length > 0) {
			warnings.push(`Waypoint ${index}: ${result.warnings.join(", ")}`);
		}
	});

	// Check for duplicate waypoints
	if (waypoints.length >= 2) {
		const validWaypoints = waypoints.filter(
			(wp): wp is Coordinate =>
				Array.isArray(wp) &&
				wp.length === 2 &&
				typeof wp[0] === "number" &&
				typeof wp[1] === "number" &&
				isValidCoordinate([wp[0], wp[1]]),
		);

		for (let i = 0; i < validWaypoints.length - 1; i++) {
			for (let j = i + 1; j < validWaypoints.length; j++) {
				const [lon1, lat1] = validWaypoints[i];
				const [lon2, lat2] = validWaypoints[j];

				// Check if waypoints are very close (within 1 meter)
				const distance = Math.sqrt(
					((lon2 - lon1) * 111320 * Math.cos((lat1 * Math.PI) / 180)) ** 2 + ((lat2 - lat1) * 110540) ** 2,
				);

				if (distance < ROUTE_LIMITS.MIN_SEGMENT_DISTANCE_M) {
					warnings.push(`Waypoints ${i} and ${j} are very close (${distance.toFixed(1)}m apart)`);
				}
			}
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
};

/**
 * Validates route distance
 */
export const validateRouteDistance = (distance: number): ValidationResult => {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (typeof distance !== "number" || Number.isNaN(distance)) {
		errors.push("Route distance must be a valid number");
		return { isValid: false, errors, warnings };
	}

	if (distance < 0) {
		errors.push("Route distance cannot be negative");
	}

	if (distance < ROUTE_LIMITS.MIN_DISTANCE_KM) {
		warnings.push(`Route distance is very short (${distance.toFixed(3)} km)`);
	}

	if (distance > ROUTE_LIMITS.MAX_DISTANCE_KM) {
		warnings.push(`Route distance is very long (${distance.toFixed(1)} km)`);
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
};

/**
 * Validates route duration
 */
export const validateRouteDuration = (duration: number): ValidationResult => {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (typeof duration !== "number" || Number.isNaN(duration)) {
		errors.push("Route duration must be a valid number");
		return { isValid: false, errors, warnings };
	}

	if (duration < 0) {
		errors.push("Route duration cannot be negative");
	}

	if (duration > 24 * 60) {
		// More than 24 hours
		warnings.push(`Route duration is very long (${(duration / 60).toFixed(1)} hours)`);
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
};

/**
 * Validates a complete route object
 */
export const validateRoute = (route: {
	waypoints: unknown;
	routePath?: unknown;
	routeDistance?: unknown;
	routeDuration?: unknown;
}): ValidationResult => {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Validate waypoints
	const waypointsResult = validateWaypoints(route.waypoints);
	errors.push(...waypointsResult.errors);
	warnings.push(...waypointsResult.warnings);

	// Validate route path if provided
	if (route.routePath !== undefined) {
		const routePathResult = validateWaypoints(route.routePath);
		if (!routePathResult.isValid) {
			errors.push(`Route path: ${routePathResult.errors.join(", ")}`);
		}
	}

	// Validate distance if provided
	if (typeof route.routeDistance === "string") {
		const distanceMatch = route.routeDistance.match(/^([\d.]+)\s*km/);
		if (distanceMatch) {
			const distance = parseFloat(distanceMatch[1]);
			const distanceResult = validateRouteDistance(distance);
			errors.push(...distanceResult.errors.map((err) => `Distance: ${err}`));
			warnings.push(...distanceResult.warnings.map((warn) => `Distance: ${warn}`));
		}
	} else if (typeof route.routeDistance === "number") {
		const distanceResult = validateRouteDistance(route.routeDistance);
		errors.push(...distanceResult.errors.map((err) => `Distance: ${err}`));
		warnings.push(...distanceResult.warnings.map((warn) => `Distance: ${warn}`));
	}

	// Validate duration if provided
	if (typeof route.routeDuration === "string") {
		const durationMatch = route.routeDuration.match(/^([\d.]+)\s*min/);
		if (durationMatch) {
			const duration = parseFloat(durationMatch[1]);
			const durationResult = validateRouteDuration(duration);
			errors.push(...durationResult.errors.map((err) => `Duration: ${err}`));
			warnings.push(...durationResult.warnings.map((warn) => `Duration: ${warn}`));
		}
	} else if (typeof route.routeDuration === "number") {
		const durationResult = validateRouteDuration(route.routeDuration);
		errors.push(...durationResult.errors.map((err) => `Duration: ${err}`));
		warnings.push(...durationResult.warnings.map((warn) => `Duration: ${warn}`));
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
};

/**
 * Sanitizes waypoints by removing invalid ones
 */
export const sanitizeWaypoints = (waypoints: unknown[]): Coordinate[] => {
	return waypoints.filter((waypoint): waypoint is Coordinate => {
		if (!Array.isArray(waypoint) || waypoint.length !== 2) return false;
		const [lon, lat] = waypoint;
		return typeof lon === "number" && typeof lat === "number" && isValidCoordinate([lon, lat]);
	});
};
