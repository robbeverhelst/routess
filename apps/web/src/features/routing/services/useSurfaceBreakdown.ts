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

		const controller = new AbortController();
		setLoading(true);

		const timer = window.setTimeout(() => {
			fetchSurfaceBreakdown(routePath, costing, controller.signal)
				.then((result) => {
					if (controller.signal.aborted) return;
					setBreakdown(result);
				})
				.catch((err) => {
					if (controller.signal.aborted) return;
					Logger.warn("[useSurfaceBreakdown] failed:", err);
					setBreakdown(null);
				})
				.finally(() => {
					if (!controller.signal.aborted) setLoading(false);
				});
		}, 400);

		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [key, routePath, costing]);

	return { breakdown, loading };
}
