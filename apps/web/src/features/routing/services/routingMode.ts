import type { RoutingProfile } from "@/stores/routingPreferencesStore";

export type MapboxProfile = "mapbox/walking" | "mapbox/cycling" | "mapbox/driving";
export type ValhallaCosting = "pedestrian" | "bicycle" | "auto";

export function resolveMapboxProfile(defaultActivity: string, profile: RoutingProfile): MapboxProfile {
	if (defaultActivity === "Running" || defaultActivity === "Walking") return "mapbox/walking";
	if (profile === "flat") return "mapbox/driving";
	return "mapbox/cycling";
}

export function mapMapboxProfileToValhallaCosting(profile: MapboxProfile): ValhallaCosting {
	switch (profile) {
		case "mapbox/walking":
			return "pedestrian";
		case "mapbox/driving":
			return "auto";
		default:
			return "bicycle";
	}
}

export function resolveValhallaCosting(defaultActivity: string, profile: RoutingProfile): ValhallaCosting {
	return mapMapboxProfileToValhallaCosting(resolveMapboxProfile(defaultActivity, profile));
}
