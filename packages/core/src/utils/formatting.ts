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
