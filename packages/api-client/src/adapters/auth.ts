import type { AuthStateManager } from "../types";

const TOKEN_KEY = "access_token";
const USER_KEY = "user";

// Default auth state: the token lives in memory only, never in storage.
// Browser clients keep their session via the httpOnly cookie (the default
// http client sends credentials: "include"), so persisting the Bearer JWT
// adds nothing except an XSS-exfiltratable credential.
export class InMemoryAuthState implements AuthStateManager {
	private token: string | null = null;

	getToken(): string | null {
		return this.token;
	}

	setToken(token: string): void {
		this.token = token;
	}

	clearToken(): void {
		this.token = null;
	}

	refreshToken(): void {
		// nothing to refresh: no backing store
	}
}

// Auth state backed by browser localStorage.
// @deprecated Storing the Bearer JWT in localStorage exposes it to any XSS
// or third-party script. Prefer the in-memory default plus the httpOnly
// session cookie. Kept for consumers that knowingly need persistence.
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
