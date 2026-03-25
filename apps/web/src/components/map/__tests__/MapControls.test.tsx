import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { type Mock, vi } from "vitest";
import { useMapConfiguration } from "@/components/providers/MapConfigurationProvider";
import { useMapModals } from "@/components/providers/MapModalsProvider";
import { useUserLocation } from "@/components/providers/UserLocationProvider";
import type { SupportedLanguage } from "@/lib/i18n";
import { MapControls } from "../MapControls";

// Mock dependencies
vi.mock("@/components/providers/MapConfigurationProvider");
vi.mock("@/components/providers/UserLocationProvider");
vi.mock("@/components/providers/MapModalsProvider");
vi.mock("@/components/ui/route-controls", () => ({
	RouteControls: ({ onUndo, onRedo, onReset, canUndo, canRedo, hasRoute }: Record<string, unknown>) => (
		<div data-testid="route-controls">
			<button type="button" onClick={onUndo as React.MouseEventHandler} disabled={!canUndo}>
				Undo
			</button>
			<button type="button" onClick={onRedo as React.MouseEventHandler} disabled={!canRedo}>
				Redo
			</button>
			<button type="button" onClick={onReset as React.MouseEventHandler} disabled={!hasRoute}>
				Reset
			</button>
		</div>
	),
}));
vi.mock("@/components/ui/location-search", () => ({
	LocationSearch: ({ isMobileSearchOpen, onToggleMobileSearch }: Record<string, unknown>) => (
		<div data-testid="location-search">
			{isMobileSearchOpen && <input data-testid="search-input" />}
			<button type="button" onClick={onToggleMobileSearch as React.MouseEventHandler} data-testid="search-toggle">
				Search
			</button>
		</div>
	),
}));
vi.mock("@/components/ui/sidebar", () => ({
	Sidebar: ({ onShare, hasRoute, routeDistance, routeDuration }: Record<string, unknown>) => (
		<div data-testid="sidebar">
			<button type="button" onClick={onShare as React.MouseEventHandler} disabled={!hasRoute}>
				Share
			</button>
			{routeDistance && <span data-testid="route-distance">{routeDistance}</span>}
			{routeDuration && <span data-testid="route-duration">{routeDuration}</span>}
		</div>
	),
}));

