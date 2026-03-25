import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

globalThis.jest = vi;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};

// Mock IntersectionObserver
Object.defineProperty(global, "IntersectionObserver", {
	value: class IntersectionObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
		root = null;
		rootMargin = "";
		thresholds = [];
		takeRecords() {
			return [];
		}
	},
	writable: true,
});

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => {},
	}),
});

// Mock mapbox-gl
vi.mock("mapbox-gl", () => ({
	default: {
		Map: vi.fn(() => ({
			on: vi.fn(),
			off: vi.fn(),
			remove: vi.fn(),
			getCanvas: vi.fn(() => ({
				style: { cursor: "" },
			})),
			getSource: vi.fn(),
			addSource: vi.fn(),
			removeSource: vi.fn(),
			addLayer: vi.fn(),
			removeLayer: vi.fn(),
			setLayoutProperty: vi.fn(),
			flyTo: vi.fn(),
			fitBounds: vi.fn(),
			getBounds: vi.fn(),
			getCenter: vi.fn(),
			getZoom: vi.fn(),
			project: vi.fn(),
			unproject: vi.fn(),
		})),
		Marker: vi.fn(() => ({
			setLngLat: vi.fn().mockReturnThis(),
			addTo: vi.fn().mockReturnThis(),
			remove: vi.fn(),
		})),
		Popup: vi.fn(() => ({
			setLngLat: vi.fn().mockReturnThis(),
			setHTML: vi.fn().mockReturnThis(),
			addTo: vi.fn().mockReturnThis(),
			remove: vi.fn(),
		})),
		NavigationControl: vi.fn(),
		GeolocateControl: vi.fn(),
		ScaleControl: vi.fn(),
	},
	GeoJSONSource: vi.fn(),
	LngLat: vi.fn(),
	LngLatBounds: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};

	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value.toString();
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
	};
})();

Object.defineProperty(window, "localStorage", {
	value: localStorageMock,
});

// Mock navigator.geolocation
const mockGeolocation = {
	getCurrentPosition: vi.fn(),
	watchPosition: vi.fn(),
	clearWatch: vi.fn(),
};

Object.defineProperty(navigator, "geolocation", {
	value: mockGeolocation,
});

// Mock URL.createObjectURL
Object.defineProperty(URL, "createObjectURL", {
	value: vi.fn(() => "mocked-url"),
});

// Mock fetch
global.fetch = vi.fn();

// Mock import.meta for Vite
Object.defineProperty(global, "import", {
	value: {
		meta: {
			env: {
				DEV: false,
				PROD: true,
				MODE: "test",
				VITE_MAPBOX_ACCESS_TOKEN: "test-token",
			},
			hot: undefined,
		},
	},
	writable: true,
});

// Alternative approach - mock the import.meta directly
(global as any).importMeta = {
	env: {
		DEV: false,
		PROD: true,
		MODE: "test",
		VITE_MAPBOX_ACCESS_TOKEN: "test-token",
	},
	hot: undefined,
};

// Cleanup after each test
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	localStorageMock.clear();
});
