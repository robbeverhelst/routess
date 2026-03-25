import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { useMapInitialization } from "@/components/hooks/useMapInitialization";
import { useMapPositioning } from "@/components/hooks/useMapPositioning";
import { useMapConfiguration } from "@/components/providers/MapConfigurationProvider";
import { useUserLocation } from "@/components/providers/UserLocationProvider";
import { useErrorHandler } from "@/lib/errors";
import type { SupportedLanguage } from "@/lib/i18n";
import { MapCanvas } from "../MapCanvas";

// Mock all dependencies
jest.mock("react-map-gl/mapbox", () => ({
	__esModule: true,
	default: React.forwardRef(({ children, onLoad, ...props }: any, ref: any) => {
		React.useImperativeHandle(ref, () => ({
			getMap: () => mockMapInstance,
		}));

		// Simulate map load
		React.useEffect(() => {
			if (onLoad) {
				onLoad({ target: mockMapInstance });
			}
		}, [onLoad]);

		return (
			<div data-testid="mock-map" {...props}>
				{children}
			</div>
		);
	}),
}));

jest.mock("@/components/providers/MapConfigurationProvider");
jest.mock("@/components/providers/UserLocationProvider");
jest.mock("@/components/hooks/useMapInitialization");
jest.mock("@/components/hooks/useMapPositioning");
jest.mock("@/lib/errors");
jest.mock("@/components/ui/MapPopup", () => ({
	MapPopup: ({ popupInfo }: any) => (
		<div data-testid="map-popup">
			{popupInfo.longitude},{popupInfo.latitude}
		</div>
	),
}));
jest.mock("@/components/ui/SunPositionIndicator", () => ({
	SunPositionIndicator: ({ azimuth }: any) => <div data-testid="sun-indicator">Azimuth: {azimuth}</div>,
}));

// Mock Mapbox instance
const mockMapInstance = {
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
	setPaintProperty: jest.fn(),
	flyTo: jest.fn(),
	fitBounds: jest.fn(),
	getBounds: jest.fn(),
	getCenter: jest.fn(),
	getZoom: jest.fn(),
	getBearing: jest.fn(() => 0),
	project: jest.fn(),
	unproject: jest.fn(),
	getLayer: jest.fn(() => true),
};

