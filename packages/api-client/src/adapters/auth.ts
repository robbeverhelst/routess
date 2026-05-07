import type { AuthStateManager } from "../types";

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
