import React, { type ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock providers for testing
interface ProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: ProvidersProps) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  return <QueryClientProvider client={queryClient}>{children as any}</QueryClientProvider>;
};

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from "@testing-library/react";
export { customRender as render };

// Mock coordinates for testing
export const mockCoordinates = {
  berlin: [13.405, 52.52] as [number, number],
  paris: [2.3522, 48.8566] as [number, number],
  london: [-0.1276, 51.5074] as [number, number],
  newYork: [-74.006, 40.7128] as [number, number],
};

// Mock route data
export const mockRouteData = {
  distance: "15.2 km",
  duration: "32 min",
  coordinates: [mockCoordinates.berlin, [13.41, 52.525], [13.415, 52.53], mockCoordinates.paris],
};

// Helper to create mock Mapbox map
export const createMockMap = () => ({
  on: jest.fn(),
  off: jest.fn(),
  remove: jest.fn(),
  getCanvas: jest.fn(() => ({ style: { cursor: "" } })),
  getSource: jest.fn(),
  addSource: jest.fn(),
  removeSource: jest.fn(),
  addLayer: jest.fn(),
  removeLayer: jest.fn(),
  setLayoutProperty: jest.fn(),
  flyTo: jest.fn(),
  fitBounds: jest.fn(),
  getBounds: jest.fn(() => ({
    getNorthEast: () => ({ lng: 13.5, lat: 52.6 }),
    getSouthWest: () => ({ lng: 13.3, lat: 52.4 }),
  })),
  getCenter: jest.fn(() => ({ lng: 13.405, lat: 52.52 })),
  getZoom: jest.fn(() => 10),
  project: jest.fn(() => ({ x: 100, y: 100 })),
  unproject: jest.fn(() => ({ lng: 13.405, lat: 52.52 })),
});

// Helper to wait for async operations
export const waitFor = async (callback: () => void, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      try {
        callback();
        resolve(true);
      } catch (error) {
        if (Date.now() - startTime >= timeout) {
          reject(error);
        } else {
          setTimeout(check, 10);
        }
      }
    };
    check();
  });
};