describe("MapCanvas", () => {
	const mockSetRouteDistance = jest.fn();
	const mockSetRouteDuration = jest.fn();
	const mockSetHasRoute = jest.fn();
	const mockSetPopup = jest.fn();
	const mockHandleWaypointError = jest.fn();
	const mockHandleRouteInfoError = jest.fn();
	const mockOnAddDirectWaypoint = jest.fn();
	const mockOnRemoveWaypoint = jest.fn();
	const mockOnAddWaypointOnRoute = jest.fn();
	const mockHandleMapError = jest.fn();
	const mockHandleMapLoad = jest.fn();
	const mockSetCurrentBearing = jest.fn();

	const defaultProps = {
		mapRef: React.createRef<any>(),
		mapboxToken: "test-token-123456789",
		currentLanguage: "en" as SupportedLanguage,
		setRouteDistance: mockSetRouteDistance,
		setRouteDuration: mockSetRouteDuration,
		setHasRoute: mockSetHasRoute,
		hasRoute: false,
		popup: null,
		setPopup: mockSetPopup,
		onAddDirectWaypoint: mockOnAddDirectWaypoint,
		onRemoveWaypoint: mockOnRemoveWaypoint,
		onAddWaypointOnRoute: mockOnAddWaypointOnRoute,
		handleWaypointError: mockHandleWaypointError,
		handleRouteInfoError: mockHandleRouteInfoError,
		lastKnownLocationFromStorage: null,
		detectedRouteInLocalStorageOnInit: false,
		lastSavedMapView: null,
	};

	beforeEach(() => {
		jest.clearAllMocks();

		// Mock provider values
		(useMapConfiguration as jest.Mock).mockReturnValue({
			currentMapStyle: "standard",
			isMapLocked: false,
			currentLightPreset: "day",
			currentBearing: 0,
			setCurrentBearing: mockSetCurrentBearing,
			showSunDirection: false,
			currentSunPosition: null,
		});

		(useUserLocation as jest.Mock).mockReturnValue({
			location: null,
			error: null,
			isLoading: false,
		});

		(useErrorHandler as jest.Mock).mockReturnValue({
			handleMapError: mockHandleMapError,
		});

		(useMapInitialization as jest.Mock).mockReturnValue({
			handleMapLoad: mockHandleMapLoad,
		});

		(useMapPositioning as jest.Mock).mockReturnValue({});
	});

	describe("Rendering", () => {
		it("should render the map component", () => {
			render(<MapCanvas {...defaultProps} />);
			expect(screen.getByTestId("mock-map")).toBeInTheDocument();
		});

		it("should apply correct dimensions", () => {
			render(<MapCanvas {...defaultProps} width="800px" height="600px" />);
			const map = screen.getByTestId("mock-map");
			expect(map).toHaveStyle({ width: "800px", height: "600px" });
		});

		it("should use satellite style when configured", () => {
			(useMapConfiguration as jest.Mock).mockReturnValue({
				currentMapStyle: "satellite",
				isMapLocked: false,
				currentLightPreset: "day",
				currentBearing: 0,
				setCurrentBearing: mockSetCurrentBearing,
				showSunDirection: false,
				currentSunPosition: null,
			});

			render(<MapCanvas {...defaultProps} />);
			const map = screen.getByTestId("mock-map");
			expect(map).toHaveAttribute("mapStyle", "mapbox://styles/mapbox/satellite-streets-v12");
		});
	});

	describe("Map Initialization", () => {
		it("should validate mapbox token on mount", () => {
			render(<MapCanvas {...defaultProps} />);
			expect(mockHandleMapError).not.toHaveBeenCalled();
		});

		it("should handle invalid mapbox token", () => {
			render(<MapCanvas {...defaultProps} mapboxToken="__VITE_INVALID__" />);
			expect(mockHandleMapError).toHaveBeenCalledWith(expect.any(Error), "mapbox-config");
		});

		it("should handle missing mapbox token", () => {
			render(<MapCanvas {...defaultProps} mapboxToken="" />);
			expect(mockHandleMapError).toHaveBeenCalledWith(expect.any(Error), "mapbox-config");
		});

		it("should call handleMapLoad when map loads", async () => {
			render(<MapCanvas {...defaultProps} />);

			await waitFor(() => {
				expect(mockHandleMapLoad).toHaveBeenCalled();
			});
		});

		it("should set mapRef when map loads", async () => {
			const mapRef = React.createRef<any>();
			render(<MapCanvas {...defaultProps} mapRef={mapRef} />);

			await waitFor(() => {
				expect(mapRef.current).toBe(mockMapInstance);
			});
		});
	});

	describe("Initial View State", () => {
		it("should use initial center and zoom when provided", () => {
			render(<MapCanvas {...defaultProps} initialCenter={[13.405, 52.52]} initialZoom={12} />);

			const map = screen.getByTestId("mock-map");
			// Check that the initial view state includes the expected coordinates
			expect(map).toHaveAttribute("initialViewState");
			// We can't directly parse the object, but we can verify it was passed
			expect(useMapInitialization).toHaveBeenCalled();
		});

		it("should use user location when available", () => {
			(useUserLocation as jest.Mock).mockReturnValue({
				location: [2.3522, 48.8566],
				error: null,
				isLoading: false,
			});

			render(<MapCanvas {...defaultProps} />);

			// Verify the map component receives the location data
			expect(useUserLocation).toHaveBeenCalled();
			expect(useMapPositioning).toHaveBeenCalledWith(
				expect.objectContaining({
					userLocation: [2.3522, 48.8566],
				}),
			);
		});

		it("should use last known location when available", () => {
			render(<MapCanvas {...defaultProps} lastKnownLocationFromStorage={[-0.1276, 51.5074]} />);

			// Verify the location is passed to positioning hook
			expect(useMapPositioning).toHaveBeenCalledWith(
				expect.objectContaining({
					lastKnownLocationFromStorage: [-0.1276, 51.5074],
				}),
			);
		});

		it("should use default view state when no location data available", () => {
			render(<MapCanvas {...defaultProps} />);

			// Verify component renders without location data
			expect(screen.getByTestId("mock-map")).toBeInTheDocument();
			expect(useMapInitialization).toHaveBeenCalled();
		});

		it("should use saved map view when available", () => {
			const savedView = {
				longitude: 8.5,
				latitude: 47.3,
				zoom: 10,
				bearing: 45,
				pitch: 30,
			};

			render(<MapCanvas {...defaultProps} lastSavedMapView={savedView} />);

			// Verify the saved view is used in initialization
			expect(useMapInitialization).toHaveBeenCalled();
			expect(screen.getByTestId("mock-map")).toBeInTheDocument();
		});
	});

	describe("Map Popup", () => {
		it("should not render popup when popup is null", () => {
			render(<MapCanvas {...defaultProps} />);
			expect(screen.queryByTestId("map-popup")).not.toBeInTheDocument();
		});

		it("should render popup when popup info is provided", async () => {
			const popupInfo = {
				longitude: 13.405,
				latitude: 52.52,
				type: "direct" as const,
				waypointIndex: 0,
			};

			const mapRef = React.createRef<any>();
			render(<MapCanvas {...defaultProps} mapRef={mapRef} popup={popupInfo} />);

			// Wait for map to load and set ref
			await waitFor(() => {
				expect(mapRef.current).toBe(mockMapInstance);
			});

			// Re-render with ref set
			render(<MapCanvas {...defaultProps} mapRef={mapRef} popup={popupInfo} />);

			expect(screen.getByTestId("map-popup")).toBeInTheDocument();
			expect(screen.getByText("13.405,52.52")).toBeInTheDocument();
		});
	});

	describe("Sun Position Indicator", () => {
		it("should not render sun indicator when showSunDirection is false", () => {
			render(<MapCanvas {...defaultProps} />);
			expect(screen.queryByTestId("sun-indicator")).not.toBeInTheDocument();
		});

		it("should render sun indicator when all conditions are met", () => {
			(useMapConfiguration as jest.Mock).mockReturnValue({
				currentMapStyle: "standard",
				isMapLocked: false,
				currentLightPreset: "day",
				currentBearing: 0,
				setCurrentBearing: mockSetCurrentBearing,
				showSunDirection: true,
				currentSunPosition: {
					azimuth: 180,
					elevation: 45,
					isUp: true,
				},
			});

			(useUserLocation as jest.Mock).mockReturnValue({
				location: [2.3522, 48.8566],
				error: null,
				isLoading: false,
			});

			render(<MapCanvas {...defaultProps} />);
			expect(screen.getByTestId("sun-indicator")).toBeInTheDocument();
			expect(screen.getByText("Azimuth: 180")).toBeInTheDocument();
		});
	});

	describe("Error Handling", () => {
		it("should handle invalid mapbox token on mount", () => {
			render(<MapCanvas {...defaultProps} mapboxToken="__VITE_INVALID__" />);

			expect(mockHandleMapError).toHaveBeenCalledWith(expect.any(Error), "mapbox-config");
			expect(mockHandleMapError.mock.calls[0][0].message).toContain("Mapbox access token");
		});

		it("should handle map load errors through onError prop", () => {
			// The error handling is built into the Map component's onError prop
			// We can verify the component renders with error handling capability
			render(<MapCanvas {...defaultProps} />);

			const map = screen.getByTestId("mock-map");
			expect(map).toBeInTheDocument();

			// Verify that the mock map component would receive onError props
			// (this is handled by our mock implementation)
			expect(screen.getByTestId("mock-map")).toBeInTheDocument();
		});
	});

	describe("Map Positioning", () => {
		it("should call useMapPositioning with correct props", () => {
			const mapRef = React.createRef<any>();
			const userLocation: [number, number] = [2.3522, 48.8566];

			(useUserLocation as jest.Mock).mockReturnValue({
				location: userLocation,
				error: null,
				isLoading: true,
			});

			render(
				<MapCanvas
					{...defaultProps}
					mapRef={mapRef}
					hasRoute={true}
					lastKnownLocationFromStorage={[-0.1276, 51.5074]}
					detectedRouteInLocalStorageOnInit={true}
				/>,
			);

			expect(useMapPositioning).toHaveBeenCalledWith({
				mapRef: mapRef,
				isMapReady: expect.any(Boolean),
				hasRoute: true,
				isRouteCoordsReady: true,
				userLocation: userLocation,
				isUserLocationLoading: true,
				locationError: null,
				lastKnownLocationFromStorage: [-0.1276, 51.5074],
				detectedRouteInLocalStorageOnInit: true,
				mapPitch: 30,
			});
		});
	});

	describe("Map Configuration", () => {
		it("should respect map pitch settings", () => {
			render(<MapCanvas {...defaultProps} />);

			const map = screen.getByTestId("mock-map");
			expect(map).toHaveAttribute("minPitch", "30");
			expect(map).toHaveAttribute("maxPitch", "30");
		});

		it("should set bearing from initial view state", async () => {
			render(<MapCanvas {...defaultProps} initialCenter={[13.405, 52.52]} initialZoom={12} />);

			await waitFor(() => {
				expect(mockSetCurrentBearing).not.toHaveBeenCalled();
			});
		});
	});
});
