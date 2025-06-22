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

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.token = localStorage.getItem("access_token");
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
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
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
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
}

export const apiService = new ApiService();
