import type {
	Logger,
	RouteActivity,
	RouteVisibility,
	UserPreferenceActivity,
	UserPreferenceMapStyle,
	UserPreferenceOverlayKey,
	UserPreferenceOverlays,
	UserPreferenceSportSpeeds,
	UserPreferences,
	UserPreferenceUnits,
	Waypoint,
} from "@routess/core";

// Re-export for convenience
export type { Coordinate, RouteActivity, RouteVisibility, Waypoint, WaypointType } from "@routess/core";

// API Response Types — aliases of the canonical preference types in @routess/core.
// Kept as Api* names so callers that already import them keep working.
export type ApiActivity = UserPreferenceActivity;
export type ApiUnits = UserPreferenceUnits;
export type ApiMapStyle = UserPreferenceMapStyle;
export type ApiOverlayKey = UserPreferenceOverlayKey;

export type ApiOverlays = UserPreferenceOverlays;
export type ApiSportSpeeds = UserPreferenceSportSpeeds;

export type ApiUserPreferences = UserPreferences;

export type ApiUserRole = "user" | "admin";

export type ApiUserDeletionStatus = "active" | "pending_hard_delete";

export interface ApiUser {
	id: number;
	email: string;
	name: string;
	avatar?: string;
	isEmailVerified: boolean;
	role: ApiUserRole;
	preferences?: ApiUserPreferences | null;
	// Pseudonymous user identifier for ProductEvent tracking. Stable per user,
	// computed server-side as sha256(salt + user.id). See ADR-0020.
	idHash: string;
	deletionStatus: ApiUserDeletionStatus;
	deletionRequestedAt?: string | null;
	statistics?: {
		totalRoutes: number;
		totalDistance: number;
	};
}

// ========== Admin types (mirror apps/api/src/admin/dto) ==========

export interface AdminTimeseriesPoint {
	date: string;
	count: number;
}

export interface AdminOverview {
	totalUsers: number;
	totalRoutes: number;
	activeSessions: number;
	signupsToday: number;
	signupsLast30Days: AdminTimeseriesPoint[];
	routesCreatedLast30Days: AdminTimeseriesPoint[];
}

export interface AdminUserStats {
	totalUsers: number;
	verifiedUsers: number;
	deletedUsers: number;
	activeLast7Days: number;
	signupsLast30Days: AdminTimeseriesPoint[];
}

export interface AdminTopCreator {
	userId: number;
	email: string;
	name: string;
	routeCount: number;
}

export interface AdminRouteStats {
	totalRoutes: number;
	byActivity: Array<{ activity: string | null; count: number }>;
	createdLast30Days: AdminTimeseriesPoint[];
	topCreators: AdminTopCreator[];
}

export interface AdminUserListItem {
	id: number;
	email: string;
	name: string;
	role: ApiUserRole;
	isEmailVerified: boolean;
	routeCount: number;
	createdAt: string;
	lastActiveAt: string | null;
}

export interface AdminUserList {
	items: AdminUserListItem[];
	total: number;
	page: number;
	pageSize: number;
}

export interface AdminUserSession {
	id: string;
	userAgent: string | null;
	ipAddress: string | null;
	createdAt: string;
	expiresAt: string;
	lastActivity: string | null;
}

export interface AdminUserRoute {
	id: number;
	name: string;
	activity: string | null;
	createdAt: string;
}

export interface AdminUserDetail extends AdminUserListItem {
	activeSessions: AdminUserSession[];
	recentRoutes: AdminUserRoute[];
}

export interface AdminRouteOwner {
	id: number;
	email: string;
	name: string;
}

export interface AdminRouteListItem {
	id: number;
	name: string;
	activity: string | null;
	privacy: string;
	distance: number | null;
	duration: number | null;
	elevationGain: number | null;
	owner: AdminRouteOwner;
	createdAt: string;
}

export interface AdminRouteList {
	items: AdminRouteListItem[];
	total: number;
	page: number;
	pageSize: number;
}

export interface AdminRouteDetail extends AdminRouteListItem {
	description: string | null;
	tags: string[];
	waypointCount: number;
	hasGeometry: boolean;
	startAddress: string | null;
	endAddress: string | null;
	updatedAt: string;
	deletedAt: string | null;
}

export interface AdminSystemHealth {
	status: "ok" | "degraded" | "down";
	version: string;
	nodeEnv: string;
	uptimeSeconds: number;
	databaseReachable: boolean;
}

export interface AdminConfigSummary {
	telemetryEnabled: boolean;
	metricsEnabled: boolean;
	otlpExportConfigured: boolean;
	adminEmailsCount: number;
	grafanaUrls: Record<string, string>;
}

export interface AuthResponse {
	accessToken: string;
	user: ApiUser;
}

export interface GoogleAuthRequest {
	code: string;
}

export interface ApiRoute {
	id: number;
	name: string;
	description?: string;
	activity?: RouteActivity;
	visibility: RouteVisibility;
	tags: string[];
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
	activity?: RouteActivity;
	visibility?: RouteVisibility;
	tags?: string[];
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
	activity?: RouteActivity;
	visibility?: RouteVisibility;
	tags?: string[];
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
