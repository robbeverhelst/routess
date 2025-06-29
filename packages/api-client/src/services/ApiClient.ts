import type {
  ApiClientConfig,
  ApiUser,
  AuthResponse,
  ApiRoute,
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
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    const { method = "GET", body, headers = {} } = options;

    // Refresh token in case it changed
    this.config.authStateManager.refreshToken();

    const token = this.config.authStateManager.getToken();
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    try {
      let response: T;

      if (method === "GET" || method === "DELETE") {
        response = await this.config.httpClient.get<T>(`${this.config.baseUrl}/api/v1${endpoint}`, {
          headers: requestHeaders,
        });
      } else if (method === "POST") {
        response = await this.config.httpClient.post<T>(
          `${this.config.baseUrl}/api/v1${endpoint}`,
          body,
          {
            headers: requestHeaders,
          },
        );
      } else if (method === "PATCH") {
        response = await this.config.httpClient.patch<T>(
          `${this.config.baseUrl}/api/v1${endpoint}`,
          body,
          {
            headers: requestHeaders,
          },
        );
      } else {
        throw new Error(`Unsupported HTTP method: ${method}`);
      }

      return response;
    } catch (error) {
      if (this.config.logger) {
        this.config.logger.error("API request failed:", error);
      }

      // Handle 401 Unauthorized - clear stale auth state
      if (error instanceof Error && error.message.includes("401")) {
        this.config.authStateManager.clearToken();
        this.config.authStateManager.clearAuthState?.();
      }

      // Use error handler if available
      if (this.config.errorHandler) {
        this.config.errorHandler.handleError(
          error instanceof Error ? error : new Error(String(error)),
          endpoint,
          () => this.request(endpoint, options),
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
    this.config.authStateManager.clearToken();
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
