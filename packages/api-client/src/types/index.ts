import type { Logger } from "@maps/core";

// Re-export for convenience
export type { StorageAdapter } from "@maps/core";

// API Response Types
export interface ApiUser {
	id: number;
	email: string;
	name: string;
	avatar?: string;
	isEmailVerified: boolean;
}

export interface AuthResponse {
	accessToken: string;
	user: ApiUser;
}

export interface GoogleAuthRequest {
	credential: string;
}

export interface Waypoint {
	lat: number;
	lng: number;
	type: "routed" | "direct";
}

export interface ApiRoute {
	id: number;
	name: string;
	description?: string;
	waypoints: Waypoint[];
	distance?: number;
	createdAt: string;
	updatedAt: string;
}

export interface CreateRouteRequest {
	name: string;
	description?: string;
	waypoints: Waypoint[];
	distance?: number;
	elevationGain?: number;
}

export interface UpdateRouteRequest {
	name?: string;
	description?: string;
	waypoints?: Waypoint[];
	distance?: number;
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
