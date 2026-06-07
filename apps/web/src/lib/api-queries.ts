import type {
	ApiCollection,
	ApiCollectionDetail,
	ApiDiscoverPage,
	ApiFeedPage,
	ApiFollows,
	ApiNotifications,
	ApiPersonalAccessToken,
	ApiPersonalAccessTokenWithSecret,
	ApiProfile,
	ApiProfileSummary,
	ApiRouteShare,
	CreateCollectionRequest,
	CreatePersonalAccessTokenRequest,
	SendRouteShareRequest,
	UpdateCollectionRequest,
} from "@routess/api-client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoutingStore } from "@/stores/routingStore";
import type { CreationSource } from "./analytics/events";
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
 * Hook to fetch a specific route by numeric ID or 32-hex share token.
 */
export function useRoute(routeRef: number | string) {
	return useQuery({
		queryKey: queryKeys.routes.detail(String(routeRef)),
		queryFn: () => apiService.getRoute(routeRef),
		enabled: !!routeRef, // Only run if a ref exists
	});
}

// ============================================================================
// ROUTE MUTATIONS
// ============================================================================

/**
 * Hook to save a new route. `creationSource` only feeds the route_created
 * event and is stripped before the API call.
 */
export function useSaveRoute() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			creationSource: _,
			...routeData
		}: CreateRouteRequest & { creationSource?: CreationSource }) => {
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
					// Drafts loaded from GPX are not differentiated yet; revisit
					// with route generation (#136).
					creation_source: vars.creationSource ?? "manual",
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

/**
 * Toggle the server-persisted favourite flag with an optimistic list update.
 */
export function useToggleFavourite() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ routeId, favourite }: { routeId: number; favourite: boolean }) =>
			apiService.updateRoute(routeId, { favourite }),
		onMutate: async ({ routeId, favourite }) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.routes.list() });
			const previous = queryClient.getQueryData<ApiRoute[]>(queryKeys.routes.list());
			if (previous) {
				queryClient.setQueryData(
					queryKeys.routes.list(),
					previous.map((r) => (r.id === routeId ? { ...r, favourite } : r)),
				);
			}
			return { previous };
		},
		onSuccess: (_data, vars) => {
			trackEvent({ name: "route_favourited", properties: { favourite: vars.favourite } });
		},
		onError: (error, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(queryKeys.routes.list(), context.previous);
			}
			Logger.error("Failed to toggle favourite:", error);
		},
		onSettled: (_data, _error, vars) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.routes.list() });
			queryClient.invalidateQueries({ queryKey: queryKeys.routes.detail(vars.routeId.toString()) });
		},
	});
}

// ============================================================================
// COLLECTION QUERIES
// ============================================================================

export function useCollections() {
	const hasUser = hasStoredUser();

	return useQuery<ApiCollection[]>({
		queryKey: queryKeys.collections.list(),
		queryFn: () => apiService.getCollections(),
		enabled: hasUser,
		staleTime: 2 * 60 * 1000,
		retry: hasUser ? 2 : false,
	});
}

/**
 * Single collection with its ordered routes. Also works for shared
 * (unlisted/public) collections viewed by non-owners or anonymous visitors.
 */
export function useCollection(collectionId: number | null) {
	return useQuery<ApiCollectionDetail>({
		queryKey: queryKeys.collections.detail(String(collectionId)),
		queryFn: () => apiService.getCollection(collectionId as number),
		enabled: collectionId != null,
	});
}

export function useCreateCollection() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: CreateCollectionRequest) => apiService.createCollection(body),
		onSuccess: (collection) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.collections.list() });
			trackEvent({ name: "collection_created", properties: { visibility: collection.visibility } });
		},
		onError: (error) => {
			Logger.error("Failed to create collection:", error);
		},
	});
}

export function useUpdateCollection() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ collectionId, updates }: { collectionId: number; updates: UpdateCollectionRequest }) =>
			apiService.updateCollection(collectionId, updates),
		onSuccess: (updated) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.collections.list() });
			queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(String(updated.id)) });
		},
		onError: (error) => {
			Logger.error("Failed to update collection:", error);
		},
	});
}

export function useDeleteCollection() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (collectionId: number) => apiService.deleteCollection(collectionId),
		onSuccess: (_, collectionId) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.collections.list() });
			queryClient.removeQueries({ queryKey: queryKeys.collections.detail(String(collectionId)) });
			trackEvent({ name: "collection_deleted", properties: {} });
		},
		onError: (error) => {
			Logger.error("Failed to delete collection:", error);
		},
	});
}

/**
 * Replace a collection's full ordered membership (add, remove, reorder).
 */
export function useSetCollectionRoutes() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ collectionId, routeIds }: { collectionId: number; routeIds: number[] }) =>
			apiService.setCollectionRoutes(collectionId, routeIds),
		onSuccess: (detail) => {
			queryClient.setQueryData(queryKeys.collections.detail(String(detail.id)), detail);
			queryClient.invalidateQueries({ queryKey: queryKeys.collections.list() });
		},
		onError: (error) => {
			Logger.error("Failed to update collection routes:", error);
		},
	});
}

// ============================================================================
// SOCIAL QUERIES (issue #245)
// ============================================================================

/**
 * Public profile by handle. Works for anonymous viewers (isFollowing = null).
 */
export function usePublicProfile(handle: string | null) {
	return useQuery<ApiProfile>({
		queryKey: queryKeys.social.profile(handle ?? ""),
		queryFn: () => apiService.getPublicProfile(handle as string),
		enabled: handle != null && handle.length > 0,
		staleTime: 60 * 1000,
	});
}

