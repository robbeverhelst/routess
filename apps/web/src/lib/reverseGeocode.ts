import { useEffect, useState } from "react";
import { getRuntimeConfig } from "@/lib/runtime-config";

// Reverse-geocoded names per ~11m grid cell. null = lookup done, no name.
const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

type LngLat = [number, number];

const keyFor = (coord: LngLat) => `${coord[0].toFixed(4)},${coord[1].toFixed(4)}`;

interface GeocodeFeature {
	text?: string;
	place_type?: string[];
	context?: { id: string; text?: string }[];
}

// "Hebbestraat, Moerzeke" — feature name plus its locality/place context.
function shortName(f: GeocodeFeature): string | null {
	const name = f.text?.trim();
	if (!name) return null;
	const locality = f.context?.find((c) => c.id.startsWith("locality.") || c.id.startsWith("place."))?.text?.trim();
	if (locality && locality !== name) return `${name}, ${locality}`;
	return name;
}

export function reverseGeocode(coord: LngLat): Promise<string | null> {
	const key = keyFor(coord);
	const cached = cache.get(key);
	if (cached !== undefined) return Promise.resolve(cached);
	const inFlight = pending.get(key);
	if (inFlight) return inFlight;

	const token = getRuntimeConfig("VITE_MAPBOX_ACCESS_TOKEN");
	if (!token) return Promise.resolve(null);

	const p = (async () => {
		try {
			const res = await fetch(
				`https://api.mapbox.com/geocoding/v5/mapbox.places/${coord[0]},${coord[1]}.json?types=address,poi,neighborhood,locality,place&limit=1&access_token=${token}`,
			);
			if (!res.ok) return null;
			const data = (await res.json()) as { features?: GeocodeFeature[] };
			const name = data.features?.[0] ? shortName(data.features[0]) : null;
			cache.set(key, name);
			return name;
		} catch {
			return null;
		} finally {
			pending.delete(key);
		}
	})();
	pending.set(key, p);
	return p;
}

// Returns the place name for a coordinate, or null while loading/unavailable.
export function usePlaceName(coord: LngLat | null): string | null {
	const key = coord ? keyFor(coord) : null;
	const [name, setName] = useState<string | null>(() => (key ? (cache.get(key) ?? null) : null));

	// biome-ignore lint/correctness/useExhaustiveDependencies: key is the coord's identity; coord array is unstable
	useEffect(() => {
		if (!coord || !key) {
			setName(null);
			return;
		}
		const cached = cache.get(key);
		if (cached !== undefined) {
			setName(cached);
			return;
		}
		setName(null);
		let alive = true;
		void reverseGeocode(coord).then((n) => {
			if (alive) setName(n);
		});
		return () => {
			alive = false;
		};
	}, [key]);

	return name;
}
