import type { Coordinate, RouteActivity, RoutingPreferences, Waypoint } from "@routess/core";
import { estimateDuration, haversineDistance } from "@routess/core";
import { Logger } from "@/lib/logger";
import { getRuntimeConfig } from "@/lib/runtime-config";

// Routing requests go through the API, which owns the translation from
// RoutingPreferences to Valhalla costing JSON and forwards to the
// cluster-internal Valhalla service. The browser never reaches Valhalla
// directly (see ADR-0021, mirrored from the trace-attributes proxy).
const API_BASE_URL = getRuntimeConfig("VITE_API_URL") ?? "";
const ROUTE_URL = `${API_BASE_URL.replace(/\/+$/, "")}/api/v1/routing/route`;

export interface ComputeRouteOptions {
	snap?: boolean;
	speedKmh?: number;
	walkingSpeedMps?: number;
	signal?: AbortSignal;
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
			// Indices of the segment that failed to route (between waypoint i and i+1),
			// if Valhalla provided enough info to identify it.
			failedSegment?: { from: number; to: number };
	  };

interface ApiRouteLeg {
	shape: string;
	summary: { length: number; time: number };
}

interface ApiRouteLocation {
	lat: number;
	lon: number;
	original_index?: number;
}

interface ApiRouteResponse {
	legs: ApiRouteLeg[];
	locations: ApiRouteLocation[];
}

const sameCoord = (a: Coordinate, b: Coordinate) => a[0] === b[0] && a[1] === b[1];

// Valhalla shape is polyline6 (precision 1e6) by default.
function decodePolyline6(encoded: string): Coordinate[] {
	const factor = 1e6;
	const coords: Coordinate[] = [];
	let index = 0;
	let lat = 0;
	let lng = 0;
	while (index < encoded.length) {
		let result = 0;
		let shift = 0;
		let byte: number;
		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);
		lat += result & 1 ? ~(result >> 1) : result >> 1;

		result = 0;
		shift = 0;
		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);
		lng += result & 1 ? ~(result >> 1) : result >> 1;

		coords.push([lng / factor, lat / factor]);
	}
	return coords;
}

// `kind` lets the caller distinguish a routing failure (API replied that no
// path exists, or a true upstream error) from a transport failure (browser
// couldn't reach the API at all). Per ADR-0014 routing failures bubble up; only
// transport failures qualify for the direct-line offline fallback.
type CallApiRouteResult =
	| { ok: true; data: ApiRouteResponse }
	| { ok: false; kind: "routing"; error: string }
	| { ok: false; kind: "transport"; error: string };

async function callApiRoute(
	coords: Coordinate[],
	activity: RouteActivity,
	prefs: RoutingPreferences,
	options: ComputeRouteOptions,
): Promise<CallApiRouteResult> {
	const body = {
		activity,
		preferences: prefs,
		locations: coords.map(([lng, lat]) => ({ lat, lon: lng })),
		walkingSpeedMps: options.walkingSpeedMps,
	};

	let response: Response;
	try {
		response = await fetch(ROUTE_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: options.signal,
			credentials: "include",
		});
	} catch (err) {
		if ((err as Error).name === "AbortError") throw err;
		return { ok: false, kind: "transport", error: (err as Error).message };
	}

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		return {
			ok: false,
			kind: "routing",
			error: `routing API ${response.status}${text ? `: ${text}` : ""}`,
		};
	}

	const data = (await response.json()) as ApiRouteResponse;
	if (!data.legs?.length) {
		return { ok: false, kind: "routing", error: "API returned no legs" };
	}
	return { ok: true, data };
}

function combineLegs(legs: ApiRouteLeg[]): { path: Coordinate[]; distanceKm: number; durationMinutes: number } {
	const path: Coordinate[] = [];
	let distanceKm = 0;
	let durationSeconds = 0;
	for (const leg of legs) {
		const shape = decodePolyline6(leg.shape);
		distanceKm += leg.summary.length;
		durationSeconds += leg.summary.time;
		if (shape.length === 0) continue;
		if (path.length === 0) path.push(...shape);
		else path.push(...shape.slice(1));
	}
	return { path, distanceKm, durationMinutes: Math.round(durationSeconds / 60) };
}

