import type { ApiUser } from "./api";

const ACCESS_TOKEN_KEY = "access_token";
const USER_KEY = "user";

export const authStorageKeys = {
	accessToken: ACCESS_TOKEN_KEY,
	user: USER_KEY,
} as const;

export const clearStoredAuthState = () => {
	localStorage.removeItem(ACCESS_TOKEN_KEY);
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
			key: ACCESS_TOKEN_KEY,
			newValue: localStorage.getItem(ACCESS_TOKEN_KEY),
			oldValue: null,
		}),
	);
};
