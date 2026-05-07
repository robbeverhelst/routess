import type { RoutingProfile } from "@/stores/routingPreferencesStore";

export type MapboxProfile = "mapbox/walking" | "mapbox/cycling" | "mapbox/driving";
export type ValhallaCosting = "pedestrian" | "bicycle" | "auto";

export function resolveMapboxProfile(activityLabel: string, profile: RoutingProfile): MapboxProfile {
	if (activityLabel === "Running" || activityLabel === "Walking") return "mapbox/walking";
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

export function resolveValhallaCosting(activityLabel: string, profile: RoutingProfile): ValhallaCosting {
	return mapMapboxProfileToValhallaCosting(resolveMapboxProfile(activityLabel, profile));
}
