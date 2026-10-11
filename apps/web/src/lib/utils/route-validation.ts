/**
 * Route and waypoint validation utilities
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

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
