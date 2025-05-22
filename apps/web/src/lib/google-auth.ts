import { Logger } from './logger';

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
  user: GoogleUser | null;
  accessToken: string | null;
}

// Google Credential Response (from @react-oauth/google)
export interface CredentialResponse {
  credential?: string;
  select_by?: string;
  clientId?: string;
}

// JWT Payload interface
interface GoogleJWTPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
}

// Google Auth Service Class
class GoogleAuthService {
  
  // Parse JWT token to get user information
  private parseCredential(credential: string): GoogleUser {
    try {
      const base64Url = credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      const payload = JSON.parse(jsonPayload) as GoogleJWTPayload;
      
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        given_name: payload.given_name,
        family_name: payload.family_name
      };
    } catch (error) {
      Logger.error('Failed to parse Google credential:', error);
      throw new Error('Invalid Google credential');
    }
  }

  // Handle successful Google login
  async handleGoogleSuccess(credentialResponse: CredentialResponse): Promise<GoogleUser> {
    try {
      if (!credentialResponse.credential) {
        throw new Error('No credential received from Google');
      }

      // Parse the JWT credential to get user info
      const user = this.parseCredential(credentialResponse.credential);
      
      // Store user data and credential
      localStorage.setItem('google_credential', credentialResponse.credential);
      localStorage.setItem('google_user', JSON.stringify(user));
      
      Logger.info('Google Sign-In successful:', { email: user.email, name: user.name });
      
      return user;
    } catch (error) {
      Logger.error('Google login processing failed:', error);
      throw error;
    }
  }

  // Handle Google login error
  handleGoogleError(error?: unknown): void {
    Logger.error('Google Sign-In failed:', error);
    throw new Error('Google authentication failed');
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      // Clear stored data
      localStorage.removeItem('google_credential');
      localStorage.removeItem('google_user');
      
      Logger.info('Google Sign-Out successful');
    } catch (error) {
      Logger.error('Google Sign-Out failed:', error);
      throw error;
    }
  }

  // Get current authentication state
  getAuthState(): AuthState {
    try {
      const credential = localStorage.getItem('google_credential');
      const userJson = localStorage.getItem('google_user');
      
      if (credential && userJson) {
        const user = JSON.parse(userJson) as GoogleUser;
        return {
          isAuthenticated: true,
          user,
          accessToken: credential // Using credential as token for now
        };
      }
    } catch (error) {
      Logger.error('Failed to get auth state:', error);
    }
    
    return {
      isAuthenticated: false,
      user: null,
      accessToken: null
    };
  }

  // Check if user is currently signed in
  isSignedIn(): boolean {
    return this.getAuthState().isAuthenticated;
  }

  // Get current user
  getCurrentUser(): GoogleUser | null {
    return this.getAuthState().user;
  }

  // Get stored credential
  getCredential(): string | null {
    return localStorage.getItem('google_credential');
  }

  // Get Google Client ID
  getClientId(): string {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment.');
    }
    return GOOGLE_CLIENT_ID;
  }
}

// Export singleton instance
export const googleAuth = new GoogleAuthService();

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
          renderButton: (element: HTMLElement, config: any) => void;
          disableAutoSelect: () => void;
        };
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string }) => void;
          }) => any;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
} 