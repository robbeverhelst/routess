import type {
  HttpClient,
  AuthStateManager,
  ErrorHandler,
  PlatformAdapter,
  RequestOptions,
  StorageAdapter,
} from "../types";

// Mobile HTTP Client using fetch (React Native has fetch built-in)
export class MobileHttpClient implements HttpClient {
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
    const { method, body, headers = {}, timeout = 10000 } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

// Mobile Auth State Manager using AsyncStorage or SecureStore
export class MobileAuthStateManager implements AuthStateManager {
  private token: string | null = null;
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
    this.loadToken();
  }

  private async loadToken(): Promise<void> {
    try {
      this.token = await this.storage.getItem("access_token");
    } catch (error) {
      console.error("Failed to load token from storage:", error);
      this.token = null;
    }
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
    const result = this.storage.setItem("access_token", token);
    if (result instanceof Promise) {
      result.catch((error: unknown) => {
        console.error("Failed to save token to storage:", error);
      });
    }
  }

  clearToken(): void {
    this.token = null;

    const removeTokenPromise = this.storage.removeItem("access_token");
    const removeUserPromise = this.storage.removeItem("user");

    const promises: Promise<void>[] = [];
    if (removeTokenPromise instanceof Promise) promises.push(removeTokenPromise);
    if (removeUserPromise instanceof Promise) promises.push(removeUserPromise);

    if (promises.length > 0) {
      Promise.all(promises).catch((error: unknown) => {
        console.error("Failed to clear tokens from storage:", error);
      });
    }
  }

  refreshToken(): void {
    // For mobile, we'll reload from storage
    this.loadToken();
  }
}

// Mobile Error Handler (basic implementation)
export class MobileErrorHandler implements ErrorHandler {
  handleError(error: Error, context: string, retryFn?: () => Promise<unknown>): void {
    console.error(`API Error in ${context}:`, error);

    // For mobile, you might want to show a toast or alert
    // This could be extended to use libraries like react-native-toast-message
  }
}

// Mobile Platform Adapter Factory
export class MobilePlatformAdapter implements PlatformAdapter {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  createHttpClient(): HttpClient {
    return new MobileHttpClient();
  }

  createAuthStateManager(): AuthStateManager {
    return new MobileAuthStateManager(this.storage);
  }

  createErrorHandler(): ErrorHandler {
    return new MobileErrorHandler();
  }
}

// Factory function for easy setup with different storage implementations
export function createMobilePlatformAdapter(storage: StorageAdapter): MobilePlatformAdapter {
  return new MobilePlatformAdapter(storage);
}
