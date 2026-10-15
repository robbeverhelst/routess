import { useState } from "react";
import type { CreationSource } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";
import type { CreateRouteRequest } from "@/lib/api";
import { type SaveLocalRouteResult, useLocalRoutesStore } from "./localRoutesStore";

// Saves the draft on this device for someone without an account. A new
// LocalRoute fires route_created too (storage "device"), so draft→saved counts
// every save whether or not the person has signed up; local_route_saved fires
// on every save, updates included.
export async function saveLocalRoute(
	route: CreateRouteRequest,
	creationSource: CreationSource,
): Promise<SaveLocalRouteResult> {
	const countBefore = useLocalRoutesStore.getState().routes.length;
	const result = await useLocalRoutesStore.getState().save(route, creationSource);
	const distance_m = Math.round(route.distance ?? 0);
	if (!result.isUpdate) {
		trackEvent({
			name: "route_created",
			properties: {
				waypoint_count: route.waypoints.length,
				distance_m,
				elevation_gain_m: Math.round(route.elevationGain ?? 0),
				has_description: !!route.description,
				activity: route.activity ?? null,
				visibility: "private",
				tag_count: route.tags?.length ?? 0,
				is_first_route: countBefore === 0,
				creation_source: creationSource,
				storage: "device",
			},
		});
	}
	trackEvent({
		name: "local_route_saved",
		properties: {
			waypoint_count: route.waypoints.length,
			distance_m,
			activity: route.activity ?? null,
			creation_source: result.localRoute.creationSource,
			is_update: result.isUpdate,
			local_route_count: useLocalRoutesStore.getState().routes.length,
		},
	});
	return result;
}

export function useSaveLocalRoute() {
	const [isPending, setIsPending] = useState(false);
	const mutate = async (route: CreateRouteRequest, creationSource: CreationSource) => {
		setIsPending(true);
		try {
			return await saveLocalRoute(route, creationSource);
		} finally {
			setIsPending(false);
		}
	};
	return { mutate, isPending };
}
