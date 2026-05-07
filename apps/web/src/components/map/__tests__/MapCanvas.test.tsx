import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { type Mock, vi } from "vitest";
import { useMapInitialization } from "@/components/hooks/useMapInitialization";
import { useMapPositioning } from "@/components/hooks/useMapPositioning";
import { useMapViewBindings } from "@/components/hooks/useMapViewBindings";
import { useUserLocation } from "@/components/providers/UserLocationProvider";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useErrorHandler } from "@/lib/errors";
import type { SupportedLanguage } from "@/lib/i18n";
import { useMapViewStore } from "@/stores/mapViewStore";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useRoutingStore } from "@/stores/routingStore";
import { MapCanvas } from "../MapCanvas";

vi.mock("react-map-gl/mapbox", () => ({
	__esModule: true,
	default: React.forwardRef(
		({ children, onLoad, style, mapStyle, initialViewState, minPitch, maxPitch }: any, ref: any) => {
			React.useImperativeHandle(ref, () => ({ getMap: () => mockMapInstance }));

			React.useEffect(() => {
				if (onLoad) onLoad({ target: mockMapInstance });
			}, [onLoad]);

			return (
				<div
					data-testid="mock-map"
					data-map-style={mapStyle}
					data-initial-view-state={JSON.stringify(initialViewState)}
					data-min-pitch={String(minPitch)}
					data-max-pitch={String(maxPitch)}
					style={style}
				>
					{children}
				</div>
			);
		},
	),
}));

vi.mock("@/components/providers/UserLocationProvider");
vi.mock("@/components/hooks/useMapInitialization");
vi.mock("@/components/hooks/useMapPositioning");
vi.mock("@/components/hooks/useMapViewBindings");
vi.mock("@/hooks/useServiceWorker");
vi.mock("@/stores/mapViewStore");
vi.mock("@/stores/redesignSettingsStore");
vi.mock("@/stores/routingStore");
vi.mock("@/lib/errors");
vi.mock("@/components/ui/MapPopup", () => ({
	MapPopup: ({ popupInfo }: any) => (
		<div data-testid="map-popup">
			{popupInfo.longitude},{popupInfo.latitude}
		</div>
	),
}));
vi.mock("@/components/ui/SunPositionIndicator", () => ({
	SunPositionIndicator: ({ azimuth }: any) => <div data-testid="sun-indicator">Azimuth: {azimuth}</div>,
}));

const mockMapInstance = {
	on: vi.fn(),
	off: vi.fn(),
	resize: vi.fn(),
	remove: vi.fn(),
	getCanvas: vi.fn(() => ({ style: { cursor: "" } })),
	getSource: vi.fn(),
	addSource: vi.fn(),
	removeSource: vi.fn(),
	addLayer: vi.fn(),
	removeLayer: vi.fn(),
	setLayoutProperty: vi.fn(),
	setPaintProperty: vi.fn(),
	flyTo: vi.fn(),
	fitBounds: vi.fn(),
	getBounds: vi.fn(),
	getCenter: vi.fn(),
	getZoom: vi.fn(),
	getBearing: vi.fn(() => 0),
	project: vi.fn(),
	unproject: vi.fn(),
	getLayer: vi.fn(() => true),
	setConfigProperty: vi.fn(),
};

// Selector-aware Zustand mock: each store's mock returns a snapshot that the
// selector function picks values from, so component code keeps the same
// `useStore((s) => s.field)` shape.
function mockStoreSelector<T>(mock: Mock, snapshot: T) {
	mock.mockImplementation((selector: ((state: T) => unknown) | undefined) =>
		selector ? selector(snapshot) : snapshot,
	);
}

