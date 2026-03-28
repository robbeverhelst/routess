import { ApiClient, WebPlatformAdapter } from "@routess/api-client";
import { clearStoredAuthState, notifyAuthStateChange } from "@/lib/auth-state";
import { handleAPIError } from "@/lib/errors";
import { Logger } from "@/lib/logger";

const API_BASE_URL = import.meta.env.VITE_API_URL || "__VITE_API_URL__";

// Custom web auth state manager that integrates with google-auth
class WebAuthStateManagerWithGoogleAuth extends WebPlatformAdapter {
	createAuthStateManager() {
		const baseManager = super.createAuthStateManager();

		return {
			getToken: () => baseManager.getToken(),
			setToken: (token: string) => baseManager.setToken(token),
			clearToken: () => baseManager.clearToken(),
			refreshToken: () => baseManager.refreshToken(),
			clearAuthState() {
				clearStoredAuthState();
				notifyAuthStateChange();
			},
		};
	}

	createErrorHandler() {
		return {
			handleError: (error: Error, context: string, retryFn?: () => Promise<unknown>) => {
				handleAPIError(error, context, retryFn);
			},
		};
	}
}

// Create the platform adapter
const webAdapter = new WebAuthStateManagerWithGoogleAuth();

// Create the API client
export const apiService = new ApiClient({
	baseUrl: API_BASE_URL,
	httpClient: webAdapter.createHttpClient(),
	authStateManager: webAdapter.createAuthStateManager(),
	errorHandler: webAdapter.createErrorHandler(),
	logger: Logger,
});

// Re-export types for backward compatibility
export type {
	ApiRoute,
	ApiUser,
	AuthResponse,
	CreateRouteRequest,
	GoogleAuthRequest,
	UpdateRouteRequest,
	Waypoint,
} from "@routess/api-client";
