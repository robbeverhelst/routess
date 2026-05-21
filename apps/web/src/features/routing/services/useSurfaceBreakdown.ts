import type { Coordinate } from "@routess/core";
import { useEffect, useMemo } from "react";
import { Logger } from "@/lib/logger";
import { activityKeyToLabel } from "@/stores/redesignSettingsStore";
import { useRouteSurfaceStore } from "@/stores/routeSurfaceStore";
import { useRoutingPreferencesStore } from "@/stores/routingPreferencesStore";
import { useDraftActivity, useHasRoute, useRoutePath } from "@/stores/routingStore";
import { useUiStore } from "@/stores/uiStore";
import { resolveValhallaCosting, type ValhallaCosting } from "./routingMode";
import { fetchSurfaceBreakdown, type SurfaceBreakdown } from "./SurfaceService";

interface SurfaceState {
	breakdown: SurfaceBreakdown | null;
	loading: boolean;
}

export function buildSurfaceBreakdownKey(routePath: Coordinate[], hasRoute: boolean, costing: ValhallaCosting): string {
	if (!hasRoute || routePath.length < 2) return "";
	return `${costing}:${routePath.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join("|")}`;
}

// Mount once near the app root. Watches the active route and keeps the
// shared route-surface store in sync. Both the plan panel and the map layer
// adapter read from that store, so we never double-fetch.
export function useRouteSurfaceSync(): void {
	const routePath = useRoutePath();
	const hasRoute = useHasRoute();
	const draftActivity = useDraftActivity();
	const globalActivity = useUiStore((s) => s.activityType);
	const routingProfile = useRoutingPreferencesStore((s) => s.profile);
	const setBreakdown = useRouteSurfaceStore((s) => s.setBreakdown);
	const setLoading = useRouteSurfaceStore((s) => s.setLoading);

	const activeActivity = draftActivity ?? globalActivity;
	const costing = useMemo(
		() => resolveValhallaCosting(activityKeyToLabel(activeActivity), routingProfile),
		[activeActivity, routingProfile],
	);
	const key = useMemo(() => buildSurfaceBreakdownKey(routePath, hasRoute, costing), [routePath, hasRoute, costing]);

	useEffect(() => {
		if (!key) {
			setBreakdown(null);
			setLoading(false);
			return;
		}

		let superseded = false;
		const controller = new AbortController();
		// Cap any single trace-attributes attempt so the loading flag can
		// resolve instead of sticking if the upstream Valhalla is slow.
		const requestTimeoutId = window.setTimeout(() => controller.abort(), 10000);
		setLoading(true);

		const debounceTimer = window.setTimeout(() => {
			fetchSurfaceBreakdown(routePath, costing, controller.signal)
				.then((result) => {
					if (superseded) return;
					setBreakdown(result);
					setLoading(false);
				})
				.catch((err) => {
					if (superseded) return;
					if ((err as Error)?.name !== "AbortError") {
						Logger.warn("[useRouteSurfaceSync] failed:", err);
					}
					setBreakdown(null);
					setLoading(false);
				})
				.finally(() => {
					window.clearTimeout(requestTimeoutId);
				});
		}, 400);

		return () => {
			superseded = true;
			window.clearTimeout(debounceTimer);
			window.clearTimeout(requestTimeoutId);
			controller.abort();
		};
	}, [key, routePath, costing, setBreakdown, setLoading]);
}

// Read-only selector for components that just want to display the breakdown.
export function useSurfaceBreakdown(): SurfaceState {
	const breakdown = useRouteSurfaceStore((s) => s.breakdown);
	const loading = useRouteSurfaceStore((s) => s.loading);
	return { breakdown, loading };
}