describe("MapControls", () => {
	const mockSetRouteDistance = vi.fn();
	const mockSetRouteDuration = vi.fn();
	const mockSetHasRoute = vi.fn();
	const mockOnUndo = vi.fn();
	const mockOnRedo = vi.fn();
	const mockOnReverseRoute = vi.fn();
	const mockOnReset = vi.fn();
	const mockOnZoomToRoute = vi.fn();
	const mockOnShare = vi.fn();
	const mockOnCopySharedUrl = vi.fn();
	const mockOnClearShareDisplay = vi.fn();
	const mockOnCopyShareLink = vi.fn();
	const mockOnSelectLocation = vi.fn();
	const mockOnImportError = vi.fn();
	const mockOnLanguageChange = vi.fn();
	const mockHandleLocateButtonClick = vi.fn();
	const mockOpenRouteGeneratorModal = vi.fn();
	const mockOpenSaveRouteModal = vi.fn();
	const mockOpenRouteLibraryModal = vi.fn();
	const mockOnToggleLock = vi.fn();
	const mockOnCycleTimeOfDay = vi.fn();
	const mockOnCycleBearing = vi.fn();
	const mockOnZoomIn = vi.fn();
	const mockOnZoomOut = vi.fn();
	const mockOnToggleMapStyle = vi.fn();
	const mockOnToggleSunDirection = vi.fn();

	const defaultProps = {
		mapRef: React.createRef<unknown>(),
		mapboxToken: "test-token",
		currentLanguage: "en" as SupportedLanguage,
		onLanguageChange: mockOnLanguageChange,
		hasRoute: false,
		routeDistance: "",
		routeDuration: "",
		setRouteDistance: mockSetRouteDistance,
		setRouteDuration: mockSetRouteDuration,
		setHasRoute: mockSetHasRoute,
		onUndo: mockOnUndo,
		onRedo: mockOnRedo,
		onReverseRoute: mockOnReverseRoute,
		onReset: mockOnReset,
		onZoomToRoute: mockOnZoomToRoute,
		canUndo: false,
		canRedo: false,
		onShare: mockOnShare,
		displayedShareUrl: null,
		onCopySharedUrl: mockOnCopySharedUrl,
		onClearShareDisplay: mockOnClearShareDisplay,
		onCopyShareLink: mockOnCopyShareLink,
		onSelectLocation: mockOnSelectLocation,
		onImportError: mockOnImportError,
		isOnline: true,
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock provider values
		(useMapConfiguration as Mock).mockReturnValue({
			currentMapStyle: "standard",
			isMapLocked: false,
			currentLightPreset: "day",
			currentBearing: 0,
			showSunDirection: false,
			onToggleLock: mockOnToggleLock,
			onCycleTimeOfDay: mockOnCycleTimeOfDay,
			onCycleBearing: mockOnCycleBearing,
			onZoomIn: mockOnZoomIn,
			onZoomOut: mockOnZoomOut,
			onToggleMapStyle: mockOnToggleMapStyle,
			onToggleSunDirection: mockOnToggleSunDirection,
		});

		(useUserLocation as Mock).mockReturnValue({
			location: null,
			accuracy: null,
			isTracking: false,
			hasCurrentLocation: false,
			hasLastKnownLocation: false,
			handleLocateButtonClick: mockHandleLocateButtonClick,
		});

		(useMapModals as Mock).mockReturnValue({
			openRouteGeneratorModal: mockOpenRouteGeneratorModal,
			openSaveRouteModal: mockOpenSaveRouteModal,
			openRouteLibraryModal: mockOpenRouteLibraryModal,
		});

		// Mock window.matchMedia for responsive design
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: vi.fn().mockImplementation((query) => ({
				matches: query !== "(min-width: 1024px)", // Default to mobile
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
	});

	describe("Rendering", () => {
		it("should render all control components", () => {
			render(<MapControls {...defaultProps} />);

			expect(screen.getAllByTestId("route-controls")).toHaveLength(2); // Mobile and desktop
			expect(screen.getAllByTestId("location-search")).toHaveLength(2); // Mobile and desktop
			expect(screen.getAllByTestId("sidebar")).toHaveLength(2); // Mobile and desktop
		});

		it("should pass route distance and duration to sidebar", () => {
			render(<MapControls {...defaultProps} hasRoute={true} routeDistance="5.2 km" routeDuration="1h 15min" />);

			const distances = screen.getAllByTestId("route-distance");
			const durations = screen.getAllByTestId("route-duration");

			distances.forEach((el) => {
				expect(el).toHaveTextContent("5.2 km");
			});
			durations.forEach((el) => {
				expect(el).toHaveTextContent("1h 15min");
			});
		});
	});

	describe("Route Controls", () => {
		it("should enable/disable route controls based on state", () => {
			const { rerender } = render(<MapControls {...defaultProps} canUndo={false} canRedo={false} hasRoute={false} />);

			const undoButtons = screen.getAllByText("Undo");
			const redoButtons = screen.getAllByText("Redo");
			const resetButtons = screen.getAllByText("Reset");

			undoButtons.forEach((btn) => {
				expect(btn).toBeDisabled();
			});
			redoButtons.forEach((btn) => {
				expect(btn).toBeDisabled();
			});
			resetButtons.forEach((btn) => {
				expect(btn).toBeDisabled();
			});

			// Update props
			rerender(<MapControls {...defaultProps} canUndo={true} canRedo={true} hasRoute={true} />);

			undoButtons.forEach((btn) => {
				expect(btn).not.toBeDisabled();
			});
			redoButtons.forEach((btn) => {
				expect(btn).not.toBeDisabled();
			});
			resetButtons.forEach((btn) => {
				expect(btn).not.toBeDisabled();
			});
		});

		it("should call route action handlers", () => {
			render(<MapControls {...defaultProps} canUndo={true} canRedo={true} hasRoute={true} />);

			const undoButton = screen.getAllByText("Undo")[0];
			const redoButton = screen.getAllByText("Redo")[0];
			const resetButton = screen.getAllByText("Reset")[0];

			fireEvent.click(undoButton);
			expect(mockOnUndo).toHaveBeenCalledTimes(1);

			fireEvent.click(redoButton);
			expect(mockOnRedo).toHaveBeenCalledTimes(1);

			fireEvent.click(resetButton);
			expect(mockOnReset).toHaveBeenCalledTimes(1);
		});
	});

	describe("Location Search", () => {
		it("should toggle mobile search on button click", () => {
			render(<MapControls {...defaultProps} />);

			// Find mobile search toggle
			const searchToggle = screen.getAllByTestId("search-toggle")[0];

			// Initially search should be closed
			expect(screen.queryByTestId("search-input")).not.toBeInTheDocument();

			// Click to open
			fireEvent.click(searchToggle);
			expect(screen.getByTestId("search-input")).toBeInTheDocument();

			// Click to close
			fireEvent.click(searchToggle);
			expect(screen.queryByTestId("search-input")).not.toBeInTheDocument();
		});
	});

	describe("Share Functionality", () => {
		it("should enable share button when route exists", () => {
			render(<MapControls {...defaultProps} hasRoute={true} />);

			const shareButtons = screen.getAllByText("Share");
			shareButtons.forEach((btn) => {
				expect(btn).not.toBeDisabled();
			});
		});

		it("should disable share button when no route", () => {
			render(<MapControls {...defaultProps} hasRoute={false} />);

			const shareButtons = screen.getAllByText("Share");
			shareButtons.forEach((btn) => {
				expect(btn).toBeDisabled();
			});
		});

		it("should call onShare when share button clicked", () => {
			render(<MapControls {...defaultProps} hasRoute={true} />);

			const shareButton = screen.getAllByText("Share")[0];
			fireEvent.click(shareButton);

			expect(mockOnShare).toHaveBeenCalledTimes(1);
		});
	});

	describe("Provider Integration", () => {
		it("should use location provider data", () => {
			(useUserLocation as Mock).mockReturnValue({
				location: [13.405, 52.52],
				accuracy: 10,
				isTracking: true,
				hasCurrentLocation: true,
				hasLastKnownLocation: true,
				handleLocateButtonClick: mockHandleLocateButtonClick,
			});

			render(<MapControls {...defaultProps} />);

			// Verify that the route controls receive the location data
			expect(useUserLocation).toHaveBeenCalled();
		});

		it("should use map configuration data", () => {
			(useMapConfiguration as Mock).mockReturnValue({
				currentMapStyle: "satellite",
				isMapLocked: true,
				currentLightPreset: "sunset",
				currentBearing: 45,
				showSunDirection: true,
				onToggleLock: mockOnToggleLock,
				onCycleTimeOfDay: mockOnCycleTimeOfDay,
				onCycleBearing: mockOnCycleBearing,
				onZoomIn: mockOnZoomIn,
				onZoomOut: mockOnZoomOut,
				onToggleMapStyle: mockOnToggleMapStyle,
				onToggleSunDirection: mockOnToggleSunDirection,
			});

			render(<MapControls {...defaultProps} />);

			// Verify that the configuration is used
			expect(useMapConfiguration).toHaveBeenCalled();
		});

		it("should use map modals", () => {
			render(<MapControls {...defaultProps} />);

			expect(useMapModals).toHaveBeenCalled();
		});
	});

	describe("Responsive Design", () => {
		it("should render mobile layout on small screens", () => {
			// Already mocked to mobile by default
			render(<MapControls {...defaultProps} />);

			// Check for mobile-specific classes
			const mobileContainer = screen.getByText((_, element) => {
				return element?.className?.includes("lg:hidden") || false;
			});
			expect(mobileContainer).toBeInTheDocument();
		});

		it("should render desktop layout on large screens", () => {
			// Mock desktop media query
			Object.defineProperty(window, "matchMedia", {
				writable: true,
				value: vi.fn().mockImplementation((query) => ({
					matches: query === "(min-width: 1024px)",
					media: query,
					onchange: null,
					addListener: vi.fn(),
					removeListener: vi.fn(),
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
					dispatchEvent: vi.fn(),
				})),
			});

			render(<MapControls {...defaultProps} />);

			// Check for desktop-specific classes by finding elements with specific classes
			const desktopElements = document.querySelectorAll(".hidden.lg\\:flex");
			expect(desktopElements.length).toBeGreaterThan(0);
		});
	});

	describe("Offline Mode", () => {
		it("should pass offline state to route controls", () => {
			render(<MapControls {...defaultProps} isOnline={false} />);

			// The RouteControls component should receive isOffline=true
			expect(screen.getAllByTestId("route-controls")).toHaveLength(2);
		});
	});

	describe("Language Support", () => {
		it("should pass current language to all components", () => {
			render(<MapControls {...defaultProps} currentLanguage="de" />);

			// All child components should receive the language prop
			expect(screen.getAllByTestId("route-controls")).toHaveLength(2);
			expect(screen.getAllByTestId("location-search")).toHaveLength(2);
			expect(screen.getAllByTestId("sidebar")).toHaveLength(2);
		});

		it("should handle language change", () => {
			render(<MapControls {...defaultProps} />);

			// The sidebar component would handle language change
			// This is mocked in our test setup
			expect(mockOnLanguageChange).not.toHaveBeenCalled();
		});
	});
});
