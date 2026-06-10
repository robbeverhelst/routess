import type {
	AdminConfigSummary,
	AdminOverview,
	AdminRouteDetail,
	AdminRouteList,
	AdminRouteStats,
	AdminSeedSources,
	AdminSystemHealth,
	AdminUserDetail,
	AdminUserList,
	AdminUserStats,
	ApiClientConfig,
	ApiCollection,
	ApiCollectionDetail,
	ApiDiscoverPage,
	ApiDiscoverRoute,
	ApiExternalRoute,
	ApiFeedItem,
	ApiFeedPage,
	ApiFollows,
	ApiNotifications,
	ApiPersonalAccessToken,
	ApiPersonalAccessTokenWithSecret,
	ApiProfile,
	ApiProfileSummary,
	ApiRoute,
	ApiRouteShare,
	ApiRoutesPage,
	ApiUser,
	AuthResponse,
	CreateCollectionRequest,
	CreatePersonalAccessTokenRequest,
	CreateRouteRequest,
	DiscoverRoutesParams,
	SendRouteShareRequest,
	UpdateCollectionRequest,
	UpdateCurrentUserRequest,
	UpdateRouteRequest,
} from "../types";

export class ApiClient {
	private config: ApiClientConfig;

	constructor(config: ApiClientConfig) {
		this.config = config;
	}

	private async request<T>(
		endpoint: string,
		options: {
			method?: "GET" | "GET_WITH_HEADERS" | "POST" | "PUT" | "PATCH" | "DELETE";
			body?: unknown;
			headers?: Record<string, string>;
		} = {},
	): Promise<T> {
		const { method = "GET", body, headers = {} } = options;

		this.config.authStateManager.refreshToken();

		const token = this.config.authStateManager.getToken();
		const requestHeaders: Record<string, string> = {
			"Content-Type": "application/json",
			...headers,
		};
		if (token) requestHeaders.Authorization = `Bearer ${token}`;

		const url = `${this.config.baseUrl}/api/v1${endpoint}`;
		const requestOptions = { headers: requestHeaders };
		const httpClient = this.config.httpClient;

		try {
			switch (method) {
				case "GET":
					return await httpClient.get<T>(url, requestOptions);
				case "GET_WITH_HEADERS":
					return (await httpClient.getWithHeaders(url, requestOptions)) as T;
				case "DELETE":
					return await httpClient.delete<T>(url, requestOptions);
				case "POST":
					return await httpClient.post<T>(url, body, requestOptions);
				case "PUT":
					return await httpClient.put<T>(url, body, requestOptions);
				case "PATCH":
					return await httpClient.patch<T>(url, body, requestOptions);
			}
		} catch (error) {
			this.config.logger?.error("API request failed:", error);

			if (error instanceof Error && error.message.includes("401")) {
				this.config.authStateManager.clearToken();
				this.config.authStateManager.clearAuthState?.();
			}

			if (this.config.errorHandler) {
				this.config.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), endpoint, () =>
					this.request(endpoint, options),
				);
			}

