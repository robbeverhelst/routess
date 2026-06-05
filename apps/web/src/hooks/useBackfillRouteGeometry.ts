import type { ApiRoute } from "@routess/api-client";
import type { RoutingPreferences } from "@routess/core";
import { useEffect, useRef } from "react";
import { computeRoute } from "@/features/routing/services/valhallaClient";
import { useUpdateRoute } from "@/lib/api-queries";
import { Logger } from "@/lib/logger";
import { useLibraryStore } from "@/stores/libraryStore";

const FALLBACK_PREFS: RoutingPreferences = { surfacePreference: "mixed", avoidFerries: false, avoidHighways: false };

// Self-healing geometry: routes saved before geometry persistence preview as
// straight waypoint-to-waypoint lines. When such a route gets selected,
// compute the real path once and persist it, fixing the preview and the
// thumbnails permanently. Only fills in missing geometry; existing geometry
// is never recomputed (see ADR-0023 on not silently recalculating).
export function useBackfillRouteGeometry(route: ApiRoute | null) {
	const updateRoute = useUpdateRoute();
	const attemptedIds = useRef<Set<number>>(new Set());

	useEffect(() => {
		if (!route) return;
		if (route.geometry && route.geometry.length >= 2) return;
		if ((route.waypoints?.length ?? 0) < 2) return;
		if (attemptedIds.current.has(route.id)) return;
		attemptedIds.current.add(route.id);

		const activity = route.activity ?? "cycle";
		const prefs = route.routingPreferences ?? FALLBACK_PREFS;
		void computeRoute(route.waypoints, activity, prefs, { snap: false }).then((result) => {
			if (!result.ok) {
				Logger.warn(`[useBackfillRouteGeometry] route ${route.id}: ${result.error}`);
				return;
			}
			if (result.offline || result.routePath.length < 2) return;
			updateRoute.mutate(
				{
					routeId: route.id,
					updates: {
						geometry: result.routePath,
						...(route.distance == null ? { distance: Math.round(result.distanceKm * 1000) } : {}),
						...(route.duration == null ? { duration: result.durationMinutes * 60 } : {}),
					},
				},
				{
					onSuccess: (updated) => {
						// Refresh the live preview if this route is still selected.
						if (useLibraryStore.getState().selectedRoute?.id === updated.id) {
							useLibraryStore.setState({ selectedRoute: updated });
						}
					},
				},
			);
		});
	}, [route, updateRoute]);
}
