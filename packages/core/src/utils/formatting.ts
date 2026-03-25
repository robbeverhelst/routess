/**
 * Distance and duration formatting utilities
 */

/**
 * Formats distance in kilometers with appropriate precision
 *
 * @param distanceKm - Distance in kilometers
 * @param options - Formatting options
 * @returns Formatted distance string
 */
export const formatDistance = (
	distanceKm: number,
	options: {
		precision?: number;
		unit?: "km" | "auto";
		showUnit?: boolean;
	} = {},
): string => {
	const { precision = 2, unit = "auto", showUnit = true } = options;

	if (unit === "auto") {
		// Use meters for very short distances
		if (distanceKm < 1) {
			const meters = Math.round(distanceKm * 1000);
			return showUnit ? `${meters} m` : meters.toString();
		}
	}

	const formatted = distanceKm.toFixed(precision);
	return showUnit ? `${formatted} km` : formatted;
};

/**
 * Formats duration in minutes with appropriate units
 *
 * @param durationMinutes - Duration in minutes
 * @param options - Formatting options
 * @returns Formatted duration string
 */
export const formatDuration = (
	durationMinutes: number,
	options: {
		format?: "auto" | "minutes" | "hours" | "full";
		showUnit?: boolean;
	} = {},
): string => {
	const { format = "auto", showUnit = true } = options;

	if (format === "minutes" || (format === "auto" && durationMinutes < 60)) {
		const minutes = Math.round(durationMinutes);
		return showUnit ? `${minutes} min` : minutes.toString();
	}

	if (format === "hours" || (format === "auto" && durationMinutes >= 60)) {
		const hours = Math.floor(durationMinutes / 60);
		const minutes = Math.round(durationMinutes % 60);

		if (minutes === 0) {
			return showUnit ? `${hours} h` : hours.toString();
		}

		// Auto format: show decimal hours for longer durations
		const decimalHours = (durationMinutes / 60).toFixed(1);
		return showUnit ? `${decimalHours} h` : decimalHours;
	}

	if (format === "full") {
		const hours = Math.floor(durationMinutes / 60);
		const minutes = Math.round(durationMinutes % 60);

		if (durationMinutes >= 60) {
			return showUnit ? `${hours} h ${minutes} min` : `${hours}:${minutes.toString().padStart(2, "0")}`;
		} else {
			return showUnit ? `${minutes} min` : minutes.toString();
		}
	}

	// Fallback
	const minutes = Math.round(durationMinutes);
	return showUnit ? `${minutes} min` : minutes.toString();
};

/**
 * Formats route statistics (distance and duration together)
 *
 * @param distanceKm - Distance in kilometers
 * @param durationMinutes - Duration in minutes
 * @param options - Formatting options
 * @returns Formatted route stats
 */
export const formatRouteStats = (
	distanceKm: number,
	durationMinutes: number,
	options: {
		separator?: string;
		includeSpeed?: boolean;
	} = {},
): string => {
	const { separator = " • ", includeSpeed = false } = options;

	const distance = formatDistance(distanceKm);
	const duration = formatDuration(durationMinutes);

	let result = `${distance}${separator}${duration}`;

	if (includeSpeed && durationMinutes > 0) {
		const speedKmh = (distanceKm / (durationMinutes / 60)).toFixed(1);
		result += `${separator}${speedKmh} km/h`;
	}

	return result;
};

/**
 * Formats coordinate with appropriate precision
 *
 * @param coordinate - Coordinate [longitude, latitude]
 * @param precision - Decimal places
 * @returns Formatted coordinate string
 */
export const formatCoordinate = (coordinate: [number, number], precision: number = 6): string => {
	const [lon, lat] = coordinate;
	return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
};

/**
 * Formats bearing in degrees
 *
 * @param bearing - Bearing in degrees (0-360)
 * @param format - Format type
 * @returns Formatted bearing string
 */
export const formatBearing = (bearing: number, format: "degrees" | "cardinal" | "both" = "degrees"): string => {
	const normalizedBearing = ((bearing % 360) + 360) % 360;

	if (format === "degrees") {
		return `${normalizedBearing.toFixed(0)}°`;
	}

	if (format === "cardinal") {
		const cardinals = [
			"N",
			"NNE",
			"NE",
			"ENE",
			"E",
			"ESE",
			"SE",
			"SSE",
			"S",
			"SSW",
			"SW",
			"WSW",
			"W",
			"WNW",
			"NW",
			"NNW",
		];
		const index = Math.round(normalizedBearing / 22.5) % 16;
		return cardinals[index];
	}

	if (format === "both") {
		const degrees = formatBearing(bearing, "degrees");
		const cardinal = formatBearing(bearing, "cardinal");
		return `${degrees} (${cardinal})`;
	}

	return normalizedBearing.toString();
};

/**
 * Formats elevation gain/loss
 *
 * @param elevationMeters - Elevation in meters
 * @param type - Type of elevation change
 * @returns Formatted elevation string
 */
export const formatElevation = (elevationMeters: number, type: "gain" | "loss" | "absolute" = "absolute"): string => {
	const rounded = Math.round(elevationMeters);

	if (type === "gain") {
		return `↗ ${rounded} m`;
	}

	if (type === "loss") {
		return `↘ ${Math.abs(rounded)} m`;
	}

	return `${rounded} m`;
};

/**
 * Formats file size for GPX files
 *
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export const formatFileSize = (bytes: number): string => {
	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	const precision = unitIndex === 0 ? 0 : 1;
	return `${size.toFixed(precision)} ${units[unitIndex]}`;
};
