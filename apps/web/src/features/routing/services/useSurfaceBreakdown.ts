import type { Coordinate } from "@routess/core";
import { useEffect, useMemo, useState } from "react";
import { Logger } from "@/lib/logger";
import { useRoutingPreferencesStore } from "@/redesign/stores/routingPreferencesStore";
import { useRedesignSettingsStore } from "@/redesign/stores/settingsStore";
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

export function useSurfaceBreakdown(routePath: Coordinate[], hasRoute: boolean): SurfaceState {
	const [breakdown, setBreakdown] = useState<SurfaceBreakdown | null>(null);
	const [loading, setLoading] = useState(false);
	const defaultActivity = useRedesignSettingsStore((s) => s.defaultActivity);
	const routingProfile = useRoutingPreferencesStore((s) => s.profile);
	const costing = useMemo(
		() => resolveValhallaCosting(defaultActivity, routingProfile),
		[defaultActivity, routingProfile],
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
		// Public Valhalla instance is occasionally slow or unreachable; cap any
		// single attempt so the loading flag can resolve instead of sticking.
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
						Logger.warn("[useSurfaceBreakdown] failed:", err);
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
	}, [key, routePath, costing]);

	return { breakdown, loading };
}
