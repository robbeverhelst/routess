import {
  haversineDistance,
  pointToSegmentDistance,
  calculateBearing,
  isValidCoordinate,
  calculatePathDistance,
  estimateWalkingDuration,
  EARTH_RADIUS_KM,
} from "@/lib/utils/geospatial";
import { mockCoordinates } from "../../test/utils";

describe("Geospatial Utils", () => {
  describe("haversineDistance", () => {
    it("should calculate distance between two points correctly", () => {
      // Distance between Berlin and Paris (approximately 877.5 km)
      const distance = haversineDistance(mockCoordinates.berlin, mockCoordinates.paris);
      expect(distance).toBeCloseTo(877.5, 1); // Within 0.1 km accuracy
    });

    it("should return 0 for same coordinates", () => {
      const distance = haversineDistance(mockCoordinates.berlin, mockCoordinates.berlin);
      expect(distance).toBe(0);
    });

    it("should handle negative coordinates correctly", () => {
      const point1: [number, number] = [-74.006, 40.7128]; // New York
      const point2: [number, number] = [-118.2437, 34.0522]; // Los Angeles
      const distance = haversineDistance(point1, point2);
      expect(distance).toBeGreaterThan(3900); // Approximately 3944 km
      expect(distance).toBeLessThan(4000);
    });
  });

  describe("pointToSegmentDistance", () => {
    it("should calculate perpendicular distance correctly", () => {
      const point: [number, number] = [0, 1];
      const segmentStart: [number, number] = [-1, 0];
      const segmentEnd: [number, number] = [1, 0];

      const distance = pointToSegmentDistance(point, segmentStart, segmentEnd);
      expect(distance).toBeCloseTo(111.2, 1); // Approximately 111.2 km (1 degree latitude)
    });

    it("should handle point on segment", () => {
      const point: [number, number] = [0, 0];
      const segmentStart: [number, number] = [-1, 0];
      const segmentEnd: [number, number] = [1, 0];

      const distance = pointToSegmentDistance(point, segmentStart, segmentEnd);
      expect(distance).toBeCloseTo(0, 1);
    });

    it("should handle point beyond segment endpoints", () => {
      const point: [number, number] = [2, 0];
      const segmentStart: [number, number] = [-1, 0];
      const segmentEnd: [number, number] = [1, 0];

      const distance = pointToSegmentDistance(point, segmentStart, segmentEnd);
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe("calculatePathDistance", () => {
    it("should calculate total distance for multiple coordinates", () => {
      const path = [mockCoordinates.berlin, mockCoordinates.paris, mockCoordinates.london];
      const totalDistance = calculatePathDistance(path);
      expect(totalDistance).toBeGreaterThan(1000); // Should be over 1000km
    });

    it("should return 0 for empty or single coordinate", () => {
      expect(calculatePathDistance([])).toBe(0);
      expect(calculatePathDistance([mockCoordinates.berlin])).toBe(0);
    });

    it("should handle two coordinates correctly", () => {
      const path = [mockCoordinates.berlin, mockCoordinates.paris];
      const distance = calculatePathDistance(path);
      expect(distance).toBeCloseTo(877.5, 1);
    });
  });

  describe("calculateBearing", () => {
    it("should calculate bearing from north to south", () => {
      const from: [number, number] = [0, 1];
      const to: [number, number] = [0, 0];

      const bearing = calculateBearing(from, to);
      expect(bearing).toBeCloseTo(180, 1);
    });

    it("should calculate bearing from west to east", () => {
      const from: [number, number] = [-1, 0];
      const to: [number, number] = [1, 0];

      const bearing = calculateBearing(from, to);
      expect(bearing).toBeCloseTo(90, 1);
    });

    it("should handle same coordinates", () => {
      const bearing = calculateBearing(mockCoordinates.berlin, mockCoordinates.berlin);
      expect(bearing).toBe(0);
    });
  });

  describe("estimateWalkingDuration", () => {
    it("should estimate walking duration correctly", () => {
      expect(estimateWalkingDuration(5)).toBe(60); // 5km at 5km/h = 60 minutes
      expect(estimateWalkingDuration(2.5)).toBe(30); // 2.5km = 30 minutes
      expect(estimateWalkingDuration(10)).toBe(120); // 10km = 120 minutes
    });

    it("should handle zero distance", () => {
      expect(estimateWalkingDuration(0)).toBe(0);
    });

    it("should round to nearest minute", () => {
      expect(estimateWalkingDuration(1)).toBe(12); // 1km = 12 minutes
    });
  });

  describe("isValidCoordinate", () => {
    it("should validate correct coordinates", () => {
      expect(isValidCoordinate(mockCoordinates.berlin)).toBe(true);
      expect(isValidCoordinate(mockCoordinates.paris)).toBe(true);
      expect(isValidCoordinate([0, 0])).toBe(true);
      expect(isValidCoordinate([-180, -90])).toBe(true);
      expect(isValidCoordinate([180, 90])).toBe(true);
    });

    it("should reject invalid longitude", () => {
      expect(isValidCoordinate([181, 0])).toBe(false);
      expect(isValidCoordinate([-181, 0])).toBe(false);
      expect(isValidCoordinate([200, 0])).toBe(false);
    });

    it("should reject invalid latitude", () => {
      expect(isValidCoordinate([0, 91])).toBe(false);
      expect(isValidCoordinate([0, -91])).toBe(false);
      expect(isValidCoordinate([0, 100])).toBe(false);
    });

    it("should reject non-numeric values", () => {
      expect(isValidCoordinate([NaN, 0])).toBe(false);
      expect(isValidCoordinate([0, NaN])).toBe(false);
      expect(isValidCoordinate([Infinity, 0])).toBe(false);
      expect(isValidCoordinate([0, -Infinity])).toBe(false);
    });
  });

  describe("constants", () => {
    it("should have correct Earth radius constant", () => {
      expect(EARTH_RADIUS_KM).toBe(6371);
    });
  });
});
