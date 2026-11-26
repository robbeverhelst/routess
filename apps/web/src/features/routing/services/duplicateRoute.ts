import type { ApiRoute } from "@routess/api-client";
import { routeOriginFields } from "@routess/core";

import type { CreateRouteRequest } from "@/lib/api";

/**
 * The create request for a copy of one of the user's own Routes: its geometry
 * and metrics, its Provenance, and a fork's ExternalRoute so the copy keeps
 * the inherited license (ADR 0035). The caller picks the visibility.
 */
export const duplicateRouteRequest = (route: ApiRoute): CreateRouteRequest => ({
	name: `${route.name} (copy)`,
	description: route.description,
	activity: route.activity,
	tags: route.tags,
	waypoints: route.waypoints,
	geometry: route.geometry,
	distance: route.distance,
	duration: route.duration,
	elevationGain: route.elevationGain,
	startAddress: route.startAddress,
	endAddress: route.endAddress,
	...(route.routingPreferences ? { routingPreferences: route.routingPreferences } : {}),
	...routeOriginFields({ provenance: route.provenance, forkedFromExternalRouteId: route.forkedFrom?.externalRouteId }),
});
