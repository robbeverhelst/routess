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

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;

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
export const pointToSegmentDistance = (
  point: Coordinate,
  lineStart: Coordinate,
  lineEnd: Coordinate,
): number => {
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
    !isNaN(lon) &&
    !isNaN(lat)
  );
};

/**
 * Estimates walking duration based on distance
 * Uses a conservative 5 km/h average walking speed
 *
 * @param distanceKm - Distance in kilometers
 * @returns Duration in minutes
 */
export const estimateWalkingDuration = (distanceKm: number): number => {
  const WALKING_SPEED_KMH = 5;
  return Math.round((distanceKm / WALKING_SPEED_KMH) * 60);
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
  const y =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const bearing = Math.atan2(x, y);
  return ((bearing * 180) / Math.PI + 360) % 360;
};
