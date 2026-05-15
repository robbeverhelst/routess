import { QueryClient } from "@tanstack/react-query";
import { Logger } from "./logger";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Cache data for 5 minutes by default
			staleTime: 5 * 60 * 1000,
			// Keep data in cache for 10 minutes when unused
			gcTime: 10 * 60 * 1000,
			// Refetch when window regains focus (good for real-time data)
			refetchOnWindowFocus: true,
			// Retry failed requests 3 times
			retry: 3,
			// Retry with exponential backoff
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
		},
		mutations: {
			// Retry failed mutations once
			retry: 1,
			// Log mutation errors
			onError: (error: unknown) => {
				Logger.error("Mutation failed:", error);
			},
		},
	},
});

// Query key factory for consistent key management
export const queryKeys = {
	// User-related queries
	user: {
		all: ["users"] as const,
		profile: () => [...queryKeys.user.all, "profile"] as const,
		routes: (userId?: number) => [...queryKeys.user.all, "routes", userId] as const,
	},
	// Route-related queries
	routes: {
		all: ["routes"] as const,
		list: () => [...queryKeys.routes.all, "list"] as const,
		detail: (id: string) => [...queryKeys.routes.all, "detail", id] as const,
		byUser: (userId: number) => [...queryKeys.routes.all, "byUser", userId] as const,
	},
	// Auth-related queries
	auth: {
		all: ["auth"] as const,
		session: () => [...queryKeys.auth.all, "session"] as const,
		tokens: () => [...queryKeys.auth.all, "tokens"] as const,
	},
} as const;
