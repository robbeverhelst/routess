import { useEffect, useState } from "react";
import { type AuthState, googleAuth } from "@/lib/google-auth";
import { Logger } from "@/lib/logger";

/**
 * Reactive hook that tracks authentication state changes
 * Listens to localStorage changes and provides real-time auth status
 */
export function useAuthState() {
	const [authState, setAuthState] = useState<AuthState>(() => googleAuth.getAuthState());

	useEffect(() => {
		// Update auth state immediately
		const updateAuthState = () => {
			const newAuthState = googleAuth.getAuthState();
			setAuthState(newAuthState);
			Logger.info("[useAuthState] Auth state updated:", {
				isAuthenticated: newAuthState.isAuthenticated,
				hasUser: !!newAuthState.user,
			});
		};

		// Listen for storage changes (including from other tabs)
		const handleStorageChange = (event: StorageEvent) => {
			if (event.key === "access_token" || event.key === "user") {
				updateAuthState();
			}
		};

		// Listen for custom auth events (for same-tab updates)
		const handleAuthChange = () => {
			updateAuthState();
		};

		// Set up listeners
		window.addEventListener("storage", handleStorageChange);
		window.addEventListener("auth-change", handleAuthChange);

		// Initial update
		updateAuthState();

		// Cleanup
		return () => {
			window.removeEventListener("storage", handleStorageChange);
			window.removeEventListener("auth-change", handleAuthChange);
		};
	}, []);

	return authState;
}

/**
 * Simple hook that just returns whether user is authenticated
 */
export function useIsAuthenticated(): boolean {
	const authState = useAuthState();
	return authState.isAuthenticated;
}

/**
 * Hook that returns current user or null
 */
export function useCurrentUser() {
	const authState = useAuthState();
	return authState.user;
}
