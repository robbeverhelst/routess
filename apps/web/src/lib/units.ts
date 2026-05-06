import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";

const KM_PER_MILE = 1.609344;
const FT_PER_M = 3.28084;

export type UnitSystem = "km" | "mi";

export interface DistanceParts {
	value: string;
	unit: string;
}

export function formatDistanceParts(distanceKm: number, units: UnitSystem): DistanceParts {
	if (units === "mi") {
		const miles = distanceKm / KM_PER_MILE;
		if (miles < 0.1) {
			return { value: Math.round(distanceKm * 1000 * FT_PER_M).toString(), unit: "ft" };
		}
		return { value: miles.toFixed(2), unit: "mi" };
	}
	if (distanceKm < 1) {
		return { value: Math.round(distanceKm * 1000).toString(), unit: "m" };
	}
	return { value: distanceKm.toFixed(2), unit: "km" };
}

export function formatDistance(distanceKm: number, units: UnitSystem): string {
	const { value, unit } = formatDistanceParts(distanceKm, units);
	return `${value} ${unit}`;
}

export function formatSpeedParts(speedKmh: number, units: UnitSystem): DistanceParts {
	if (units === "mi") {
		return { value: (speedKmh / KM_PER_MILE).toFixed(1), unit: "mph" };
	}
	return { value: speedKmh.toFixed(1), unit: "km/h" };
}

export function formatSpeed(speedKmh: number, units: UnitSystem): string {
	const { value, unit } = formatSpeedParts(speedKmh, units);
	return `${value} ${unit}`;
}

export function formatElevationParts(elevationM: number, units: UnitSystem): DistanceParts {
	if (units === "mi") {
		return { value: Math.round(elevationM * FT_PER_M).toString(), unit: "ft" };
	}
	return { value: Math.round(elevationM).toString(), unit: "m" };
}

export function formatElevation(elevationM: number, units: UnitSystem): string {
	const { value, unit } = formatElevationParts(elevationM, units);
	return `${value} ${unit}`;
}

export function useUnits() {
	const units = useRedesignSettingsStore((s) => s.units) as UnitSystem;
	return {
		units,
		formatDistance: (km: number) => formatDistance(km, units),
		formatDistanceParts: (km: number) => formatDistanceParts(km, units),
		formatSpeed: (kmh: number) => formatSpeed(kmh, units),
		formatSpeedParts: (kmh: number) => formatSpeedParts(kmh, units),
		formatElevation: (m: number) => formatElevation(m, units),
		formatElevationParts: (m: number) => formatElevationParts(m, units),
	};
}
