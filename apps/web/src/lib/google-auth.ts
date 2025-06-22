import { Logger } from "./logger";
import { apiService, type ApiUser, type AuthResponse } from "./api";

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

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

      // Store access token and user data
      localStorage.setItem("access_token", authResponse.accessToken);
      localStorage.setItem("user", JSON.stringify(authResponse.user));

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
    throw new Error("Google authentication failed");
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      // Call API logout and clear stored data
      await apiService.logout();
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");

      Logger.info("Google Sign-Out successful");
    } catch (error) {
      Logger.error("Google Sign-Out failed:", error);
      throw error;
    }
  }

  // Get current authentication state
  getAuthState(): AuthState {
    try {
      const accessToken = localStorage.getItem("access_token");
      const userJson = localStorage.getItem("user");

      if (accessToken && userJson) {
        const user = JSON.parse(userJson) as ApiUser;
        return {
          isAuthenticated: true,
          user,
          accessToken,
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

  // Check if user is currently signed in
  isSignedIn(): boolean {
    return this.getAuthState().isAuthenticated;
  }

  // Get current user
  getCurrentUser(): ApiUser | null {
    return this.getAuthState().user;
  }

  // Get stored access token
  getAccessToken(): string | null {
    return localStorage.getItem("access_token");
  }

  // Get Google Client ID
  getClientId(): string {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error(
        "Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment.",
      );
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
