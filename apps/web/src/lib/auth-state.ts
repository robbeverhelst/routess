import type { ApiUser } from "./api";

// Auth is cookie-only; localStorage holds the profile snapshot, never a
// credential. "access_token" is a legacy key from older builds, removed on
// bootstrap and on sign-out.
const LEGACY_ACCESS_TOKEN_KEY = "access_token";
const USER_KEY = "user";

export const authStorageKeys = {
	user: USER_KEY,
} as const;

export const clearStoredAuthState = () => {
	localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
	localStorage.removeItem(USER_KEY);
};

export const storeUser = (user: ApiUser) => {
	localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getStoredUser = (): ApiUser | null => {
	const userJson = localStorage.getItem(USER_KEY);
	if (!userJson) {
		return null;
	}

	try {
		return JSON.parse(userJson) as ApiUser;
	} catch {
		clearStoredAuthState();
		return null;
	}
};

export const hasStoredUser = () => !!localStorage.getItem(USER_KEY);

export const notifyAuthStateChange = () => {
	window.dispatchEvent(new CustomEvent("auth-change"));
	window.dispatchEvent(
		new StorageEvent("storage", {
			key: USER_KEY,
			newValue: localStorage.getItem(USER_KEY),
			oldValue: null,
		}),
	);
};
