export const ROUTE_CREATED = "route.created";
export const ROUTE_DELETED = "route.deleted";
export const USER_REGISTERED = "user.registered";
export const USER_UNDELETED = "user.undeleted";
export const SESSION_ACTIVITY_CHANGED = "session.activity-changed";
export const AUTH_LOGIN_ATTEMPTED = "auth.login.attempted";
export const AUTH_SESSION_REVOKED = "auth.session.revoked";

export interface RouteCreatedEvent {
	userId: number;
}

export interface RouteDeletedEvent {
	userId: number;
}

export interface UserRegisteredEvent {
	source: "google" | "email";
}

export interface UserUndeletedEvent {
	userId: number;
}

export type SessionActivityChangedEvent = Record<string, never>;

export type AuthProvider = "google" | "email";

export type AuthLoginResult = "success" | "invalid_token" | "email_missing" | "verification_error";

export interface AuthLoginAttemptedEvent {
	provider: AuthProvider;
	result: AuthLoginResult;
}

export type SessionRevocationReason =
	| "logout"
	| "admin_revoked"
	| "expired"
	| "invalidated"
	| "revoked"
	| "logout_everywhere";

export interface AuthSessionRevokedEvent {
	reason: SessionRevocationReason;
	count: number;
}
