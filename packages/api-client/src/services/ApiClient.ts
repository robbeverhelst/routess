import type {
	ApiClientConfig,
	ApiRoute,
	ApiUser,
	AuthResponse,
	CreateRouteRequest,
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
		return this.request<ApiUser>("/auth/me");
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
}
