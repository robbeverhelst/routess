import type { Coordinate, Waypoint } from "@routess/core";
import { estimateWalkingDuration, haversineDistance } from "@routess/core";
import { Logger } from "@/lib/logger";
import { getDirections } from "@/lib/utils/mapbox-api";

// Pure routing engine: takes waypoints + access token, returns geometry + metrics.
// No store reads, no map mutations, no UI setters. Unit-testable in isolation.

export interface DirectionsOptions {
	profile?: string;
	exclude?: string[];
	radius?: number;
	continueStraight?: boolean;
}

export interface ComputeRouteOptions {
	directions?: DirectionsOptions;
	// When false, the engine still calls Mapbox but does not return snapped
	// waypoints — callers won't displace the user's chosen coordinates.
	snap?: boolean;
}

export type RouteOutcome =
	| {
			ok: true;
			routePath: Coordinate[];
			distanceKm: number;
			durationMinutes: number;
			snappedWaypoints?: Waypoint[];
			offline?: boolean;
	  }
	| {
			ok: false;
			error: string;
	  };

const sameCoord = (a: Coordinate, b: Coordinate) => a[0] === b[0] && a[1] === b[1];

const baseDirectionsOptions = (overrides?: DirectionsOptions): DirectionsOptions => ({
	radius: 150,
	continueStraight: true,
	...overrides,
});

interface MixedRouteResult {
	coordsAccum: Coordinate[];
	totalDistKm: number;
	snappedWaypoints: Waypoint[] | null;
}

async function buildMixedRoute(
	waypoints: Waypoint[],
	accessToken: string,
	directions: DirectionsOptions,
): Promise<MixedRouteResult> {
	const working: Waypoint[] = waypoints.map((wp) => ({ coord: [...wp.coord] as Coordinate, type: wp.type }));
	const coordsAccum: Coordinate[] = [];
	let totalDistKm = 0;
	let modified = false;

	for (let i = 0; i < working.length - 1; i++) {
		const from = working[i].coord;
		const to = working[i + 1].coord;

		const pushDirect = () => {
			if (
				coordsAccum.length === 0 ||
				coordsAccum[coordsAccum.length - 1][0] !== from[0] ||
				coordsAccum[coordsAccum.length - 1][1] !== from[1]
			) {
				coordsAccum.push(from);
			}
			coordsAccum.push(to);
			totalDistKm += haversineDistance(from, to);
		};

		if (working[i + 1].type === "direct") {
			pushDirect();
			continue;
		}

		const result = await getDirections([from, to], accessToken, directions);
		if (!result.success || !result.data?.routes?.[0]) {
			Logger.warn(
				`[RoutingEngine/mixed] No route for segment ${i}-${i + 1}: ${result.error || "Unknown error"}. Falling back to direct.`,
			);
			if (working[i + 1].type !== "direct") {
				working[i + 1] = { ...working[i + 1], type: "direct" };
				modified = true;
			}
			pushDirect();
			continue;
		}

		const route = result.data.routes[0];
		const geom = route.geometry.coordinates as Coordinate[];
		totalDistKm += route.distance / 1000;

		if (
			coordsAccum.length === 0 ||
			coordsAccum[coordsAccum.length - 1][0] !== geom[0][0] ||
			coordsAccum[coordsAccum.length - 1][1] !== geom[0][1]
		) {
			if (coordsAccum.length === 0 && geom.length > 0) coordsAccum.push(...geom);
			else if (geom.length > 0) coordsAccum.push(...geom.slice(1));
		} else if (geom.length > 1) {
			coordsAccum.push(...geom.slice(1));
		}

		const apiWaypoints = result.data.waypoints;
		if (apiWaypoints && apiWaypoints.length === 2) {
			const newCoord0 = apiWaypoints[0].location as Coordinate;
			const newCoord1 = apiWaypoints[1].location as Coordinate;
			if (working[i].type !== "direct" && !sameCoord(working[i].coord, newCoord0)) {
				working[i] = { ...working[i], coord: newCoord0 };
				modified = true;
			}
			if (working[i + 1].type !== "direct" && !sameCoord(working[i + 1].coord, newCoord1)) {
				working[i + 1] = { ...working[i + 1], coord: newCoord1 };
				modified = true;
			}
		}
	}

	return { coordsAccum, totalDistKm, snappedWaypoints: modified ? working : null };
}

