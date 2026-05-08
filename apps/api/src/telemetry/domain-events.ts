export const ROUTE_CREATED = "route.created";
export const ROUTE_DELETED = "route.deleted";
export const USER_REGISTERED = "user.registered";
export const SESSION_ACTIVITY_CHANGED = "session.activity-changed";

export interface RouteCreatedEvent {
	userId: number;
}

export interface RouteDeletedEvent {
	userId: number;
}

export interface UserRegisteredEvent {
	source: "google" | "email";
}

export type SessionActivityChangedEvent = Record<string, never>;
