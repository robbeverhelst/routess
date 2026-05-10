import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUiStore } from "@/stores/uiStore";
import { track } from "./analytics";
import { type ApiRoute, apiService, type CreateRouteRequest } from "./api";
import { hasStoredUser, storeUser } from "./auth-state";
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
			queryClient.invalidateQueries({ queryKey: queryKeys.routes.list() });
			queryClient.setQueryData(queryKeys.routes.detail(newRoute.id.toString()), newRoute);

			track("route_saved", {
				waypoint_count: vars.waypoints.length,
				distance_m: Math.round(vars.distance ?? 0),
				elevation_gain_m: Math.round(vars.elevationGain ?? 0),
				has_description: !!vars.description,
				activity: vars.activity ?? null,
				privacy: vars.privacy ?? "private",
				tag_count: vars.tags?.length ?? 0,
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
			// plan panel, drop the link so the next save creates a new route.
			const ui = useUiStore.getState();
			if (ui.loadedRoute?.id === routeId) {
				ui.setLoadedRoute(null);
			}

			track("route_deleted");

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
		onSuccess: (updatedRoute) => {
			// Update the specific route in cache
			queryClient.setQueryData(queryKeys.routes.detail(updatedRoute.id.toString()), updatedRoute);

			// Invalidate routes list to ensure consistency
			queryClient.invalidateQueries({ queryKey: queryKeys.routes.list() });

			track("route_updated");

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
 * Hook to check authentication status with proper token validation
 */
export function useAuthStatus() {
	const hasUser = hasStoredUser();

	return useQuery({
		queryKey: queryKeys.auth.session(),
		queryFn: async () => {
			try {
				const isValid = await googleAuth.validateSession();

				if (isValid) {
					const profile = await apiService.getProfile();
					storeUser(profile);
					return { isAuthenticated: true, user: profile };
				} else {
					return { isAuthenticated: false, user: null };
				}
			} catch (error) {
				Logger.error("Auth status check failed:", error);
				return { isAuthenticated: false, user: null };
			}
		},
		enabled: hasUser,
		staleTime: 10 * 60 * 1000,
		retry: false, // Don't retry auth checks
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
			track("logout");
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
