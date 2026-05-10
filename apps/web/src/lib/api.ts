import { createApiClient } from "@routess/api-client";
import { clearStoredAuthState, notifyAuthStateChange } from "@/lib/auth-state";
import { handleAPIError } from "@/lib/errors";
import { Logger } from "@/lib/logger";
import { getRuntimeConfig } from "@/lib/runtime-config";

const API_BASE_URL = getRuntimeConfig("VITE_API_URL") ?? "";

const webAuthStateManager = {
	getToken: () => null,
	setToken: (_token: string) => undefined,
	clearToken: () => undefined,
	refreshToken: () => undefined,
	clearAuthState() {
		clearStoredAuthState();
		notifyAuthStateChange();
	},
};

export const apiService = createApiClient({
	baseUrl: API_BASE_URL,
	authStateManager: webAuthStateManager,
	errorHandler: {
		handleError: (error, context, retryFn) => handleAPIError(error, context, retryFn),
	},
	logger: Logger,
});

export type {
	ApiActivity,
	ApiMapStyle,
	ApiOverlays,
	ApiRoute,
	ApiSportSpeeds,
	ApiUnits,
	ApiUser,
	ApiUserPreferences,
	AuthResponse,
	CreateRouteRequest,
	GoogleAuthRequest,
	UpdateCurrentUserRequest,
	UpdateRouteRequest,
	Waypoint,
} from "@routess/api-client";
