import type {
	AdminConfigSummary,
	AdminOverview,
	AdminRouteDetail,
	AdminRouteList,
	AdminRouteStats,
	AdminSystemHealth,
	AdminUserDetail,
	AdminUserList,
	AdminUserStats,
	ApiClientConfig,
	ApiPersonalAccessToken,
	ApiPersonalAccessTokenWithSecret,
	ApiRoute,
	ApiUser,
	AuthResponse,
	CreatePersonalAccessTokenRequest,
	CreateRouteRequest,
	RouteListQuery,
	UpdateCurrentUserRequest,
	UpdateRouteRequest,
} from "../types";

function buildRouteListQuery(params: RouteListQuery): string {
	const qs = new URLSearchParams();
	if (params.q?.trim()) qs.set("q", params.q.trim());
	if (params.activity) qs.set("activity", params.activity);
	if (params.visibility) qs.set("visibility", params.visibility);
	if (params.tags && params.tags.length > 0) qs.set("tags", params.tags.join(","));
	if (params.sort) qs.set("sort", params.sort);
	return qs.toString();
}

export class ApiClient {
	private config: ApiClientConfig;

	constructor(config: ApiClientConfig) {
		this.config = config;
	}

	private async request<T>(
		endpoint: string,
		options: {
			method?: "GET" | "POST" | "PATCH" | "DELETE";
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
				case "DELETE":
					return await httpClient.delete<T>(url, requestOptions);
				case "POST":
					return await httpClient.post<T>(url, body, requestOptions);
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

	async getRoutes(params: RouteListQuery = {}): Promise<ApiRoute[]> {
		const qs = buildRouteListQuery(params);
		return this.request<ApiRoute[]>(`/routes${qs ? `?${qs}` : ""}`);
	}

	async getRouteTags(): Promise<Array<{ tag: string; count: number }>> {
		return this.request<Array<{ tag: string; count: number }>>("/routes/tags");
	}

	async getRoute(id: number): Promise<ApiRoute> {
		return this.request<ApiRoute>(`/routes/${id}`);
	}

	// Direct <a href> link; resolves against the configured API origin (like exportDataUrl).
	routeGpxUrl(id: number): string {
		return `${this.config.baseUrl}/api/v1/routes/${id}/gpx`;
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