/**
 * Discover surface: public routes overlapping the given viewport bbox.
 * Anonymous-friendly; previous results stay visible while the map moves.
 */
export function useDiscoverRoutes(params: {
	bbox: string | null;
	activity?: "cycle" | "run" | "walk";
	minDistance?: number;
	maxDistance?: number;
}) {
	const { bbox, activity, minDistance, maxDistance } = params;
	return useQuery<ApiDiscoverPage>({
		queryKey: queryKeys.routes.discover({ bbox: bbox ?? undefined, activity, minDistance, maxDistance }),
		queryFn: () =>
			apiService.getDiscoverRoutes({ bbox: bbox ?? undefined, activity, minDistance, maxDistance, limit: 50 }),
		enabled: bbox !== null,
		staleTime: 30 * 1000,
		placeholderData: keepPreviousData,
	});
}

export function useFeed() {
	const hasUser = hasStoredUser();
	return useQuery<ApiFeedPage>({
		queryKey: queryKeys.social.feed(),
		queryFn: () => apiService.getFeed({ limit: 50 }),
		enabled: hasUser,
		staleTime: 60 * 1000,
	});
}

export function useFollows() {
	const hasUser = hasStoredUser();
	return useQuery<ApiFollows>({
		queryKey: queryKeys.social.follows(),
		queryFn: () => apiService.getFollows(),
		enabled: hasUser,
		staleTime: 60 * 1000,
	});
}

export function useShareInbox() {
	const hasUser = hasStoredUser();
	return useQuery<ApiRouteShare[]>({
		queryKey: queryKeys.social.inbox(),
		queryFn: () => apiService.getShareInbox(),
		enabled: hasUser,
		staleTime: 30 * 1000,
	});
}

/**
 * Unread share count for the social tab badge. Polled lazily; the inbox is
 * not a real-time surface.
 */
export function useShareUnreadCount() {
	const hasUser = hasStoredUser();
	return useQuery<number>({
		queryKey: queryKeys.social.unread(),
		queryFn: () => apiService.getShareUnreadCount(),
		enabled: hasUser,
		staleTime: 60 * 1000,
		refetchInterval: 5 * 60 * 1000,
	});
}

export function useNotifications(enabled = true) {
	const hasUser = hasStoredUser();
	return useQuery<ApiNotifications>({
		queryKey: queryKeys.social.notifications(),
		queryFn: () => apiService.getNotifications(),
		enabled: hasUser && enabled,
		staleTime: 30 * 1000,
	});
}

/**
 * Unseen notification count for the bell badge. Polled lazily like the share
 * unread count; the bell is not a real-time surface.
 */
export function useNotificationUnseenCount() {
	const hasUser = hasStoredUser();
	return useQuery<number>({
		queryKey: queryKeys.social.unseen(),
		queryFn: () => apiService.getNotificationUnseenCount(),
		enabled: hasUser,
		staleTime: 60 * 1000,
		refetchInterval: 5 * 60 * 1000,
	});
}

/**
 * Bumps the NotificationsSeenAt watermark. Deliberately does not invalidate
 * the notifications list: its cached seenAt is what highlights unseen items
 * while the center stays open.
 */
export function useMarkNotificationsSeen() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => apiService.markNotificationsSeen(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.social.unseen() });
		},
	});
}

export function useUserSearch(q: string) {
	const hasUser = hasStoredUser();
	return useQuery<ApiProfileSummary[]>({
		queryKey: queryKeys.social.search(q),
		queryFn: () => apiService.searchUsers(q),
		enabled: hasUser && q.trim().length >= 2,
		staleTime: 30 * 1000,
	});
}

export function useFollowUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ handle }: { handle: string; source: "profile" | "search" | "public_route" | "feed" }) =>
			apiService.followUser(handle),
		onSuccess: (_data, vars) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.social.all });
			trackEvent({ name: "profile_followed", properties: { source: vars.source } });
		},
		onError: (error) => {
			Logger.error("Failed to follow:", error);
		},
	});
}

export function useUnfollowUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (handle: string) => apiService.unfollowUser(handle),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.social.all });
			trackEvent({ name: "profile_unfollowed", properties: {} });
		},
		onError: (error) => {
			Logger.error("Failed to unfollow:", error);
		},
	});
}

export function useSendRouteShare() {
	return useMutation({
		mutationFn: ({ body }: { body: SendRouteShareRequest; visibility: "unlisted" | "public" }) =>
			apiService.sendRouteShare(body),
		onSuccess: (_data, vars) => {
			trackEvent({
				name: "route_share_sent",
				properties: { has_message: !!vars.body.message, visibility: vars.visibility },
			});
		},
		onError: (error) => {
			Logger.error("Failed to share route:", error);
		},
	});
}

export function useMarkShareRead() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => apiService.markShareRead(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.social.inbox() });
			queryClient.invalidateQueries({ queryKey: queryKeys.social.unread() });
		},
	});
}

export function useDismissShare() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => apiService.dismissShare(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.social.inbox() });
			queryClient.invalidateQueries({ queryKey: queryKeys.social.unread() });
		},
	});
}

export function useCopySharedRoute() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => apiService.copySharedRoute(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.routes.list() });
			trackEvent({ name: "route_share_copied", properties: {} });
		},
		onError: (error) => {
			Logger.error("Failed to copy shared route:", error);
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
