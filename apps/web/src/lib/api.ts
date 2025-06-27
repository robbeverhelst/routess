import { handleAPIError } from "@/lib/errors";

const API_BASE_URL = import.meta.env.VITE_API_URL || "__VITE_API_URL__";

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

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.token = typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null;
  }

  refreshToken() {
    this.token = typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;

    // Check if token in memory is stale compared to localStorage
    const currentStoredToken = localStorage.getItem("access_token");
    if (currentStoredToken !== this.token) {
      this.token = currentStoredToken;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Handle 401 Unauthorized - clear stale auth state
      if (response.status === 401) {
        this.clearToken();
        localStorage.removeItem("user");
        // Import googleAuth to trigger UI updates
        import("@/lib/google-auth").then(({ googleAuth }) => {
          googleAuth.clearAuthState();
        });
      }

      // Try to get more detailed error information
      let errorDetails = "";
      try {
        const errorBody = await response.text();
        errorDetails = errorBody;
      } catch {
        // Ignore parse errors
      }

      const error = new Error(
        `API Error: ${response.status} ${response.statusText}${errorDetails ? " - " + errorDetails : ""}`,
      );

      // Use centralized error handling
      handleAPIError(error, endpoint, () => this.request(endpoint, options));
      throw error;
    }

    return response.json();
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem("access_token", token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem("access_token");
  }

  async googleAuth(credential: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });

    this.setToken(response.accessToken);
    return response;
  }

  async getProfile(): Promise<ApiUser> {
    return this.request<ApiUser>("/auth/me");
  }

  async logout() {
    this.clearToken();
  }

  // Route management methods
  async createRoute(route: CreateRouteRequest): Promise<ApiRoute> {
    return this.request<ApiRoute>("/routes", {
      method: "POST",
      body: JSON.stringify(route),
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
      body: JSON.stringify(route),
    });
  }

  async deleteRoute(id: number): Promise<void> {
    await this.request<{ success: boolean; message: string }>(`/routes/${id}`, {
      method: "DELETE",
    });
  }
}

export const apiService = new ApiService();