function snappedFromLocations(
	waypoints: Waypoint[],
	locations: ApiRouteLocation[] | undefined,
): Waypoint[] | undefined {
	if (!locations || locations.length !== waypoints.length) return undefined;
	let changed = false;
	const next = waypoints.map((wp, i) => {
		if (wp.type === "direct") return { ...wp };
		const loc = locations[i];
		const snapped: Coordinate = [loc.lon, loc.lat];
		if (!sameCoord(wp.coord, snapped)) {
			changed = true;
			return { ...wp, coord: snapped };
		}
		return { ...wp };
	});
	return changed ? next : undefined;
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

// Mixed routed+direct: call the API for each `routed` segment individually
// (between waypoint i and waypoint i+1) and stitch directs as straight lines.
// Per ADR-0014, a routed segment that fails to route bubbles up as an error;
// the engine never silently downgrades to direct.
async function computeMixedRoute(
	waypoints: Waypoint[],
	activity: RouteActivity,
	prefs: RoutingPreferences,
	options: ComputeRouteOptions,
): Promise<RouteOutcome> {
	const working: Waypoint[] = waypoints.map((wp) => ({ coord: [...wp.coord] as Coordinate, type: wp.type }));
	const coordsAccum: Coordinate[] = [];
	let totalDistKm = 0;
	let totalDurationSeconds = 0;
	let modified = false;

	for (let i = 0; i < working.length - 1; i++) {
		const from = working[i].coord;
		const to = working[i + 1].coord;

		if (working[i + 1].type === "direct") {
			if (coordsAccum.length === 0 || !sameCoord(coordsAccum[coordsAccum.length - 1], from)) {
				coordsAccum.push(from);
			}
			coordsAccum.push(to);
			const segKm = haversineDistance(from, to);
			totalDistKm += segKm;
			totalDurationSeconds += estimateDuration(segKm, options.speedKmh ?? 5) * 60;
			continue;
		}

		const result = await callApiRoute([from, to], activity, prefs, options);
		if (!result.ok) {
			return { ok: false, error: result.error, failedSegment: { from: i, to: i + 1 } };
		}

		const { path, distanceKm, durationMinutes } = combineLegs(result.data.legs);
		totalDistKm += distanceKm;
		totalDurationSeconds += durationMinutes * 60;

		if (coordsAccum.length === 0) coordsAccum.push(...path);
		else if (path.length > 0) coordsAccum.push(...path.slice(1));

		const locs = result.data.locations;
		if (options.snap !== false && locs && locs.length === 2) {
			const snappedFrom: Coordinate = [locs[0].lon, locs[0].lat];
			const snappedTo: Coordinate = [locs[1].lon, locs[1].lat];
			if (working[i].type !== "direct" && !sameCoord(working[i].coord, snappedFrom)) {
				working[i] = { ...working[i], coord: snappedFrom };
				modified = true;
			}
			if (working[i + 1].type !== "direct" && !sameCoord(working[i + 1].coord, snappedTo)) {
				working[i + 1] = { ...working[i + 1], coord: snappedTo };
				modified = true;
			}
		}
	}

	return {
		ok: true,
		routePath: coordsAccum,
		distanceKm: totalDistKm,
		durationMinutes: Math.round(totalDurationSeconds / 60),
		snappedWaypoints: modified ? working : undefined,
	};
}

export async function computeRoute(
	waypoints: Waypoint[],
	activity: RouteActivity,
	prefs: RoutingPreferences,
	options: ComputeRouteOptions = {},
): Promise<RouteOutcome> {
	if (waypoints.length < 2) {
		return { ok: true, routePath: [], distanceKm: 0, durationMinutes: 0 };
	}

	const segments = classifySegments(waypoints);
	const speedKmh = options.speedKmh && options.speedKmh > 0 ? options.speedKmh : 5;

	if (segments === "all-direct") {
		const { routePath, distanceKm } = buildAllDirect(waypoints);
		return {
			ok: true,
			routePath,
			distanceKm,
			durationMinutes: estimateDuration(distanceKm, speedKmh),
		};
	}

	if (segments === "mixed") {
		return computeMixedRoute(waypoints, activity, prefs, options);
	}

	// all-routed: single API call. Routing failures (API replied 4xx/5xx, or
	// returned no path) bubble up as errors per ADR-0014, matching the mixed
	// behaviour. Only transport failures (browser couldn't reach the API at
	// all) fall back to a direct line so the UI still has something to render
	// while offline.
	try {
		const result = await callApiRoute(
			waypoints.map((wp) => wp.coord),
			activity,
			prefs,
			options,
		);
		if (!result.ok) {
			if (result.kind === "routing") {
				return {
					ok: false,
					error: result.error,
					failedSegment: { from: 0, to: waypoints.length - 1 },
				};
			}
			Logger.warn("[ValhallaClient] Transport failure, falling back to direct routes:", result.error);
			const { routePath, distanceKm } = buildAllDirect(waypoints);
			return {
				ok: true,
				routePath,
				distanceKm,
				durationMinutes: estimateDuration(distanceKm, speedKmh),
				offline: true,
			};
		}

		const { path, distanceKm, durationMinutes } = combineLegs(result.data.legs);
		const snapped = options.snap !== false ? snappedFromLocations(waypoints, result.data.locations) : undefined;

		return {
			ok: true,
			routePath: path,
			distanceKm,
			durationMinutes,
			snappedWaypoints: snapped,
		};
	} catch (err) {
		if ((err as Error).name === "AbortError") throw err;
		Logger.warn("[ValhallaClient] Unexpected error, falling back to direct routes:", err);
		const { routePath, distanceKm } = buildAllDirect(waypoints);
		return {
			ok: true,
			routePath,
			distanceKm,
			durationMinutes: estimateDuration(distanceKm, speedKmh),
			offline: true,
		};
	}
}
