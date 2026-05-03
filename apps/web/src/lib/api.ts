import { createApiClient, LocalStorageAuthState } from "@routess/api-client";
import { clearStoredAuthState, notifyAuthStateChange } from "@/lib/auth-state";
import { handleAPIError } from "@/lib/errors";
import { Logger } from "@/lib/logger";

const API_BASE_URL = import.meta.env.VITE_API_URL || "__VITE_API_URL__";

// Wrap the default localStorage auth state with the web app's
// clearAuthState hook (clears React state + notifies listeners).
const baseAuth = new LocalStorageAuthState();
const webAuthStateManager = {
	getToken: () => baseAuth.getToken(),
	setToken: (token: string) => baseAuth.setToken(token),
	clearToken: () => baseAuth.clearToken(),
	refreshToken: () => baseAuth.refreshToken(),
	clearAuthState() {
		clearStoredAuthState();
		notifyAuthStateChange();
	},
};

export const apiService = createApiClient({
	baseUrl: API_BASE_URL,
	platform: "web",
	authStateManager: webAuthStateManager,
	errorHandler: {
		handleError: (error, context, retryFn) => handleAPIError(error, context, retryFn),
	},
	logger: Logger,
});

export type {
	ApiRoute,
	ApiUser,
	AuthResponse,
	CreateRouteRequest,
	GoogleAuthRequest,
	UpdateRouteRequest,
	Waypoint,
} from "@routess/api-client";
