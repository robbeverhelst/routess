import type { Provenance, RoutingPreferences } from "../routing/types";
import type { Coordinate, Waypoint } from "../types";
import type { RouteState } from "./routing";

/** The RouteDraft state a save reads. */
export type RouteDraftSaveState = Pick<
	RouteState,
	| "waypoints"
	| "routePath"
	| "distanceMeters"
	| "durationSeconds"
	| "elevationGain"
	| "routingPreferences"
	| "creationSource"
	| "forkedFromExternalRouteId"
>;

/** The geometry and metrics a save sends, for a new Route and an update alike. */
export interface RouteDraftSaveFields {
	waypoints: Waypoint[];
	geometry?: Coordinate[];
	distance: number;
	duration?: number;
	elevationGain: number;
	routingPreferences?: RoutingPreferences;
}

/** How the draft came to exist, as a create request states it. */
export interface RouteDraftOriginFields {
	provenance?: Extract<Provenance, "generation">;
	forkedFromExternalRouteId?: number;
}

export function draftSaveFields(
	draft: Omit<RouteDraftSaveState, "creationSource" | "forkedFromExternalRouteId">,
): RouteDraftSaveFields {
	return {
		waypoints: draft.waypoints,
		...(draft.routePath.length >= 2 ? { geometry: draft.routePath } : {}),
		distance: draft.distanceMeters ?? 0,
		duration: draft.durationSeconds ?? undefined,
		elevationGain: draft.elevationGain != null ? Math.round(draft.elevationGain) : 0,
		...(draft.routingPreferences ? { routingPreferences: draft.routingPreferences } : {}),
	};
}

export function draftOriginFields(
	draft: Pick<RouteDraftSaveState, "creationSource" | "forkedFromExternalRouteId">,
): RouteDraftOriginFields {
	// A fork names its ExternalRoute; the server sets Provenance external-fork
	// and the inherited license from it (ADR 0035).
	if (draft.forkedFromExternalRouteId != null) return { forkedFromExternalRouteId: draft.forkedFromExternalRouteId };
	// A draft born from a confirmed GenerationCandidate saves with Provenance
	// "generation" (immutable, per ADR-0023/0029).
	if (draft.creationSource === "generated") return { provenance: "generation" };
	return {};
}

/** Everything a new Route takes from the draft; the caller adds name, activity, visibility and tags. */
export function draftToCreateRequest(draft: RouteDraftSaveState): RouteDraftSaveFields & RouteDraftOriginFields {
	return { ...draftSaveFields(draft), ...draftOriginFields(draft) };
}
