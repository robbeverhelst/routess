import type {
	Logger,
	Provenance,
	RouteActivity,
	RouteVisibility,
	RoutingPreferences,
	SurfaceComposition,
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

// Owner shape embedded in routes/collections, which other users (including
// anonymous visitors on public/unlisted pages) can see. Deliberately PII-free;
// the Handle is public by design (the Profile's address, CONTEXT.md).
export interface ApiPublicUser {
	id: number;
	name: string;
	handle: string;
	avatar?: string;
	// Pseudonymous user identifier for ProductEvent tracking. See ADR-0020.
	idHash: string;
}

export interface ApiUser {
	id: number;
	email: string;
	name: string;
	// Public address of the user's Profile (CONTEXT.md "Handle").
	handle: string;
	avatar?: string;
	isEmailVerified: boolean;
	role: ApiUserRole;
	preferences?: ApiUserPreferences | null;
	// Pseudonymous user identifier for ProductEvent tracking. Stable per user,
	// computed server-side as sha256(salt + user.id). See ADR-0020.
	idHash: string;
	deletionStatus: ApiUserDeletionStatus;
	deletionRequestedAt?: string | null;
	// True if the user has an email/password credential set up. Drives
	// password-change UI affordances (hide current-password field for users
	// who only signed in via Google and never set a password).
	hasPassword: boolean;
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

export interface AdminSeedSource {
	key: string;
	displayName: string;
	license: string;
	status: "green" | "yellow" | "red";
	routeCount: number;
	removedCount: number;
	refreshIntervalDays: number;
	lastRefreshedAt: string | null;
	nextRefreshAt: string | null;
	automatic: boolean;
	lastRefreshError: string | null;
	lastRefreshStats: { inserted: number; updated: number; unchanged: number; removed: number } | null;
}

export interface AdminSeedSources {
	items: AdminSeedSource[];
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
	deletedAt: string | null;
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
	visibility: string;
	distance: number | null;
	duration: number | null;
	elevationGain: number | null;
	owner: AdminRouteOwner;
	createdAt: string;
	deletedAt: string | null;
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
	waypoints: Waypoint[];
	geometry: [number, number][] | null;
	bbox: [number, number, number, number] | null;
	provenance: string;
	favourite: boolean;
	routingPreferences: RoutingPreferences | null;
	surfaceComposition: SurfaceComposition | null;
	shareToken: string;
	placeCity: string | null;
	placeRegion: string | null;
	placeCountryCode: string | null;
	publishedAt: string | null;
	copiedFromRouteId: number | null;
	copiedFromUserId: number | null;
	startAddress: string | null;
	endAddress: string | null;
	updatedAt: string;
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
	umamiUrl: string | null;
	glitchtipUrl: string | null;
}

export interface AdminConversion {
	totalUsers: number;
	usersWithRoute: number;
	conversionPct: number;
}

export interface AdminDistributionBucket {
	label: string;
	count: number;
}

export interface AdminRegion {
	city: string | null;
	region: string | null;
	countryCode: string | null;
	count: number;
}

export interface AdminEngagement {
	signupToFirstRoute: AdminConversion;
	distanceDistribution: AdminDistributionBucket[];
	topRegions: AdminRegion[];
}

export interface AdminSeedRefreshResult {
	source: string;
	skipped: "not-due" | "manual" | "blocked" | null;
	result: { inserted: number; updated: number; unchanged: number; removed: number } | null;
	error: string | null;
}

export interface AuthResponse {
	accessToken: string;
	user: ApiUser;
	// Server truth for "this login created the account", so the client can fire
	// `user_registered` exactly once. Optional: older API builds omit it.
	isNewUser?: boolean;
}

// ========== Personal access tokens (PATs) ==========
// Long-lived bearer credentials a user mints for non-browser clients
// (CLI, AI agents, scripts). See ADR-0022.

export type ApiPatScope = "read" | "write";

export interface ApiPersonalAccessToken {
	id: number;
	label: string;
	scope: ApiPatScope;
	lastUsedAt: string | null;
	expiresAt: string | null;
	createdAt: string;
}

export interface ApiPersonalAccessTokenWithSecret extends ApiPersonalAccessToken {
	// Plaintext returned exactly once at creation. Never returned again by
	// the list endpoint; if the user loses it they revoke and mint a new
	// one.
	token: string;
}

export interface CreatePersonalAccessTokenRequest {
	label: string;
	scope: ApiPatScope;
	expiresAt?: string;
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
	favourite: boolean;
	waypoints: Waypoint[];
	geometry?: [number, number][];
	distance?: number;
	duration?: number;
	elevationGain?: number;
	startAddress?: string;
	endAddress?: string;
	// Derived Place (CONTEXT.md): server-derived from the RoutePath start,
	// never user-edited.
	placeCity?: string;
	placeRegion?: string;
	placeCountryCode?: string;
	routingPreferences?: RoutingPreferences | null;
	// SurfaceBuckets along the RoutePath, derived server-side at save
	// (ADR 0032). Null while derivation is pending.
	surfaceComposition?: SurfaceComposition | null;
	provenance: Provenance;
	// Unguessable 32-hex handle for share links. Unlisted routes are only
	// reachable anonymously via this token (numeric ids are public-only).
	shareToken: string;
	user: ApiPublicUser;
	createdAt: string;
	updatedAt: string;
}

// Detail for a seeded ExternalRoute page (/r/{slug}-x{id}, ADR 0035). No owner,
// Waypoints, visibility, or share token; carries source attribution instead.
// `kind: "external"` lets callers branch.
export interface ApiExternalRoute {
	id: number;
	slugId: string;
	name: string;
	description?: string;
	activity?: RouteActivity;
	tags: string[];
	geometry: [number, number][];
	distance?: number;
	duration?: number;
	elevationGain?: number;
	placeCity?: string;
	placeRegion?: string;
	placeCountryCode?: string;
	source: ApiRouteSource;
	kind: "external";
	updatedAt: string;
}

export interface CreateRouteRequest {
	name: string;
	description?: string;
	activity?: RouteActivity;
	visibility?: RouteVisibility;
	tags?: string[];
	favourite?: boolean;
	waypoints: Waypoint[];
	geometry?: [number, number][];
	distance?: number;
	duration?: number;
	elevationGain?: number;
	startAddress?: string;
	endAddress?: string;
	routingPreferences?: RoutingPreferences;
	provenance?: Provenance;
}

export interface UpdateRouteRequest {
	name?: string;
	description?: string;
	activity?: RouteActivity;
	visibility?: RouteVisibility;
	tags?: string[];
	favourite?: boolean;
	waypoints?: Waypoint[];
	geometry?: [number, number][];
	distance?: number;
	duration?: number;
	elevationGain?: number;
	startAddress?: string;
	endAddress?: string;
	routingPreferences?: RoutingPreferences;
}

export interface ApiRoutesPage {
	items: ApiRoute[];
	total: number;
}

// ========== Collections ==========
// Curated, manually ordered, shareable sets of routes. Many-to-many with
// routes; visibility has the same semantics as route visibility.

export interface ApiCollection {
	id: number;
	name: string;
	description?: string;
	visibility: RouteVisibility;
	// Ordered. For non-owners, private routes are omitted server-side.
	routeIds: number[];
	routeCount: number;
	// Unguessable 32-hex handle for share links; see ApiRoute.shareToken.
	shareToken: string;
	user: ApiPublicUser;
	createdAt: string;
	updatedAt: string;
}

export interface ApiCollectionDetail extends ApiCollection {
	routes: ApiRoute[];
}

export interface CreateCollectionRequest {
	name: string;
	description?: string;
	visibility?: RouteVisibility;
}

export interface UpdateCollectionRequest {
	name?: string;
	description?: string;
	visibility?: RouteVisibility;
}

export interface UpdateCurrentUserRequest {
	name?: string;
	handle?: string;
	avatar?: string;
	preferences?: Partial<ApiUserPreferences>;
}

// ========== Social (issue #245, ADR 0027) ==========
// Profiles are the public projection of a User; Follows grant no access;
// RouteShares only carry unlisted/public routes and are live references.

export interface ApiProfileSummary {
	handle: string;
	name: string;
	avatar?: string | null;
}

export interface ApiProfileStats {
	publicRoutes: number;
	totalDistance: number;
	totalElevationGain: number;
	followers: number;
	following: number;
}

export interface ApiProfileRoute {
	id: number;
	// Canonical /r/{slugId} path segment: id form for public routes,
	// share-token form for unlisted ones (ids are not served to non-owners).
	slugId: string;
	name: string;
	activity?: RouteActivity | null;
	distance?: number | null;
	duration?: number | null;
	elevationGain?: number | null;
	publishedAt?: string | null;
	tags: string[];
}

export interface ApiProfile extends ApiProfileSummary {
	stats: ApiProfileStats;
	// null when viewing anonymously.
	isFollowing: boolean | null;
	// Clears the Indexable gate (>= 3 Indexable routes); drives noindex.
	isIndexable: boolean;
	routes: ApiProfileRoute[];
}

export interface ApiFeedItem extends ApiProfileRoute {
	author: ApiProfileSummary;
}

export interface ApiFeedPage {
	items: ApiFeedItem[];
	total: number;
}

// Attribution for a seeded ExternalRoute (ADR 0035). Present only on open-data
// routes; user routes carry `user` instead. The creator-on-the-map.
export interface ApiRouteSource {
	key: string;
	name: string;
	license: string;
	attribution: string;
	url: string;
}

// Item of GET /routes/public?gate=public — the in-app Discover surface
// (CONTEXT.md "Discover"). Mostly the id slug form; seeded ExternalRoutes use
// the `-x{id}` form and carry `source` instead of `user`.
export interface ApiDiscoverRoute {
	id: number;
	slugId: string;
	name: string;
	activity?: RouteActivity | null;
	distance?: number | null;
	elevationGain?: number | null;
	tags?: string[];
	publishedAt?: string | null;
	placeCity?: string | null;
	placeRegion?: string | null;
	placeCountryCode?: string | null;
	// Downsampled RoutePath as [lng, lat] pairs for thumbs and map previews.
	geometry?: [number, number][];
	user?: ApiPublicUser;
	// Set on seeded ExternalRoutes; mutually exclusive with `user`.
	source?: ApiRouteSource;
	updatedAt: string;
}

export interface ApiDiscoverPage {
	items: ApiDiscoverRoute[];
	total: number;
}

export interface DiscoverRoutesParams {
	// Viewport as 'minLng,minLat,maxLng,maxLat' (matches by bbox overlap).
	bbox?: string;
	activity?: RouteActivity;
	placeCity?: string;
	minDistance?: number;
	maxDistance?: number;
	limit?: number;
	offset?: number;
}

export interface ApiFollows {
	following: ApiProfileSummary[];
	followers: ApiProfileSummary[];
}

export interface ApiRouteShare {
	id: number;
	sender: ApiProfileSummary;
	message?: string | null;
	// null + unavailable=true when the route was deleted or flipped private.
	route?: ApiProfileRoute | null;
	unavailable: boolean;
	readAt?: string | null;
	createdAt: string;
}

export interface SendRouteShareRequest {
	routeId: number;
	recipientHandle: string;
	message?: string;
}

// A derived notification item: a follow of you or a route share sent to you.
// Nothing is stored per item server-side; see CONTEXT.md "Notification".
export interface ApiNotification {
	type: "follow" | "route_share";
	actor: ApiProfileSummary;
	shareId?: number;
	// Live reference; null when the route is deleted or private again.
	routeName?: string | null;
	createdAt: string;
}

export interface ApiNotifications {
	items: ApiNotification[];
	// NotificationsSeenAt watermark before this read; items newer are unseen.
	seenAt?: string | null;
}

// HTTP Client Interface
export interface HttpClient {
	get<T>(url: string, options?: RequestOptions): Promise<T>;
	// Like get, but also surfaces response headers (e.g. X-Total-Count).
	getWithHeaders<T>(url: string, options?: RequestOptions): Promise<{ data: T; headers: Record<string, string> }>;
	post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
	put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
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
