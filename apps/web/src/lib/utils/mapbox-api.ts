/**
 * Mapbox API utilities and error handling
 */

import { Logger } from "@/lib/logger";
import type { Coordinate } from "@/types/map";

// Mapbox API configuration
export const MAPBOX_CONFIG = {
	DIRECTIONS_BASE_URL: "https://api.mapbox.com/directions/v5",
	MATCHING_BASE_URL: "https://api.mapbox.com/matching/v5",
	DEFAULT_PROFILE: "mapbox/walking",
	DEFAULT_RADIUS: 150, // meters
	MAX_MATCHING_RADIUS: 49, // meters - Mapbox Matching API limit
	REQUEST_TIMEOUT: 10000, // 10 seconds
} as const;

/**
 * Standard Mapbox API error response
 */
export interface MapboxError {
	code: string;
	message: string;
}

/**
 * Mapbox Directions API response
 */
export interface DirectionsResponse {
	routes: Array<{
		geometry: {
			coordinates: Coordinate[];
		};
		distance: number; // meters
		duration: number; // seconds
	}>;
	waypoints?: Array<{
		location: Coordinate;
	}>;
	code: string;
	message?: string;
}

/**
 * Mapbox Matching API response
 */
export interface MatchingResponse {
	tracepoints: Array<{
		location: Coordinate;
	} | null>;
	code: string;
	message?: string;
}

/**
 * Creates a standardized Mapbox API request with error handling
 */
export const makeMapboxRequest = async <T>(
	url: string,
	context: string,
	timeout = MAPBOX_CONFIG.REQUEST_TIMEOUT,
): Promise<{ success: boolean; data?: T; error?: string }> => {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(url, {
			method: "GET",
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text().catch(() => `HTTP ${response.status}`);
			Logger.error(`[${context}] API request failed:`, response.status, errorText);
			return {
				success: false,
				error: `API request failed: ${response.statusText}`,
			};
		}

		const data = await response.json();

		// Check for Mapbox API error codes
		if (data.code && data.code !== "Ok") {
			Logger.error(`[${context}] Mapbox API error:`, data.code, data.message);
			return {
				success: false,
				error: data.message || `Mapbox API error: ${data.code}`,
			};
		}

		return { success: true, data };
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			Logger.error(`[${context}] Request timeout after ${timeout}ms`);
			return { success: false, error: "Request timeout" };
		}

		Logger.error(`[${context}] Network error:`, error);
		return { success: false, error: "Network error" };
	}
};

/**
 * Builds a Mapbox Directions API URL
 */
export const buildDirectionsUrl = (
	waypoints: Coordinate[],
	accessToken: string,
	options: {
		profile?: string;
		radius?: number;
		steps?: boolean;
		geometries?: "geojson" | "polyline" | "polyline6";
		overview?: "full" | "simplified" | "false";
		continueStraight?: boolean;
		exclude?: string[];
	} = {},
): string => {
	if (waypoints.length < 2) {
		throw new Error("At least 2 waypoints are required for directions");
	}

	const {
		profile = MAPBOX_CONFIG.DEFAULT_PROFILE,
		radius = MAPBOX_CONFIG.DEFAULT_RADIUS,
		steps = true,
		geometries = "geojson",
		overview = "full",
		continueStraight = true,
		exclude,
	} = options;

	const waypointsString = waypoints.map((point) => `${point[0]},${point[1]}`).join(";");
	const radiusesString = waypoints.map(() => radius.toString()).join(";");

	const params = new URLSearchParams({
		steps: steps.toString(),
		geometries,
		overview,
		continue_straight: continueStraight.toString(),
		access_token: accessToken,
		radiuses: radiusesString,
	});

	if (exclude && exclude.length > 0) {
		params.set("exclude", exclude.join(","));
	}

	return `${MAPBOX_CONFIG.DIRECTIONS_BASE_URL}/${profile}/${waypointsString}?${params}`;
};

/**
 * Builds a Mapbox Matching API URL
 */
export const buildMatchingUrl = (
	coordinates: Coordinate[],
	accessToken: string,
	options: {
		profile?: string;
		radius?: number;
		steps?: boolean;
		geometries?: "geojson" | "polyline" | "polyline6";
	} = {},
): string => {
	if (coordinates.length < 2) {
		throw new Error("At least 2 coordinates are required for matching");
	}

	const {
		profile = MAPBOX_CONFIG.DEFAULT_PROFILE,
		radius = MAPBOX_CONFIG.MAX_MATCHING_RADIUS,
		steps = true,
		geometries = "geojson",
	} = options;

	// Ensure radius doesn't exceed Mapbox limits
	const effectiveRadius = Math.min(radius, MAPBOX_CONFIG.MAX_MATCHING_RADIUS);

	const coordinatesString = coordinates.map((coord) => `${coord[0]},${coord[1]}`).join(";");
	const radiusesString = coordinates.map(() => effectiveRadius.toString()).join(";");

	const params = new URLSearchParams({
		steps: steps.toString(),
		geometries,
		access_token: accessToken,
		radiuses: radiusesString,
	});

	return `${MAPBOX_CONFIG.MATCHING_BASE_URL}/${profile}/${coordinatesString}?${params}`;
};

/**
 * Calls the Mapbox Directions API
 */
export const getDirections = async (
	waypoints: Coordinate[],
	accessToken: string,
	options?: Parameters<typeof buildDirectionsUrl>[2],
): Promise<{ success: boolean; data?: DirectionsResponse; error?: string }> => {
	try {
		const url = buildDirectionsUrl(waypoints, accessToken, options);
		const result = await makeMapboxRequest<DirectionsResponse>(url, "getDirections");

		if (!result.success || !result.data) {
			return result;
		}

		// Validate response structure
		if (!result.data.routes || result.data.routes.length === 0) {
			return {
				success: false,
				error: "No routes found",
			};
		}

		const route = result.data.routes[0];
		if (!route.geometry?.coordinates) {
			return {
				success: false,
				error: "Invalid route geometry",
			};
		}

		return result;
	} catch (error) {
		Logger.error("[getDirections] Error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
};

/**
 * Calls the Mapbox Matching API to check if coordinates are near roads
 */
export const getMatching = async (
	coordinates: Coordinate[],
	accessToken: string,
	options?: Parameters<typeof buildMatchingUrl>[2],
): Promise<{ success: boolean; data?: MatchingResponse; error?: string }> => {
	try {
		const url = buildMatchingUrl(coordinates, accessToken, options);
		const result = await makeMapboxRequest<MatchingResponse>(url, "getMatching");

		if (!result.success || !result.data) {
			return result;
		}

		// Validate response structure
		if (!result.data.tracepoints) {
			return {
				success: false,
				error: "Invalid matching response",
			};
		}

		return result;
	} catch (error) {
		Logger.error("[getMatching] Error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
};

/**
 * Redacts access token from URL for logging
 */
export const redactAccessToken = (url: string): string => {
	return url.replace(/access_token=[^&]+/, "access_token=***");
};

/**
 * Validates Mapbox access token format
 */
export const isValidAccessToken = (token: string): boolean => {
	return typeof token === "string" && token.length > 0 && (token.startsWith("pk.") || token.startsWith("sk."));
};

/**
 * Extracts error message from Mapbox API response
 */
export const extractErrorMessage = (error: unknown): string => {
	if (typeof error === "string") return error;
	if (error instanceof Error) return error.message;
	if (typeof error === "object" && error !== null && "message" in error) {
		return String(error.message);
	}
	return "Unknown error occurred";
};
