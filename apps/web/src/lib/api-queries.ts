import type {
	ApiPersonalAccessToken,
	ApiPersonalAccessTokenWithSecret,
	CreatePersonalAccessTokenRequest,
} from "@routess/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoutingStore } from "@/stores/routingStore";
import { trackEvent } from "./analytics/track";
import { type ApiRoute, apiService, type CreateRouteRequest } from "./api";
import { getStoredUser, hasStoredUser } from "./auth-state";
import { googleAuth } from "./google-auth";
import { Logger } from "./logger";
import { queryKeys } from "./query-client";

// ============================================================================
// ROUTE QUERIES
// ============================================================================

/**
 * Hook to fetch all routes for the current user
 */
export function useUserRoutes() {
	const hasUser = hasStoredUser();

	return useQuery({
		queryKey: queryKeys.routes.list(),
		queryFn: async () => {
			// Double-check authentication before making the call
			if (!hasStoredUser()) {
				throw new Error("No authenticated user available");
			}

			const routes = await apiService.getRoutes();
			Logger.info(`Fetched ${routes.length} routes from API`);
			return routes;
		},
		enabled: hasUser, // Only fetch if authenticated
		staleTime: 2 * 60 * 1000, // Routes are fresh for 2 minutes
		retry: hasUser ? 2 : false, // Only retry if authenticated
		refetchOnWindowFocus: hasUser, // Only refetch on focus if authenticated
	});
}

/**
 * Hook to fetch a specific route by ID
 */
export function useRoute(routeId: number) {
	return useQuery({
		queryKey: queryKeys.routes.detail(routeId.toString()),
		queryFn: () => apiService.getRoute(routeId),
		enabled: !!routeId, // Only run if routeId exists
	});
}

// ============================================================================
// ROUTE MUTATIONS
// ============================================================================

/**
 * Hook to save a new route
 */
export function useSaveRoute() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (routeData: CreateRouteRequest) => {
			Logger.info("Saving route:", routeData.name);
			return apiService.createRoute(routeData);
		},
		onSuccess: (newRoute, vars) => {
			const existingRoutes = queryClient.getQueryData<ApiRoute[]>(queryKeys.routes.list());
			const isFirstRoute = !existingRoutes || existingRoutes.length === 0;

			queryClient.invalidateQueries({ queryKey: queryKeys.routes.list() });
			queryClient.setQueryData(queryKeys.routes.detail(newRoute.id.toString()), newRoute);

			trackEvent({
				name: "route_created",
				properties: {
					waypoint_count: vars.waypoints.length,
					distance_m: Math.round(vars.distance ?? 0),
					elevation_gain_m: Math.round(vars.elevationGain ?? 0),
					has_description: !!vars.description,
					activity: vars.activity ?? null,
					visibility: vars.visibility ?? "private",
					tag_count: vars.tags?.length ?? 0,
					is_first_route: isFirstRoute,
					// RouteDraft does not yet track origin; revisit when route
					// generation (#136) and GPX-imported drafts can be differentiated.
					creation_source: "manual",
				},
			});

			Logger.info("Route saved successfully:", newRoute.id);
		},
		onError: (error) => {
			Logger.error("Failed to save route:", error);
		},
	});
}

/**
 * Hook to delete a route
 */
export function useDeleteRoute() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (routeId: number) => {
			Logger.info("Deleting route:", routeId);
			return apiService.deleteRoute(routeId);
		},
		onSuccess: (_, routeId) => {
			// Remove from routes list cache
			queryClient.invalidateQueries({ queryKey: queryKeys.routes.list() });

			// Remove specific route from cache
			queryClient.removeQueries({ queryKey: queryKeys.routes.detail(routeId.toString()) });

			// If the deleted route was the one currently being edited in the
			// plan panel, drop the binding so the next save creates a new route.
			const routing = useRoutingStore.getState();
			if (routing.mode.kind === "editing" && routing.mode.routeId === routeId) {
				routing.setMode({ kind: "unsaved" });
			}

			trackEvent({ name: "route_deleted", properties: {} });

			Logger.info("Route deleted successfully:", routeId);
		},
		onError: (error) => {
			Logger.error("Failed to delete route:", error);
		},
	});
}

/**
 * Hook to update an existing route
 */
export function useUpdateRoute() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ routeId, updates }: { routeId: number; updates: Partial<ApiRoute> }) => {
			Logger.info("Updating route:", routeId);
			return apiService.updateRoute(routeId, updates);
		},
		onSuccess: (updatedRoute, vars) => {
			// Update the specific route in cache
			queryClient.setQueryData(queryKeys.routes.detail(updatedRoute.id.toString()), updatedRoute);

			// Invalidate routes list to ensure consistency
			queryClient.invalidateQueries({ queryKey: queryKeys.routes.list() });

			trackEvent({
				name: "route_updated",
				properties: { changed: Object.keys(vars.updates) },
			});

			Logger.info("Route updated successfully:", updatedRoute.id);
		},
		onError: (error) => {
			Logger.error("Failed to update route:", error);
		},
	});
}

