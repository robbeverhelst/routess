import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
Object.defineProperty(global, "IntersectionObserver", {
  value: class IntersectionObserver {
    constructor() {}
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
jest.mock("mapbox-gl", () => ({
  default: {
    Map: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
      remove: jest.fn(),
      getCanvas: jest.fn(() => ({
        style: { cursor: "" },
      })),
      getSource: jest.fn(),
      addSource: jest.fn(),
      removeSource: jest.fn(),
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
      setLayoutProperty: jest.fn(),
      flyTo: jest.fn(),
      fitBounds: jest.fn(),
      getBounds: jest.fn(),
      getCenter: jest.fn(),
      getZoom: jest.fn(),
      project: jest.fn(),
      unproject: jest.fn(),
    })),
    Marker: jest.fn(() => ({
      setLngLat: jest.fn().mockReturnThis(),
      addTo: jest.fn().mockReturnThis(),
      remove: jest.fn(),
    })),
    Popup: jest.fn(() => ({
      setLngLat: jest.fn().mockReturnThis(),
      setHTML: jest.fn().mockReturnThis(),
      addTo: jest.fn().mockReturnThis(),
      remove: jest.fn(),
    })),
    NavigationControl: jest.fn(),
    GeolocateControl: jest.fn(),
    ScaleControl: jest.fn(),
  },
  GeoJSONSource: jest.fn(),
  LngLat: jest.fn(),
  LngLatBounds: jest.fn(),
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
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};

Object.defineProperty(navigator, "geolocation", {
  value: mockGeolocation,
});

// Mock URL.createObjectURL
Object.defineProperty(URL, "createObjectURL", {
  value: jest.fn(() => "mocked-url"),
});

// Mock fetch
global.fetch = jest.fn();

// Cleanup after each test
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  localStorageMock.clear();
});
