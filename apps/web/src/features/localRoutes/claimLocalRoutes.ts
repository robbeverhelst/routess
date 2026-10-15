import { ApiDomainError } from "@routess/api-client";
import { proGateOf } from "@routess/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/track";
import { type ApiRoute, apiService, type CreateRouteRequest } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { queryKeys } from "@/lib/query-client";
import { useToastStore } from "@/stores/toastStore";
import { useLocalRoutesStore } from "./localRoutesStore";

export interface ClaimResult {
	claimed: number;
	// Still on the device: the free saved-Route cap was reached, or a request
	// failed and the next sign-in retries them.
	leftOnDevice: number;
	hitRouteLimit: boolean;
}

type CreateRoute = (route: CreateRouteRequest) => Promise<ApiRoute>;

let inFlight: Promise<ClaimResult> | null = null;

// Moves the LocalRoutes on this device into the signed-in account, oldest
// first. Each one is sent with its localId as clientRef, so the API returns
// the existing Route on a replay (a retry after a lost response, a second
// tab, a later sign-in) and a claim can never duplicate. A LocalRoute leaves
// the device only once the account holds it. Must only run signed in: this
// is the one place device routes reach the server.
export function claimLocalRoutes(createRoute: CreateRoute = (route) => apiService.createRoute(route)) {
	inFlight ??= runClaim(createRoute).finally(() => {
		inFlight = null;
	});
	return inFlight;
}

async function runClaim(createRoute: CreateRoute): Promise<ClaimResult> {
	const store = useLocalRoutesStore.getState();
	if (!store.hydrated) await store.hydrate();
	const pending = [...useLocalRoutesStore.getState().routes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	const result: ClaimResult = { claimed: 0, leftOnDevice: pending.length, hitRouteLimit: false };
	if (pending.length === 0) return result;

	for (const localRoute of pending) {
		try {
			await createRoute({ ...localRoute.route, clientRef: localRoute.localId });
		} catch (error) {
			result.hitRouteLimit =
				error instanceof ApiDomainError && proGateOf(error.payload)?.reason === "saved_route_limit";
			if (!result.hitRouteLimit) Logger.warn("[claimLocalRoutes] claim stopped, retrying on next sign-in:", error);
			break;
		}
		await useLocalRoutesStore.getState().remove(localRoute.localId);
		result.claimed += 1;
		result.leftOnDevice -= 1;
	}

	trackEvent({
		name: "local_routes_claimed",
		properties: {
			claimed_count: result.claimed,
			left_on_device_count: result.leftOnDevice,
			hit_route_limit: result.hitRouteLimit,
		},
	});
	return result;
}

// Claims this device's routes whenever someone signs in (or a session
// resumes) on it, then refreshes the library and the saved-Route count.
export function useClaimLocalRoutes(userId: number | null) {
	const queryClient = useQueryClient();
	const pushToast = useToastStore((s) => s.push);

	useEffect(() => {
		if (userId == null) return;
		let cancelled = false;
		claimLocalRoutes()
			.then((result) => {
				if (result.claimed > 0) {
					queryClient.invalidateQueries({ queryKey: queryKeys.routes.list() });
					queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
				}
				if (cancelled || (result.claimed === 0 && !result.hitRouteLimit)) return;
				pushToast({
					kind: result.hitRouteLimit ? "warn" : "success",
					title: t("library.device.claimed", { count: String(result.claimed) }),
					...(result.leftOnDevice > 0
						? {
								body: t(result.hitRouteLimit ? "library.device.claimLeftLimit" : "library.device.claimLeftRetry", {
									count: String(result.leftOnDevice),
								}),
							}
						: {}),
				});
			})
			.catch((error: unknown) => Logger.error("[useClaimLocalRoutes] claim failed:", error));
		return () => {
			cancelled = true;
		};
	}, [userId, queryClient, pushToast]);
}