// ============================================================================
// USER QUERIES
// ============================================================================

/**
 * Hook to fetch current user profile
 */
export function useUserProfile() {
	const hasUser = hasStoredUser();

	return useQuery({
		queryKey: queryKeys.user.profile(),
		queryFn: async () => {
			// Double-check authentication before making the call
			if (!hasStoredUser()) {
				throw new Error("No authenticated user available");
			}

			const profile = await apiService.getProfile();
			Logger.info("Fetched user profile:", profile.email);
			return profile;
		},
		enabled: hasUser, // Only fetch if authenticated
		staleTime: 5 * 60 * 1000, // Profile is fresh for 5 minutes
		retry: hasUser ? 1 : false, // Only retry once if authenticated
		refetchOnWindowFocus: hasUser, // Only refetch on focus if authenticated
	});
}

// Note: Profile update functionality can be added when API endpoint is available

// ============================================================================
// AUTH QUERIES
// ============================================================================

/**
 * Hook to check authentication status.
 *
 * Reads the stored user from localStorage and treats them as authenticated.
 * We deliberately do NOT probe the server here: the ApiClient already clears
 * auth state on any 401 from a real user action, so a separate probe at boot
 * just bounces returning users to the login screen on any transient failure
 * (cold dev API, cookie expiry) before they've done anything. If the session
 * is actually invalid, the first protected request will surface that and
 * route the user to login through the auth-change event.
 */
export function useAuthStatus() {
	const storedUser = getStoredUser();

	return useQuery({
		queryKey: queryKeys.auth.session(),
		queryFn: () => {
			const current = getStoredUser();
			return current ? { isAuthenticated: true, user: current } : { isAuthenticated: false, user: null };
		},
		initialData: storedUser ? { isAuthenticated: true, user: storedUser } : { isAuthenticated: false, user: null },
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnMount: false,
	});
}

/**
 * Hook to logout user properly
 */
export function useLogout() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			await googleAuth.signOut();
			Logger.info("User logged out");
		},
		onSuccess: () => {
			// Clear all cached data on logout
			queryClient.clear();
			trackEvent({ name: "user_logged_out", properties: {} });
			Logger.info("Cache cleared after logout");
		},
		onError: (error) => {
			Logger.error("Logout failed:", error);
			// Even if logout fails, clear local state
			googleAuth.clearAuthState();
			queryClient.clear();
		},
	});
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

// ============================================================================
// PERSONAL ACCESS TOKENS
// ============================================================================

/**
 * List the current user's active personal access tokens. Plaintext is never
 * present in the list response; only metadata.
 */
export function usePersonalAccessTokens() {
	const hasUser = hasStoredUser();

	return useQuery<ApiPersonalAccessToken[]>({
		queryKey: queryKeys.auth.tokens(),
		queryFn: () => apiService.listPersonalAccessTokens(),
		enabled: hasUser,
		staleTime: 30 * 1000,
	});
}

/**
 * Mint a new PAT. The mutation result includes the plaintext exactly once.
 * Surface it to the user immediately; subsequent reads return only metadata.
 */
export function useCreatePersonalAccessToken() {
	const queryClient = useQueryClient();

	return useMutation<ApiPersonalAccessTokenWithSecret, Error, CreatePersonalAccessTokenRequest>({
		mutationFn: (body) => apiService.createPersonalAccessToken(body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.auth.tokens() });
		},
		onError: (error) => {
			Logger.error("Failed to create personal access token:", error);
		},
	});
}

/**
 * Revoke a PAT by id. Soft-revoke is idempotent server-side.
 */
export function useRevokePersonalAccessToken() {
	const queryClient = useQueryClient();

	return useMutation<void, Error, number>({
		mutationFn: (id) => apiService.revokePersonalAccessToken(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.auth.tokens() });
		},
		onError: (error) => {
			Logger.error("Failed to revoke personal access token:", error);
		},
	});
}

/**
 * Hook to prefetch routes for better UX
 */
export function usePrefetchRoutes() {
	const queryClient = useQueryClient();

	return () => {
		if (hasStoredUser()) {
			queryClient.prefetchQuery({
				queryKey: queryKeys.routes.list(),
				queryFn: apiService.getRoutes,
				staleTime: 2 * 60 * 1000,
			});
		}
	};
}
