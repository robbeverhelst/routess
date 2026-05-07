import type {
	Logger,
	UserPreferenceActivity,
	UserPreferenceLocationPermission,
	UserPreferenceMapStyle,
	UserPreferenceOverlayKey,
	UserPreferenceOverlays,
	UserPreferenceSportSpeeds,
	UserPreferences,
	UserPreferenceUnits,
	Waypoint,
} from "@routess/core";

// Re-export for convenience
export type { Coordinate, Waypoint, WaypointType } from "@routess/core";

// API Response Types — aliases of the canonical preference types in @routess/core.
// Kept as Api* names so callers that already import them keep working.
export type ApiActivity = UserPreferenceActivity;
export type ApiUnits = UserPreferenceUnits;
export type ApiMapStyle = UserPreferenceMapStyle;
export type ApiLocationPermission = UserPreferenceLocationPermission;
export type ApiOverlayKey = UserPreferenceOverlayKey;

export type ApiOverlays = UserPreferenceOverlays;
export type ApiSportSpeeds = UserPreferenceSportSpeeds;

export type ApiUserPreferences = UserPreferences;

export interface ApiUser {
	id: number;
	email: string;
	name: string;
	avatar?: string;
	isEmailVerified: boolean;
	preferences?: ApiUserPreferences | null;
	statistics?: {
		totalRoutes: number;
		totalDistance: number;
	};
}

export interface AuthResponse {
	accessToken: string;
	user: ApiUser;
}

export interface GoogleAuthRequest {
	credential: string;
}

export interface ApiRoute {
	id: number;
	name: string;
	description?: string;
	waypoints: Waypoint[];
	geometry?: [number, number][];
	distance?: number;
	duration?: number;
	elevationGain?: number;
	startAddress?: string;
	endAddress?: string;
	user: ApiUser;
	createdAt: string;
	updatedAt: string;
}

export interface CreateRouteRequest {
	name: string;
	description?: string;
	waypoints: Waypoint[];
	geometry?: [number, number][];
	distance?: number;
	duration?: number;
	elevationGain?: number;
	startAddress?: string;
	endAddress?: string;
}

export interface UpdateRouteRequest {
	name?: string;
	description?: string;
	waypoints?: Waypoint[];
	geometry?: [number, number][];
	distance?: number;
	duration?: number;
	elevationGain?: number;
	startAddress?: string;
	endAddress?: string;
}

export interface UpdateCurrentUserRequest {
	name?: string;
	avatar?: string;
	preferences?: Partial<ApiUserPreferences>;
}

// HTTP Client Interface
export interface HttpClient {
	get<T>(url: string, options?: RequestOptions): Promise<T>;
	post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
	patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
	delete<T>(url: string, options?: RequestOptions): Promise<T>;
}

export interface RequestOptions {
	headers?: Record<string, string>;
	timeout?: number;
}

// Auth State Manager Interface
export interface AuthStateManager {
	getToken(): string | null;
	setToken(token: string): void;
	clearToken(): void;
	refreshToken(): void;
	clearAuthState?(): void; // Optional for web integration
}

// Error Handler Interface
export interface ErrorHandler {
	handleError(error: Error, context: string, retryFn?: () => Promise<unknown>): void;
}

// API Client Configuration
export interface ApiClientConfig {
	baseUrl: string;
	httpClient: HttpClient;
	authStateManager: AuthStateManager;
	errorHandler?: ErrorHandler;
	logger?: Logger;
}

// Platform Adapter Interface
export interface PlatformAdapter {
	createHttpClient(): HttpClient;
	createAuthStateManager(): AuthStateManager;
	createErrorHandler?(): ErrorHandler;
}
