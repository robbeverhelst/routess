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
    this.token = localStorage.getItem("access_token");
    console.log("[ApiService] Constructor - Token from localStorage:", this.token);
  }

  refreshToken() {
    this.token = localStorage.getItem("access_token");
    console.log("[ApiService] refreshToken - Token updated to:", this.token);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[ApiService] Making request to: ${endpoint}`);

    // Check if token in memory is stale compared to localStorage
    const currentStoredToken = localStorage.getItem("access_token");
    if (currentStoredToken !== this.token) {
      console.log("[ApiService] Token mismatch detected! Refreshing from localStorage...");
      console.log("[ApiService] Memory token:", this.token);
      console.log("[ApiService] localStorage token:", currentStoredToken);
      this.token = currentStoredToken;
    }

    console.log("[ApiService] Current token value:", this.token);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      console.log("[ApiService] Authorization header set:", headers.Authorization);
    } else {
      console.log("[ApiService] No token available - Authorization header NOT set");
    }

    console.log("[ApiService] Final headers being sent:", headers);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log(`[ApiService] Response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[ApiService] API Error: ${response.status} ${response.statusText}`);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  setToken(token: string) {
    console.log("[ApiService] setToken called with:", token);
    this.token = token;
    localStorage.setItem("access_token", token);
    console.log("[ApiService] Token saved to localStorage");
  }

  clearToken() {
    console.log("[ApiService] clearToken called");
    this.token = null;
    localStorage.removeItem("access_token");
    console.log("[ApiService] Token cleared from memory and localStorage");
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

// Debug helper - call this from browser console to check auth state
(window as any).debugAuth = () => {
  const token = localStorage.getItem("access_token");
  const user = localStorage.getItem("user");
  const apiToken = apiService["token"];

  console.log("=== AUTH DEBUG INFO ===");
  console.log("localStorage access_token:", token);
  console.log("localStorage user:", user);
  console.log("apiService.token (in memory):", apiToken);
  console.log("Token match:", token === apiToken);
  console.log("======================");

  return {
    localStorageToken: token,
    localStorageUser: user,
    apiServiceToken: apiToken,
    tokensMatch: token === apiToken,
  };
};