			throw error;
		}
	}

	// Auth methods
	async googleAuth(code: string): Promise<AuthResponse> {
		const response = await this.request<AuthResponse>("/auth/google", {
			method: "POST",
			body: { code },
		});

		this.config.authStateManager.setToken(response.accessToken);
		return response;
	}

	// Refresh the token from storage (useful after external auth state changes)
	refreshToken(): void {
		this.config.authStateManager.refreshToken();
	}

	async getProfile(): Promise<ApiUser> {
		return this.request<ApiUser>("/users/me");
	}

	async updateCurrentUser(user: UpdateCurrentUserRequest): Promise<ApiUser> {
		return this.request<ApiUser>("/users/me", {
			method: "PATCH",
			body: user,
		});
	}

	async logout(): Promise<void> {
		try {
			await this.request<{ success: boolean }>("/auth/logout", {
				method: "POST",
			});
		} finally {
			this.config.authStateManager.clearToken();
			this.config.authStateManager.clearAuthState?.();
		}
	}

	// Email + password auth (issue #134)

	async signupEmail(args: { email: string; name?: string; password: string }): Promise<void> {
		await this.request<{ success: true }>("/auth/signup-email", { method: "POST", body: args });
	}

	async verifyEmail(token: string): Promise<AuthResponse> {
		const response = await this.request<AuthResponse>("/auth/verify-email", { method: "POST", body: { token } });
		this.config.authStateManager.setToken(response.accessToken);
		return response;
	}

	async loginEmail(email: string, password: string): Promise<AuthResponse> {
		const response = await this.request<AuthResponse>("/auth/login-email", {
			method: "POST",
			body: { email, password },
		});
		this.config.authStateManager.setToken(response.accessToken);
		return response;
	}

	async requestPasswordReset(email: string): Promise<void> {
		await this.request<{ success: true }>("/auth/request-password-reset", { method: "POST", body: { email } });
	}

	async resetPassword(token: string, password: string): Promise<void> {
		await this.request<{ success: true }>("/auth/reset-password", { method: "POST", body: { token, password } });
	}

	async setPassword(args: { newPassword: string; currentPassword?: string }): Promise<void> {
		await this.request<{ success: true }>("/users/me/password", { method: "POST", body: args });
	}

	// Sessions (issue #134)

	async listSessions(): Promise<
		Array<{
			id: number;
			isCurrent: boolean;
			userAgent?: string;
			ipAddress?: string;
			lastActivity?: string;
			expiresAt: string;
			createdAt: string;
		}>
	> {
		return this.request("/me/sessions");
	}

	async revokeSession(id: number): Promise<void> {
		await this.request<{ success: true }>(`/me/sessions/${id}`, { method: "DELETE" });
	}

	async logoutEverywhere(): Promise<void> {
		try {
			await this.request<{ success: true }>("/me/sessions/logout-everywhere", { method: "POST" });
		} finally {
			this.config.authStateManager.clearToken();
			this.config.authStateManager.clearAuthState?.();
		}
	}

	// Account lifecycle (issue #134)

	async deleteAccount(): Promise<void> {
		try {
			await this.request<{ success: true }>("/users/me", { method: "DELETE" });
		} finally {
			this.config.authStateManager.clearToken();
			this.config.authStateManager.clearAuthState?.();
		}
	}

	async cancelDeletion(): Promise<ApiUser> {
		return this.request<ApiUser>("/users/me/cancel-deletion", { method: "POST" });
	}

	exportDataUrl(): string {
		return `${this.config.baseUrl}/api/v1/users/me/export`;
	}

	// Personal access tokens. Mint/list/revoke. The mint endpoint returns
	// the plaintext exactly once; the caller is responsible for surfacing
	// it to the user immediately and not persisting it client-side.
	async createPersonalAccessToken(body: CreatePersonalAccessTokenRequest): Promise<ApiPersonalAccessTokenWithSecret> {
		return this.request<ApiPersonalAccessTokenWithSecret>("/auth/tokens", {
			method: "POST",
			body,
		});
	}

	async listPersonalAccessTokens(): Promise<ApiPersonalAccessToken[]> {
		return this.request<ApiPersonalAccessToken[]>("/auth/tokens");
	}

	async revokePersonalAccessToken(id: number): Promise<void> {
		await this.request<{ success: boolean }>(`/auth/tokens/${id}`, {
			method: "DELETE",
		});
	}

	// Route management methods
	async createRoute(route: CreateRouteRequest): Promise<ApiRoute> {
		return this.request<ApiRoute>("/routes", {
			method: "POST",
			body: route,
		});
	}

	// One page of the user's routes. The server caps `limit` at 200.
	async getRoutesPage(params: { limit?: number; offset?: number } = {}): Promise<ApiRoutesPage> {
		const query = new URLSearchParams();
		if (params.limit !== undefined) query.set("limit", String(params.limit));
		if (params.offset !== undefined) query.set("offset", String(params.offset));
		const qs = query.toString();
		const { data, headers } = await this.request<{ data: ApiRoute[]; headers: Record<string, string> }>(
			`/routes${qs ? `?${qs}` : ""}`,
			{ method: "GET_WITH_HEADERS" },
		);
		const total = Number.parseInt(headers["x-total-count"] ?? "", 10);
		return { items: data, total: Number.isNaN(total) ? data.length : total };
	}

	// All of the user's routes, walking the paginated endpoint.
	async getRoutes(): Promise<ApiRoute[]> {
		const pageSize = 200;
		const first = await this.getRoutesPage({ limit: pageSize, offset: 0 });
		const items = [...first.items];
		while (items.length < first.total) {
			const next = await this.getRoutesPage({ limit: pageSize, offset: items.length });
			if (next.items.length === 0) break;
			items.push(...next.items);
		}
		return items;
	}

	// `ref` is a numeric route id (owner: any visibility; anonymous: public
	// only) or a 32-hex share token (public and unlisted).
	async getRoute(ref: number | string): Promise<ApiRoute> {
		return this.request<ApiRoute>(`/routes/${ref}`);
	}

	// Direct <a href> link; resolves against the configured API origin (like exportDataUrl).
	// Same ref semantics as getRoute.
	routeGpxUrl(ref: number | string): string {
		return `${this.config.baseUrl}/api/v1/routes/${ref}/gpx`;
	}

	// Seeded ExternalRoute detail by numeric id (the `-x{id}` page form, ADR 0033).
	async getExternalRoute(id: number): Promise<ApiExternalRoute> {
		return this.request<ApiExternalRoute>(`/external-routes/${id}`);
	}

	externalRouteGpxUrl(id: number): string {
		return `${this.config.baseUrl}/api/v1/external-routes/${id}/gpx`;
	}

	async updateRoute(id: number, route: UpdateRouteRequest): Promise<ApiRoute> {
		return this.request<ApiRoute>(`/routes/${id}`, {
			method: "PATCH",
			body: route,
		});
	}

	async deleteRoute(id: number): Promise<void> {
		await this.request<{ success: boolean; message: string }>(`/routes/${id}`, {
			method: "DELETE",
		});
	}

	// Collection management methods

	async getCollections(): Promise<ApiCollection[]> {
		return this.request<ApiCollection[]>("/collections");
	}

	async createCollection(body: CreateCollectionRequest): Promise<ApiCollection> {
		return this.request<ApiCollection>("/collections", { method: "POST", body });
	}

	// Same ref semantics as getRoute: numeric id or 32-hex share token.
	async getCollection(ref: number | string): Promise<ApiCollectionDetail> {
		return this.request<ApiCollectionDetail>(`/collections/${ref}`);
	}

	async updateCollection(id: number, body: UpdateCollectionRequest): Promise<ApiCollection> {
		return this.request<ApiCollection>(`/collections/${id}`, { method: "PATCH", body });
	}

	async deleteCollection(id: number): Promise<void> {
		await this.request<{ success: boolean; message: string }>(`/collections/${id}`, { method: "DELETE" });
	}

	// Replaces the collection's full ordered membership.
	async setCollectionRoutes(id: number, routeIds: number[]): Promise<ApiCollectionDetail> {
		return this.request<ApiCollectionDetail>(`/collections/${id}/routes`, { method: "PUT", body: { routeIds } });
	}

	// Social methods (issue #245). Browser-session only on the server side.

	async getPublicProfile(handle: string): Promise<ApiProfile> {
		return this.request<ApiProfile>(`/profiles/${encodeURIComponent(handle)}`);
	}

	async followUser(handle: string): Promise<void> {
		await this.request<void>(`/social/follows/${encodeURIComponent(handle)}`, { method: "POST" });
	}

	async unfollowUser(handle: string): Promise<void> {
		await this.request<void>(`/social/follows/${encodeURIComponent(handle)}`, { method: "DELETE" });
	}

	async getFollows(): Promise<ApiFollows> {
		return this.request<ApiFollows>("/social/follows");
	}

	// In-app Discover surface: all public routes, viewport-filterable,
	// newest-published first. Anonymous-friendly (no auth required).
	async getDiscoverRoutes(params: DiscoverRoutesParams = {}): Promise<ApiDiscoverPage> {
		const query = new URLSearchParams({ gate: "public" });
		if (params.bbox) query.set("bbox", params.bbox);
		if (params.activity) query.set("activity", params.activity);
		if (params.placeCity) query.set("placeCity", params.placeCity);
		if (params.minDistance !== undefined) query.set("minDistance", String(params.minDistance));
		if (params.maxDistance !== undefined) query.set("maxDistance", String(params.maxDistance));
		if (params.limit !== undefined) query.set("limit", String(params.limit));
		if (params.offset !== undefined) query.set("offset", String(params.offset));
		const { data, headers } = await this.request<{ data: ApiDiscoverRoute[]; headers: Record<string, string> }>(
			`/routes/public?${query.toString()}`,
			{ method: "GET_WITH_HEADERS" },
		);
		const total = Number.parseInt(headers["x-total-count"] ?? "", 10);
		return { items: data, total: Number.isNaN(total) ? data.length : total };
	}

	async getFeed(params: { limit?: number; offset?: number } = {}): Promise<ApiFeedPage> {
		const query = new URLSearchParams();
		if (params.limit !== undefined) query.set("limit", String(params.limit));
		if (params.offset !== undefined) query.set("offset", String(params.offset));
		const qs = query.toString();
		const { data, headers } = await this.request<{ data: ApiFeedItem[]; headers: Record<string, string> }>(
			`/social/feed${qs ? `?${qs}` : ""}`,
			{ method: "GET_WITH_HEADERS" },
		);
		const total = Number.parseInt(headers["x-total-count"] ?? "", 10);
		return { items: data, total: Number.isNaN(total) ? data.length : total };
	}

	async sendRouteShare(body: SendRouteShareRequest): Promise<ApiRouteShare> {
		return this.request<ApiRouteShare>("/social/shares", { method: "POST", body });
	}

	async getShareInbox(): Promise<ApiRouteShare[]> {
		return this.request<ApiRouteShare[]>("/social/shares/inbox");
	}

	async getShareUnreadCount(): Promise<number> {
		const res = await this.request<{ unread: number }>("/social/shares/unread-count");
		return res.unread;
	}

	async markShareRead(id: number): Promise<void> {
		await this.request<void>(`/social/shares/${id}/read`, { method: "POST" });
	}

	// Recipient-only: removes the inbox entry, leaves the route untouched.
	async dismissShare(id: number): Promise<void> {
		await this.request<void>(`/social/shares/${id}`, { method: "DELETE" });
	}

	// Clones the shared route into the caller's library (keeps provenance,
	// records copiedFrom lineage, starts private).
	async copySharedRoute(id: number): Promise<ApiRoute> {
		return this.request<ApiRoute>(`/social/shares/${id}/copy`, { method: "POST" });
	}

	async searchUsers(q: string): Promise<ApiProfileSummary[]> {
		return this.request<ApiProfileSummary[]>(`/social/users/search?q=${encodeURIComponent(q)}`);
	}

	async getNotifications(): Promise<ApiNotifications> {
		return this.request<ApiNotifications>("/social/notifications");
	}

	async getNotificationUnseenCount(): Promise<number> {
		const res = await this.request<{ unseen: number }>("/social/notifications/unseen-count");
		return res.unseen;
	}

	// Bumps the NotificationsSeenAt watermark (bell badge); never marks
	// individual shares read.
	async markNotificationsSeen(): Promise<void> {
		await this.request<void>("/social/notifications/seen", { method: "POST" });
	}

	// Admin methods (gated server-side by JwtAuthGuard + RolesGuard)

	async adminGetOverview(): Promise<AdminOverview> {
		return this.request<AdminOverview>("/admin/stats/overview");
	}

	async adminGetUserStats(): Promise<AdminUserStats> {
		return this.request<AdminUserStats>("/admin/stats/users");
	}

	async adminGetRouteStats(): Promise<AdminRouteStats> {
		return this.request<AdminRouteStats>("/admin/stats/routes");
	}

	async adminGetSeedSources(): Promise<AdminSeedSources> {
		return this.request<AdminSeedSources>("/admin/stats/seed-sources");
	}

	async adminListUsers(params: { page?: number; pageSize?: number; search?: string } = {}): Promise<AdminUserList> {
		const query = new URLSearchParams();
		if (params.page) query.set("page", params.page.toString());
		if (params.pageSize) query.set("pageSize", params.pageSize.toString());
		if (params.search) query.set("search", params.search);
		const qs = query.toString();
		return this.request<AdminUserList>(`/admin/users${qs ? `?${qs}` : ""}`);
	}

	async adminGetUserDetail(userId: number): Promise<AdminUserDetail> {
		return this.request<AdminUserDetail>(`/admin/users/${userId}`);
	}

	async adminRevokeSession(userId: number, sessionId: string): Promise<void> {
		await this.request<void>(`/admin/users/${userId}/sessions/${encodeURIComponent(sessionId)}`, {
			method: "DELETE",
		});
	}

	async adminSoftDeleteUser(userId: number): Promise<void> {
		await this.request<void>(`/admin/users/${userId}`, { method: "DELETE" });
	}

	async adminListRoutes(
		params: { page?: number; pageSize?: number; search?: string; userId?: number } = {},
	): Promise<AdminRouteList> {
		const query = new URLSearchParams();
		if (params.page) query.set("page", params.page.toString());
		if (params.pageSize) query.set("pageSize", params.pageSize.toString());
		if (params.search) query.set("search", params.search);
		if (params.userId !== undefined) query.set("userId", params.userId.toString());
		const qs = query.toString();
		return this.request<AdminRouteList>(`/admin/routes${qs ? `?${qs}` : ""}`);
	}

	async adminGetRouteDetail(routeId: number): Promise<AdminRouteDetail> {
		return this.request<AdminRouteDetail>(`/admin/routes/${routeId}`);
	}

	async adminSoftDeleteRoute(routeId: number): Promise<void> {
		await this.request<void>(`/admin/routes/${routeId}`, { method: "DELETE" });
	}

	async adminGetSystemHealth(): Promise<AdminSystemHealth> {
		return this.request<AdminSystemHealth>("/admin/system/health");
	}

	async adminGetConfigSummary(): Promise<AdminConfigSummary> {
		return this.request<AdminConfigSummary>("/admin/system/config-summary");
	}
}
