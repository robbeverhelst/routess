/**
 * Shared geospatial utilities for coordinate calculations and transformations
 */

import type { Coordinate } from "../types";

// Earth's radius in kilometers
export const EARTH_RADIUS_KM = 6371;

/**
 * Converts degrees to radians
 */
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Calculates the great-circle distance between two coordinates using the Haversine formula.
 * This is the most accurate method for calculating distances on a sphere.
 *
 * @param coord1 - The first coordinate [longitude, latitude]
 * @param coord2 - The second coordinate [longitude, latitude]
 * @returns The distance in kilometers
 */
export const haversineDistance = (coord1: Coordinate, coord2: Coordinate): number => {
	const [lon1, lat1] = coord1;
	const [lon2, lat2] = coord2;

	const dLat = toRadians(lat2 - lat1);
	const dLon = toRadians(lon2 - lon1);
	const lat1Rad = toRadians(lat1);
	const lat2Rad = toRadians(lat2);

	const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return EARTH_RADIUS_KM * c;
};

/**
 * Calculates the total distance for a sequence of coordinates
 *
 * @param coordinates - Array of coordinates forming a path
 * @returns The total distance in kilometers
 */
export const calculatePathDistance = (coordinates: Coordinate[]): number => {
	if (coordinates.length < 2) return 0;

	let totalDistance = 0;
	for (let i = 0; i < coordinates.length - 1; i++) {
		totalDistance += haversineDistance(coordinates[i], coordinates[i + 1]);
	}

	return totalDistance;
};

/**
 * Calculates the distance from a point to a line segment
 * Used for determining if a click is close enough to a route for insertion
 *
 * @param point - The point coordinate
 * @param lineStart - Start of the line segment
 * @param lineEnd - End of the line segment
 * @returns The distance in kilometers
 */
export const pointToSegmentDistance = (point: Coordinate, lineStart: Coordinate, lineEnd: Coordinate): number => {
	const [px, py] = point;
	const [x1, y1] = lineStart;
	const [x2, y2] = lineEnd;

	const dx = x2 - x1;
	const dy = y2 - y1;

	if (dx === 0 && dy === 0) {
		// Start and end are the same point
		return haversineDistance(point, lineStart);
	}

	// Calculate the projection parameter t
	const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));

	// Find the closest point on the line segment
	const closestPoint: Coordinate = [x1 + t * dx, y1 + t * dy];

	return haversineDistance(point, closestPoint);
};

/**
 * Validates that a coordinate is within valid ranges
 *
 * @param coordinate - The coordinate to validate [longitude, latitude]
 * @returns True if the coordinate is valid
 */
export const isValidCoordinate = (coordinate: Coordinate): boolean => {
	const [lon, lat] = coordinate;
	return (
		typeof lon === "number" &&
		typeof lat === "number" &&
		lon >= -180 &&
		lon <= 180 &&
		lat >= -90 &&
		lat <= 90 &&
		!Number.isNaN(lon) &&
		!Number.isNaN(lat)
	);
};

/**
 * Estimates duration in minutes for a distance at a given speed.
 */
export const estimateDuration = (distanceKm: number, speedKmh: number): number => {
	if (speedKmh <= 0) return 0;
	return Math.round((distanceKm / speedKmh) * 60);
};

export const estimateWalkingDuration = (distanceKm: number): number => estimateDuration(distanceKm, 5);

/**
 * Finds the closest point on a 2D segment to a given point in lon/lat space.
 * Treats coordinates as Euclidean (no spherical correction); accurate enough
 * for short segments, which is what waypoint insertion needs.
 *
 * @param p - The query point [lon, lat]
 * @param v - Segment start [lon, lat]
 * @param w - Segment end [lon, lat]
 * @returns The closest point on the segment, clamped to its endpoints
 */
