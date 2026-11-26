import type { Provenance, RoutingPreferences } from "../routing/types";
import type { Coordinate, Waypoint } from "../types";
import type { DraftProvenance, RouteState } from "./routing";

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
	| "provenance"
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
	provenance?: DraftProvenance;
	forkedFromExternalRouteId?: number;
}

export function draftSaveFields(
	draft: Omit<RouteDraftSaveState, "creationSource" | "forkedFromExternalRouteId" | "provenance">,
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
	draft: Pick<RouteDraftSaveState, "creationSource" | "forkedFromExternalRouteId" | "provenance">,
): RouteDraftOriginFields {
	// A draft loaded from a Route or a GPX file keeps that Provenance; one born
	// from a confirmed GenerationCandidate saves with Provenance "generation"
	// (immutable, per ADR-0023/0029).
	return routeOriginFields({
		provenance: draft.provenance ?? (draft.creationSource === "generated" ? "generation" : null),
		forkedFromExternalRouteId: draft.forkedFromExternalRouteId,
	});
}

/** How a new Route made from an existing one (a draft's source, a duplicate) states its origin. */
export function routeOriginFields(source: {
	provenance?: Provenance | null;
	forkedFromExternalRouteId?: number | null;
}): RouteDraftOriginFields {
	// A fork names its ExternalRoute; the server sets Provenance external-fork
	// and the inherited license from it (ADR 0035).
	if (source.forkedFromExternalRouteId != null) return { forkedFromExternalRouteId: source.forkedFromExternalRouteId };
	if (!source.provenance || source.provenance === "external-fork") return {};
	return { provenance: source.provenance };
}

/** Everything a new Route takes from the draft; the caller adds name, activity, visibility and tags. */
export function draftToCreateRequest(draft: RouteDraftSaveState): RouteDraftSaveFields & RouteDraftOriginFields {
	return { ...draftSaveFields(draft), ...draftOriginFields(draft) };
}
