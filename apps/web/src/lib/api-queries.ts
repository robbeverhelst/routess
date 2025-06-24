import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiService, type ApiRoute, type Waypoint } from "./api";
import { queryKeys } from "./query-client";
import { Logger } from "./logger";

// ============================================================================
// ROUTE QUERIES
// ============================================================================

/**
 * Hook to fetch all routes for the current user
 */
export function useUserRoutes() {
  return useQuery({
    queryKey: queryKeys.routes.list(),
    queryFn: async () => {
      const routes = await apiService.getRoutes();
      Logger.info(`Fetched ${routes.length} routes from API`);
      return routes;
    },
    staleTime: 2 * 60 * 1000, // Routes are fresh for 2 minutes
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
  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: async () => {
      const profile = await apiService.getProfile();
      Logger.info("Fetched user profile:", profile.email);
      return profile;
    },
    staleTime: 5 * 60 * 1000, // Profile is fresh for 5 minutes
    retry: 1, // Only retry once for auth-related queries
  });
}

// Note: Profile update functionality can be added when API endpoint is available

// ============================================================================
// AUTH QUERIES
// ============================================================================

/**
 * Hook to check authentication status
 */
export function useAuthStatus() {
  return useQuery({
    queryKey: queryKeys.auth.session(),
    queryFn: async () => {
      try {
        const profile = await apiService.getProfile();
        return { isAuthenticated: true, user: profile };
      } catch {
        return { isAuthenticated: false, user: null };
      }
    },
    staleTime: 30 * 1000, // Check auth every 30 seconds
    retry: false, // Don't retry auth checks
  });
}

/**
 * Hook to logout user
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Clear any auth tokens/session data
      localStorage.removeItem("auth-token");
      Logger.info("User logged out");
    },
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear();
      Logger.info("Cache cleared after logout");
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
    queryClient.prefetchQuery({
      queryKey: queryKeys.routes.list(),
      queryFn: apiService.getRoutes,
      staleTime: 2 * 60 * 1000,
    });
  };
}
