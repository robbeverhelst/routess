import { renderHook } from "@testing-library/react";
import type { Map as MapboxMap } from "mapbox-gl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMapPositioning } from "../useMapPositioning";

vi.mock("@/features/routing/services/RouteCalculationService", () => ({
	getCurrentRoutePath: vi.fn(() => null),
}));
vi.mock("@/features/routing/utils/RoutingUtils", () => ({
	zoomToRoute: vi.fn(),
}));

const createMockMap = () => ({ flyTo: vi.fn() });

const baseProps = {
	isMapReady: true,
	hasRoute: false,
	isRouteCoordsReady: false,
	userLocation: null as [number, number] | null,
	isUserLocationLoading: false,
	locationError: null,
	lastKnownLocationFromStorage: [4.7, 51.0] as [number, number] | null,
	detectedRouteInLocalStorageOnInit: false,
	pendingSharedRoute: false,
	hasSavedMapView: false,
	mapPitch: 30,
};

describe("useMapPositioning", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("flies to the last known location when there is no saved map view", () => {
		const mockMap = createMockMap();
		const mapRef = { current: mockMap as unknown as MapboxMap };

		renderHook(() => useMapPositioning({ ...baseProps, mapRef }));

		expect(mockMap.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [4.7, 51.0] }));
	});

	it("does not fly anywhere when the camera was restored from a saved map view", () => {
		const mockMap = createMockMap();
		const mapRef = { current: mockMap as unknown as MapboxMap };

		renderHook(() => useMapPositioning({ ...baseProps, mapRef, hasSavedMapView: true, userLocation: [4.4, 51.2] }));

		expect(mockMap.flyTo).not.toHaveBeenCalled();
	});
});
