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
	ApiRoute,
	ApiUser,
	AuthResponse,
	CreateRouteRequest,
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
	async googleAuth(credential: string): Promise<AuthResponse> {
		const response = await this.request<AuthResponse>("/auth/google", {
			method: "POST",
			body: { credential },
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

	// Route management methods
	async createRoute(route: CreateRouteRequest): Promise<ApiRoute> {
		return this.request<ApiRoute>("/routes", {
			method: "POST",
			body: route,
		});
	}

	async getRoutes(): Promise<ApiRoute[]> {
		return this.request<ApiRoute[]>("/routes");
	}

	async getRoute(id: number): Promise<ApiRoute> {
		return this.request<ApiRoute>(`/routes/${id}`);
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
