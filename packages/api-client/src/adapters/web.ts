import type {
  HttpClient,
  AuthStateManager,
  ErrorHandler,
  PlatformAdapter,
  RequestOptions,
} from "../types";

// Web HTTP Client using fetch
export class WebHttpClient implements HttpClient {
  async get<T>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, { method: "GET", ...options });
  }

  async post<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, { method: "POST", body, ...options });
  }

  async patch<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, { method: "PATCH", body, ...options });
  }

  async delete<T>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, { method: "DELETE", ...options });
  }

  private async request<T>(
    url: string,
    options: {
      method: string;
      body?: unknown;
      headers?: Record<string, string>;
      timeout?: number;
    },
  ): Promise<T> {
    const { method, body, headers = {}, timeout } = options;

    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (timeout) {
      timeoutId = setTimeout(() => controller.abort(), timeout);
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        let errorDetails = "";
        try {
          const errorBody = await response.text();
          errorDetails = errorBody;
        } catch {
          // Ignore parse errors
        }

        throw new Error(
          `API Error: ${response.status} ${response.statusText}${errorDetails ? " - " + errorDetails : ""}`,
        );
      }

      return response.json();
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      throw error;
    }
  }
}

// Web Auth State Manager using localStorage
export class WebAuthStateManager implements AuthStateManager {
  private token: string | null = null;

  constructor() {
    this.token = typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null;
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("access_token", token);
    }
  }

  clearToken(): void {
    this.token = null;
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
    }
  }

  refreshToken(): void {
    if (typeof localStorage !== "undefined") {
      const currentStoredToken = localStorage.getItem("access_token");
      if (currentStoredToken !== this.token) {
        this.token = currentStoredToken;
      }
    }
  }

  async clearAuthState(): Promise<void> {
    // This method can be overridden by the web app to trigger UI updates
    // The web app can provide its own implementation that imports google-auth
    // For now, this is a no-op in the package
  }
}

// Web Error Handler (basic implementation)
export class WebErrorHandler implements ErrorHandler {
  handleError(error: Error, context: string, retryFn?: () => Promise<unknown>): void {
    console.error(`API Error in ${context}:`, error);

    // You can extend this to integrate with toast notifications or other error handling
    // For now, just log the error
  }
}

// Web Platform Adapter
export class WebPlatformAdapter implements PlatformAdapter {
  createHttpClient(): HttpClient {
    return new WebHttpClient();
  }

  createAuthStateManager(): AuthStateManager {
    return new WebAuthStateManager();
  }

  createErrorHandler(): ErrorHandler {
    return new WebErrorHandler();
  }
}