export const closestPointOnSegment = (p: Coordinate, v: Coordinate, w: Coordinate): Coordinate => {
	const l2 = (v[0] - w[0]) ** 2 + (v[1] - w[1]) ** 2;
	if (l2 === 0) return v;

	let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
	t = Math.max(0, Math.min(1, t));

	return [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
};

/**
 * Bounding box of a path in degrees. The shape persisted on a Route for
 * viewport-overlap discovery queries (ADR 0030).
 */
export interface BoundingBox {
	minLat: number;
	maxLat: number;
	minLng: number;
	maxLng: number;
}

/**
 * Computes the bounding box of a coordinate path.
 *
 * @param coordinates - Array of [longitude, latitude] pairs
 * @returns The bounding box, or null for an empty path
 */
export const routeBoundingBox = (coordinates: Coordinate[]): BoundingBox | null => {
	let box: BoundingBox | null = null;
	for (const coord of coordinates) {
		if (!isValidCoordinate(coord)) continue;
		const [lng, lat] = coord;
		if (!box) {
			box = { minLat: lat, maxLat: lat, minLng: lng, maxLng: lng };
		} else {
			if (lat < box.minLat) box.minLat = lat;
			if (lat > box.maxLat) box.maxLat = lat;
			if (lng < box.minLng) box.minLng = lng;
			if (lng > box.maxLng) box.maxLng = lng;
		}
	}
	return box;
};

/**
 * Downsamples a path to at most maxPoints coordinates, always keeping the
 * first and last point. Even-stride sampling: good enough for thumbnails and
 * map previews, not a topological simplification.
 */
export const downsampleCoordinates = (coordinates: Coordinate[], maxPoints: number): Coordinate[] => {
	if (maxPoints < 2 || coordinates.length <= maxPoints) return coordinates;
	const result: Coordinate[] = [];
	const step = (coordinates.length - 1) / (maxPoints - 1);
	for (let i = 0; i < maxPoints; i++) {
		result.push(coordinates[Math.round(i * step)]);
	}
	return result;
};

/**
 * Calculates the bearing between two coordinates
 *
 * @param coord1 - Start coordinate [longitude, latitude]
 * @param coord2 - End coordinate [longitude, latitude]
 * @returns Bearing in degrees (0-360)
 */
export const calculateBearing = (coord1: Coordinate, coord2: Coordinate): number => {
	const [lon1, lat1] = coord1;
	const [lon2, lat2] = coord2;

	const lat1Rad = toRadians(lat1);
	const lat2Rad = toRadians(lat2);
	const dLon = toRadians(lon2 - lon1);

	const x = Math.sin(dLon) * Math.cos(lat2Rad);
	const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

	const bearing = Math.atan2(x, y);
	return ((bearing * 180) / Math.PI + 360) % 360;
};

// True when any vertex falls inside the box or any segment crosses it.
// Discover's bbox prefilter (ADR 0030) over-matches long routes whose box
// overlaps the viewport while the path runs elsewhere; this is the cheap
// exact-enough check (downsampled paths, <=80 points) that removes them.
export const pathIntersectsBbox = (
	path: Coordinate[],
	box: { minLng: number; minLat: number; maxLng: number; maxLat: number },
): boolean => {
	const inside = ([lng, lat]: Coordinate) =>
		lng >= box.minLng && lng <= box.maxLng && lat >= box.minLat && lat <= box.maxLat;
	for (const point of path) {
		if (inside(point)) return true;
	}
	// Segment-rectangle crossing: test each segment against the box edges.
	const corners: Coordinate[] = [
		[box.minLng, box.minLat],
		[box.maxLng, box.minLat],
		[box.maxLng, box.maxLat],
		[box.minLng, box.maxLat],
	];
	const orient = (a: Coordinate, b: Coordinate, c: Coordinate) =>
		Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
	const segmentsCross = (a: Coordinate, b: Coordinate, c: Coordinate, d: Coordinate) =>
		orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b);
	for (let i = 0; i < path.length - 1; i++) {
		for (let e = 0; e < 4; e++) {
			if (segmentsCross(path[i], path[i + 1], corners[e], corners[(e + 1) % 4])) return true;
		}
	}
	return false;
};
