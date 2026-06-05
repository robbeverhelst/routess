import type { ApiRoute } from "@routess/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { apiService } from "@/lib/api";
import { Logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-client";
import { useUiStore } from "@/stores/uiStore";

// One-time migration of the legacy localStorage favourites to the server-side
// favourite flag. Runs once per session after the route list loads; stale IDs
// (deleted routes, other accounts) are simply dropped.
export function useFavouritesMigration(routes: ApiRoute[] | undefined) {
	const queryClient = useQueryClient();
	const ranRef = useRef(false);

	useEffect(() => {
		if (ranRef.current || !routes) return;
		const localIds = useUiStore.getState().favouriteRouteIds;
		if (localIds.length === 0) return;
		ranRef.current = true;

		const toMigrate = routes.filter((r) => localIds.includes(r.id) && !r.favourite);
		Promise.allSettled(toMigrate.map((r) => apiService.updateRoute(r.id, { favourite: true })))
			.then((results) => {
				const failed = results.filter((r) => r.status === "rejected").length;
				if (failed > 0) {
					Logger.warn(`[useFavouritesMigration] ${failed} favourite(s) failed to migrate`);
				}
				useUiStore.setState({ favouriteRouteIds: [] });
				if (toMigrate.length > 0) {
					queryClient.invalidateQueries({ queryKey: queryKeys.routes.list() });
				}
			})
			.catch((error) => {
				Logger.error("[useFavouritesMigration] migration failed:", error);
			});
	}, [routes, queryClient]);
}