function classifySegments(waypoints: Waypoint[]): "all-direct" | "all-routed" | "mixed" {
	let hasDirect = false;
	let hasRouted = false;
	for (let i = 1; i < waypoints.length; i++) {
		if (waypoints[i].type === "direct") hasDirect = true;
		else hasRouted = true;
	}
	if (hasDirect && !hasRouted) return "all-direct";
	if (hasRouted && !hasDirect) return "all-routed";
	return "mixed";
}

function buildAllDirect(waypoints: Waypoint[]): { routePath: Coordinate[]; distanceKm: number } {
	const routePath: Coordinate[] = [];
	let distanceKm = 0;
	for (let i = 0; i < waypoints.length - 1; i++) {
		if (i === 0) routePath.push(waypoints[i].coord);
		routePath.push(waypoints[i + 1].coord);
		distanceKm += haversineDistance(waypoints[i].coord, waypoints[i + 1].coord);
	}
	return { routePath, distanceKm };
}

export async function computeRoute(
	waypoints: Waypoint[],
	accessToken: string,
	options: ComputeRouteOptions = {},
): Promise<RouteOutcome> {
	if (waypoints.length < 2) {
		return { ok: true, routePath: [], distanceKm: 0, durationMinutes: 0 };
	}

	const directions = baseDirectionsOptions(options.directions);
	const snap = options.snap ?? true;

	const segments = classifySegments(waypoints);

	if (segments === "all-direct") {
		const { routePath, distanceKm } = buildAllDirect(waypoints);
		return { ok: true, routePath, distanceKm, durationMinutes: estimateWalkingDuration(distanceKm) };
	}

	if (segments === "mixed") {
		const { coordsAccum, totalDistKm, snappedWaypoints } = await buildMixedRoute(waypoints, accessToken, directions);
		return {
			ok: true,
			routePath: coordsAccum,
			distanceKm: totalDistKm,
			durationMinutes: estimateWalkingDuration(totalDistKm),
			snappedWaypoints: snap ? (snappedWaypoints ?? undefined) : undefined,
		};
	}

	// all-routed: single Mapbox Directions call.
	try {
		const apiInputCoords = waypoints.map((wp) => wp.coord);
		const result = await getDirections(apiInputCoords, accessToken, directions);

		if (!result.success || !result.data?.routes || result.data.routes.length === 0) {
			Logger.error("[RoutingEngine] Directions API failed or empty:", result.error);
			return { ok: false, error: result.error ?? "No route found" };
		}

		const route = result.data.routes[0];
		const routePath = route.geometry.coordinates as Coordinate[];
		const distanceKm = route.distance / 1000;
		const durationMinutes = Math.round(route.duration / 60);

		let snappedWaypoints: Waypoint[] | undefined;
		const apiWaypoints = result.data.waypoints;
		if (snap && apiWaypoints && Array.isArray(apiWaypoints) && apiWaypoints.length === waypoints.length) {
			const next = waypoints.map((wp) => ({ ...wp }));
			let changed = false;
			for (let i = 0; i < waypoints.length; i++) {
				const apiCoord = apiWaypoints[i].location as Coordinate;
				if (waypoints[i].type !== "direct" && !sameCoord(waypoints[i].coord, apiCoord)) {
					next[i] = { ...next[i], coord: apiCoord };
					changed = true;
				}
			}
			if (changed) snappedWaypoints = next;
		}

		return { ok: true, routePath, distanceKm, durationMinutes, snappedWaypoints };
	} catch (error) {
		Logger.warn("[RoutingEngine] Network error, falling back to direct routes:", error);
		const { routePath, distanceKm } = buildAllDirect(waypoints);
		return {
			ok: true,
			routePath,
			distanceKm,
			durationMinutes: estimateWalkingDuration(distanceKm),
			offline: true,
		};
	}
}