describe("MapCanvas", () => {
	const mockSetEditor = vi.fn();
	const mockSetPopup = vi.fn();
	const mockHandleWaypointError = vi.fn();
	const mockOnAddDirectWaypoint = vi.fn();
	const mockOnRemoveWaypoint = vi.fn();
	const mockOnAddWaypointOnRoute = vi.fn();
	const mockHandleMapError = vi.fn();
	const mockHandleMapLoad = vi.fn();
	const mockSetCurrentBearing = vi.fn();
	const mockOnMapStyleLoaded = vi.fn();

	const defaultProps = {
		mapRef: React.createRef<any>(),
		mapboxToken: "test-token-123456789",
		currentLanguage: "en" as SupportedLanguage,
		setEditor: mockSetEditor,
		hasRoute: false,
		popup: null,
		setPopup: mockSetPopup,
		onAddDirectWaypoint: mockOnAddDirectWaypoint,
		onRemoveWaypoint: mockOnRemoveWaypoint,
		onAddWaypointOnRoute: mockOnAddWaypointOnRoute,
		handleWaypointError: mockHandleWaypointError,
		lastKnownLocationFromStorage: null,
		detectedRouteInLocalStorageOnInit: false,
		lastSavedMapView: null,
	};

	const setStyleKey = (mapStyle: "streets" | "satellite" | "outdoors") => {
		mockStoreSelector(useRedesignSettingsStore as unknown as Mock, { mapStyle });
	};

	beforeEach(() => {
		vi.clearAllMocks();

		setStyleKey("streets");
		mockStoreSelector(useRoutingStore as unknown as Mock, { isMapLocked: false });
		mockStoreSelector(useMapViewStore as unknown as Mock, {
			lightPreset: "day",
			bearing: 0,
			setBearing: mockSetCurrentBearing,
			showSunDirection: false,
			sunPosition: null,
		});

		(useMapViewBindings as Mock).mockReturnValue({ onMapStyleLoaded: mockOnMapStyleLoaded });

		(useUserLocation as Mock).mockReturnValue({ location: null, error: null, isLoading: false });

		(useServiceWorker as Mock).mockReturnValue({ isOnline: true });

		(useErrorHandler as Mock).mockReturnValue({ handleMapError: mockHandleMapError });

		(useMapInitialization as Mock).mockReturnValue({ handleMapLoad: mockHandleMapLoad });

		(useMapPositioning as Mock).mockReturnValue({});
	});

	describe("Rendering", () => {
		it("should render the map component", () => {
			render(<MapCanvas {...defaultProps} />);
			expect(screen.getByTestId("mock-map")).toBeInTheDocument();
		});

		it("should apply correct dimensions", () => {
			render(<MapCanvas {...defaultProps} width="800px" height="600px" />);
			const map = screen.getByTestId("mock-map");
			expect(map.parentElement).toHaveStyle({ width: "800px", height: "600px" });
		});

		it("should use satellite style when configured", () => {
			setStyleKey("satellite");

			render(<MapCanvas {...defaultProps} />);
			const map = screen.getByTestId("mock-map");
			expect(map).toHaveAttribute("data-map-style", "mapbox://styles/robbeverhelst/cmosm5k7x000c01segxetckb9");
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
			const initialViewState = JSON.parse(map.getAttribute("data-initial-view-state") || "{}");
			expect(initialViewState).toMatchObject({ longitude: 13.405, latitude: 52.52, zoom: 12 });
			expect(useMapInitialization).toHaveBeenCalled();
		});

		it("should use user location when available", () => {
			(useUserLocation as Mock).mockReturnValue({
				location: [2.3522, 48.8566],
				error: null,
				isLoading: false,
			});

			render(<MapCanvas {...defaultProps} />);
			expect(useUserLocation).toHaveBeenCalled();
			expect(useMapPositioning).toHaveBeenCalledWith(expect.objectContaining({ userLocation: [2.3522, 48.8566] }));
		});

		it("should use last known location when available", () => {
			render(<MapCanvas {...defaultProps} lastKnownLocationFromStorage={[-0.1276, 51.5074]} />);
			expect(useMapPositioning).toHaveBeenCalledWith(
				expect.objectContaining({ lastKnownLocationFromStorage: [-0.1276, 51.5074] }),
			);
		});

		it("should use default view state when no location data available", () => {
			render(<MapCanvas {...defaultProps} />);
			expect(screen.getByTestId("mock-map")).toBeInTheDocument();
			expect(useMapInitialization).toHaveBeenCalled();
		});

		it("should use the selected redesign style by default", () => {
			render(<MapCanvas {...defaultProps} />);
			const map = screen.getByTestId("mock-map");
			expect(map).toHaveAttribute("data-map-style", "mapbox://styles/mapbox/standard");
		});

		it("should use saved map view when available", () => {
			const savedView = { longitude: 8.5, latitude: 47.3, zoom: 10, bearing: 45, pitch: 30 };
			render(<MapCanvas {...defaultProps} lastSavedMapView={savedView} />);
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
			const { rerender } = render(<MapCanvas {...defaultProps} mapRef={mapRef} popup={popupInfo} />);

			await waitFor(() => {
				expect(mapRef.current).toBe(mockMapInstance);
			});

			rerender(<MapCanvas {...defaultProps} mapRef={mapRef} popup={popupInfo} />);

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
			mockStoreSelector(useMapViewStore as unknown as Mock, {
				lightPreset: "day",
				bearing: 0,
				setBearing: mockSetCurrentBearing,
				showSunDirection: true,
				sunPosition: { azimuth: 180, elevation: 45, isUp: true },
			});

			(useUserLocation as Mock).mockReturnValue({
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
			render(<MapCanvas {...defaultProps} />);
			expect(screen.getByTestId("mock-map")).toBeInTheDocument();
		});
	});

	describe("Map Positioning", () => {
		it("should call useMapPositioning with correct props", () => {
			const mapRef = React.createRef<any>();
			const userLocation: [number, number] = [2.3522, 48.8566];

			(useUserLocation as Mock).mockReturnValue({ location: userLocation, error: null, isLoading: true });

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
			expect(map).toHaveAttribute("data-min-pitch", "30");
			expect(map).toHaveAttribute("data-max-pitch", "30");
		});

		it("should set bearing from initial view state", async () => {
			render(<MapCanvas {...defaultProps} initialCenter={[13.405, 52.52]} initialZoom={12} />);
			await waitFor(() => {
				expect(mockSetCurrentBearing).not.toHaveBeenCalled();
			});
		});
	});
});
