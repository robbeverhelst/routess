import { type ApiUser, type AuthResponse, apiService } from "./api";
import { authStorageKeys, clearStoredAuthState, getStoredUser, notifyAuthStateChange, storeUser } from "./auth-state";
import { Logger } from "./logger";
import { getRuntimeConfig } from "./runtime-config";

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = getRuntimeConfig("VITE_GOOGLE_CLIENT_ID") ?? "";

// Detect missing / placeholder client IDs so we can fail loudly with a clear
// message instead of letting Google's "Access blocked" page swallow the error.
export function hasValidGoogleClientId(): boolean {
	if (!GOOGLE_CLIENT_ID) return false;
	if (GOOGLE_CLIENT_ID.includes("__VITE_")) return false;
	if (GOOGLE_CLIENT_ID.startsWith("your-google-client-id")) return false;
	return GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com");
}

// User profile interface
export interface GoogleUser {
	id: string;
	email: string;
	name: string;
	picture?: string;
	given_name?: string;
	family_name?: string;
}

// Auth state interface
export interface AuthState {
	isAuthenticated: boolean;
	user: ApiUser | null;
	accessToken: string | null;
}

// Google Credential Response (from @react-oauth/google)
export interface CredentialResponse {
	credential?: string;
	select_by?: string;
	clientId?: string;
}

// Google Auth Service Class
class GoogleAuthService {
	// Handle successful Google login
	async handleGoogleSuccess(credentialResponse: CredentialResponse): Promise<ApiUser> {
		try {
			if (!credentialResponse.credential) {
				throw new Error("No credential received from Google");
			}

			// Send credential to backend for verification and user creation/login
			const authResponse: AuthResponse = await apiService.googleAuth(credentialResponse.credential);

			storeUser(authResponse.user);

			// Trigger auth state change event
			notifyAuthStateChange();

			Logger.info("Google Sign-In successful:", {
				email: authResponse.user.email,
				name: authResponse.user.name,
			});

			return authResponse.user;
		} catch (error) {
			Logger.error("Google login processing failed:", error);
			throw error;
		}
	}

	// Handle Google login error
	handleGoogleError(error?: unknown): void {
		Logger.error("Google Sign-In failed:", error);
	}

	// Sign out
	async signOut(): Promise<void> {
		try {
			await apiService.logout();

			Logger.info("Google Sign-Out successful");
		} catch (error) {
			Logger.error("Google Sign-Out failed:", error);
			// Even if server logout fails, clear local state
			this.clearAuthState();
			throw error;
		}
	}

	getAuthState(): AuthState {
		try {
			const user = getStoredUser();

			if (user) {
				return {
					isAuthenticated: true,
					user,
					accessToken: null,
				};
			}
		} catch (error) {
			Logger.error("Failed to get auth state:", error);
		}

		return {
			isAuthenticated: false,
			user: null,
			accessToken: null,
		};
	}

	// Validate if current session is actually valid
	async validateSession(): Promise<boolean> {
		try {
			const user = await apiService.getProfile();
			storeUser(user);
			return true;
		} catch {
			// If validation fails, clear auth state
			this.clearAuthState();
			return false;
		}
	}

	// Clear all auth state
	clearAuthState(): void {
		clearStoredAuthState();

		// Trigger auth state change event
		notifyAuthStateChange();
	}

	isSignedIn(): boolean {
		return this.getAuthState().isAuthenticated;
	}

	getCurrentUser(): ApiUser | null {
		return this.getAuthState().user;
	}

	getAccessToken(): string | null {
		return localStorage.getItem(authStorageKeys.accessToken);
	}

	getClientId(): string {
		if (!GOOGLE_CLIENT_ID) {
			throw new Error("Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment.");
		}
		return GOOGLE_CLIENT_ID;
	}
}

// Export singleton instance
export const googleAuth = new GoogleAuthService();

// Google Identity Services button configuration interface
interface GoogleButtonConfig {
	theme?: "outline" | "filled_blue" | "filled_black";
	size?: "large" | "medium" | "small";
	type?: "standard" | "icon";
	shape?: "rectangular" | "pill" | "circle" | "square";
	text?: "signin_with" | "signup_with" | "continue_with" | "signin";
	logo_alignment?: "left" | "center";
	width?: string;
	locale?: string;
}

// Google OAuth token client interface
interface GoogleTokenClient {
	callback: (response: { access_token: string }) => void;
	requestAccessToken: () => void;
}

// Declare global Google Identity Services types for TypeScript
declare global {
	interface Window {
		google: {
			accounts: {
				id: {
					initialize: (config: {
						client_id: string;
						callback: (response: CredentialResponse) => void;
						auto_select?: boolean;
						cancel_on_tap_outside?: boolean;
					}) => void;
					prompt: () => void;
					renderButton: (element: HTMLElement, config: GoogleButtonConfig) => void;
					disableAutoSelect: () => void;
				};
				oauth2: {
					initTokenClient: (config: {
						client_id: string;
						scope: string;
						callback: (response: { access_token: string }) => void;
					}) => GoogleTokenClient;
					revoke: (token: string, callback?: () => void) => void;
				};
			};
		};
	}
}
