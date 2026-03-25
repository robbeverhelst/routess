// Core coordinate and geometry types
export type Coordinate = [number, number];

// Route and waypoint types
export interface WaypointHistory {
	waypoints: Coordinate[];
	directFlags: boolean[];
	timestamp: number;
}

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
