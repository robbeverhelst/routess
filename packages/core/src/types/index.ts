// Core coordinate and geometry types
export type Coordinate = [number, number];

// Route and waypoint types
export type WaypointType = "routed" | "direct";

export interface Waypoint {
	coord: Coordinate;
	type: WaypointType;
	name?: string;
	timestamp?: string;
}

// Route metadata enums — single source of truth shared across api and web.
// The `*_VALUES` arrays exist for runtime validation (class-validator @IsIn,
// SQL CHECK constraints, etc.); the literal types derive from them.
export const ROUTE_ACTIVITIES = ["run", "cycle", "walk"] as const;
export type RouteActivity = (typeof ROUTE_ACTIVITIES)[number];

export const ROUTE_PRIVACIES = ["private", "link", "public"] as const;
export type RoutePrivacy = (typeof ROUTE_PRIVACIES)[number];

// Map style types
export type MapStyle = "standard" | "satellite";

// Mapbox map configuration
export interface MapboxMapProps {
	initialViewState?: {
		longitude: number;
		latitude: number;
		zoom: number;
	};
	width?: string | number;
	height?: string | number;
}

// API and data types
export interface BirdSighting {
	id: string;
	location: Coordinate;
	species: string;
	timestamp: string;
}

// Storage abstraction types
export interface StorageAdapter {
	getItem(key: string): Promise<string | null> | string | null;
	setItem(key: string, value: string): Promise<void> | void;
	removeItem(key: string): Promise<void> | void;
}

// Platform types for adapters
export type Platform = "web" | "mobile";

// Logger interface for dependency injection
export interface Logger {
	debug: (...messages: unknown[]) => void;
	info: (...messages: unknown[]) => void;
	warn: (...messages: unknown[]) => void;
	error: (...messages: unknown[]) => void;
}
