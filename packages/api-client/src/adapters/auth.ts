import type { AuthStateManager, StorageAdapter } from "../types";

const TOKEN_KEY = "access_token";
const USER_KEY = "user";

// Auth state backed by browser localStorage.
export class LocalStorageAuthState implements AuthStateManager {
	private token: string | null = null;

	constructor() {
		this.token = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
	}

	getToken(): string | null {
		if (typeof localStorage !== "undefined") {
			this.token = localStorage.getItem(TOKEN_KEY);
		}
		return this.token;
	}

	setToken(token: string): void {
		this.token = token;
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(TOKEN_KEY, token);
		}
	}

	clearToken(): void {
		this.token = null;
		if (typeof localStorage !== "undefined") {
			localStorage.removeItem(TOKEN_KEY);
			localStorage.removeItem(USER_KEY);
		}
	}

	refreshToken(): void {
		if (typeof localStorage !== "undefined") {
			const stored = localStorage.getItem(TOKEN_KEY);
			if (stored !== this.token) this.token = stored;
		}
	}
}

// Auth state backed by an injected StorageAdapter (AsyncStorage / SecureStore on RN).
export class StorageAdapterAuthState implements AuthStateManager {
	private token: string | null = null;
	private readonly storage: StorageAdapter;

	constructor(storage: StorageAdapter) {
		this.storage = storage;
		void this.loadToken();
	}

	private async loadToken(): Promise<void> {
		try {
			const value = await this.storage.getItem(TOKEN_KEY);
			this.token = value ?? null;
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
		const result = this.storage.setItem(TOKEN_KEY, token);
		if (result instanceof Promise) {
			result.catch((error: unknown) => {
				console.error("Failed to save token to storage:", error);
			});
		}
	}

	clearToken(): void {
		this.token = null;
		const promises: Promise<void>[] = [];
		const removeToken = this.storage.removeItem(TOKEN_KEY);
		const removeUser = this.storage.removeItem(USER_KEY);
		if (removeToken instanceof Promise) promises.push(removeToken);
		if (removeUser instanceof Promise) promises.push(removeUser);
		if (promises.length > 0) {
			Promise.all(promises).catch((error: unknown) => {
				console.error("Failed to clear tokens from storage:", error);
			});
		}
	}

	refreshToken(): void {
		void this.loadToken();
	}
}
