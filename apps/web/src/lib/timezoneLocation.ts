import { TIMEZONE_LOCATIONS } from "./timezoneLocations.generated";

// Legacy zone names some browsers/OSes still report, mapped to their canonical form.
const TIMEZONE_ALIASES: Record<string, string> = {
	"Asia/Calcutta": "Asia/Kolkata",
	"Asia/Saigon": "Asia/Ho_Chi_Minh",
	"Asia/Rangoon": "Asia/Yangon",
	"Asia/Katmandu": "Asia/Kathmandu",
	"Europe/Kiev": "Europe/Kyiv",
	"America/Buenos_Aires": "America/Argentina/Buenos_Aires",
	"America/Godthab": "America/Nuuk",
	"Atlantic/Faeroe": "Atlantic/Faroe",
	"Pacific/Ponape": "Pacific/Pohnpei",
	"Pacific/Truk": "Pacific/Chuuk",
};

export function getLocationForTimezone(timezone: string): [number, number] | null {
	const canonical = TIMEZONE_ALIASES[timezone] ?? timezone;
	return TIMEZONE_LOCATIONS[canonical] ?? null;
}

// Approximate [longitude, latitude] of the browser's IANA timezone, e.g.
// "Europe/Brussels" -> Brussels. City-level accuracy at best; only meant as a
// first-load fallback until real geolocation is available.
export function getTimezoneFallbackLocation(): [number, number] | null {
	try {
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (!timezone) return null;
		return getLocationForTimezone(timezone);
	} catch {
		return null;
	}
}
