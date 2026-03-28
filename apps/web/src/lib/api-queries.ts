import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiRoute, apiService, type Waypoint } from "./api";
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
	const hasToken = !!localStorage.getItem("access_token");

	return useQuery({
		queryKey: queryKeys.routes.list(),
		queryFn: async () => {
			// Double-check authentication before making the call
			if (!localStorage.getItem("access_token")) {
				throw new Error("No authentication token available");
			}

			const routes = await apiService.getRoutes();
			Logger.info(`Fetched ${routes.length} routes from API`);
			return routes;
		},
		enabled: hasToken, // Only fetch if authenticated
		staleTime: 2 * 60 * 1000, // Routes are fresh for 2 minutes
		retry: hasToken ? 2 : false, // Only retry if we have a token
		refetchOnWindowFocus: hasToken, // Only refetch on focus if authenticated
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
		mutationFn: async (routeData: {
			name: string;
			description?: string;
			waypoints: Waypoint[];
			distance: number;
			elevationGain: number;
		}) => {
			Logger.info("Saving route:", routeData.name);
			return apiService.createRoute(routeData);
		},
		onSuccess: (newRoute) => {
			// Invalidate and refetch routes list
			queryClient.invalidateQueries({ queryKey: queryKeys.routes.list() });

			// Add the new route to the cache
			queryClient.setQueryData(queryKeys.routes.detail(newRoute.id.toString()), newRoute);

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
	const hasToken = !!localStorage.getItem("access_token");

	return useQuery({
		queryKey: queryKeys.user.profile(),
		queryFn: async () => {
			// Double-check authentication before making the call
			if (!localStorage.getItem("access_token")) {
				throw new Error("No authentication token available");
			}

			const profile = await apiService.getProfile();
			Logger.info("Fetched user profile:", profile.email);
			return profile;
		},
		enabled: hasToken, // Only fetch if authenticated
		staleTime: 5 * 60 * 1000, // Profile is fresh for 5 minutes
		retry: hasToken ? 1 : false, // Only retry once if we have a token
		refetchOnWindowFocus: hasToken, // Only refetch on focus if authenticated
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
	const hasToken = !!localStorage.getItem("access_token");

	return useQuery({
		queryKey: queryKeys.auth.session(),
		queryFn: async () => {
			try {
				const isValid = await googleAuth.validateSession();

				if (isValid) {
					const profile = await apiService.getProfile();
					return { isAuthenticated: true, user: profile };
				} else {
					return { isAuthenticated: false, user: null };
				}
			} catch (error) {
				Logger.error("Auth status check failed:", error);
				return { isAuthenticated: false, user: null };
			}
		},
		enabled: hasToken, // Only check if we have a token
		staleTime: 2 * 60 * 1000, // Check auth every 2 minutes
		retry: false, // Don't retry auth checks
		refetchOnWindowFocus: true, // Recheck when window gains focus
		refetchOnMount: true, // Always check on mount
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
		const hasToken = !!localStorage.getItem("access_token");
		if (hasToken) {
			queryClient.prefetchQuery({
				queryKey: queryKeys.routes.list(),
				queryFn: apiService.getRoutes,
				staleTime: 2 * 60 * 1000,
			});
		}
	};
}
