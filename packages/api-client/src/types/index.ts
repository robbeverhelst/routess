import type { Logger } from "@routess/core";

// Re-export for convenience
export type { Coordinate, Waypoint, WaypointType } from "@routess/core";

import type { Waypoint } from "@routess/core";

// API Response Types
export type ApiActivity = "run" | "cycle" | "walk";
export type ApiUnits = "km" | "mi";
export type ApiMapStyle = "streets" | "outdoors" | "satellite";
export type ApiLocationPermission = "unknown" | "granted" | "denied" | "skipped";
export type ApiOverlayKey = "heatmap" | "contour" | "bike" | "surface" | "wind";

export type ApiOverlays = Record<ApiOverlayKey, boolean>;
export type ApiSportSpeeds = Partial<Record<ApiActivity, number>>;

export interface ApiUserPreferences {
	units: ApiUnits;
	showPois: boolean;
	terrain3d: boolean;
	autoSnap: boolean;
	publicProfile: boolean;
	hidePrivacy: boolean;
	defaultActivity: string;
	selectedSports: ApiActivity[];
	sportSpeeds: ApiSportSpeeds;
	mapStyle: ApiMapStyle;
	overlays: ApiOverlays;
	locationPermission: ApiLocationPermission;
}

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
