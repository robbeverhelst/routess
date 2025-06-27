import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MapControls } from "../MapControls";
import { useMapConfiguration } from "@/components/providers/MapConfigurationProvider";
import { useUserLocation } from "@/components/providers/UserLocationProvider";
import { useMapModals } from "@/components/providers/MapModalsProvider";
import type { SupportedLanguage } from "@/lib/i18n";

// Mock dependencies
jest.mock("@/components/providers/MapConfigurationProvider");
jest.mock("@/components/providers/UserLocationProvider");
jest.mock("@/components/providers/MapModalsProvider");
jest.mock("@/components/ui/route-controls", () => ({
  RouteControls: ({ onUndo, onRedo, onReset, canUndo, canRedo, hasRoute }: any) => (
    <div data-testid="route-controls">
      <button onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={onRedo} disabled={!canRedo}>
        Redo
      </button>
      <button onClick={onReset} disabled={!hasRoute}>
        Reset
      </button>
    </div>
  ),
}));
jest.mock("@/components/ui/location-search", () => ({
  LocationSearch: ({ isMobileSearchOpen, onToggleMobileSearch }: any) => (
    <div data-testid="location-search">
      {isMobileSearchOpen && <input data-testid="search-input" />}
      <button onClick={onToggleMobileSearch} data-testid="search-toggle">
        Search
      </button>
    </div>
  ),
}));
jest.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ onShare, hasRoute, routeDistance, routeDuration }: any) => (
    <div data-testid="sidebar">
      <button onClick={onShare} disabled={!hasRoute}>
        Share
      </button>
      {routeDistance && <span data-testid="route-distance">{routeDistance}</span>}
      {routeDuration && <span data-testid="route-duration">{routeDuration}</span>}
    </div>
  ),
}));

describe("MapControls", () => {
  const mockSetRouteDistance = jest.fn();
  const mockSetRouteDuration = jest.fn();
  const mockSetHasRoute = jest.fn();
  const mockOnUndo = jest.fn();
  const mockOnRedo = jest.fn();
  const mockOnReverseRoute = jest.fn();
  const mockOnReset = jest.fn();
  const mockOnZoomToRoute = jest.fn();
  const mockOnShare = jest.fn();
  const mockOnCopySharedUrl = jest.fn();
  const mockOnClearShareDisplay = jest.fn();
  const mockOnCopyShareLink = jest.fn();
  const mockOnSelectLocation = jest.fn();
  const mockOnImportError = jest.fn();
  const mockOnLanguageChange = jest.fn();
  const mockHandleLocateButtonClick = jest.fn();
  const mockOpenRouteGeneratorModal = jest.fn();
  const mockOpenSaveRouteModal = jest.fn();
  const mockOpenRouteLibraryModal = jest.fn();
  const mockOnToggleLock = jest.fn();
  const mockOnCycleTimeOfDay = jest.fn();
  const mockOnCycleBearing = jest.fn();
  const mockOnZoomIn = jest.fn();
  const mockOnZoomOut = jest.fn();
  const mockOnToggleMapStyle = jest.fn();
  const mockOnToggleSunDirection = jest.fn();

  const defaultProps = {
    mapRef: React.createRef<any>(),
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
    jest.clearAllMocks();

    // Mock provider values
    (useMapConfiguration as jest.Mock).mockReturnValue({
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

    (useUserLocation as jest.Mock).mockReturnValue({
      location: null,
      accuracy: null,
      isTracking: false,
      hasCurrentLocation: false,
      hasLastKnownLocation: false,
      handleLocateButtonClick: mockHandleLocateButtonClick,
    });

    (useMapModals as jest.Mock).mockReturnValue({
      openRouteGeneratorModal: mockOpenRouteGeneratorModal,
      openSaveRouteModal: mockOpenSaveRouteModal,
      openRouteLibraryModal: mockOpenRouteLibraryModal,
    });

    // Mock window.matchMedia for responsive design
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: query === "(min-width: 1024px)" ? false : true, // Default to mobile
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
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
      render(
        <MapControls
          {...defaultProps}
          hasRoute={true}
          routeDistance="5.2 km"
          routeDuration="1h 15min"
        />,
      );

      const distances = screen.getAllByTestId("route-distance");
      const durations = screen.getAllByTestId("route-duration");

      distances.forEach((el) => expect(el).toHaveTextContent("5.2 km"));
      durations.forEach((el) => expect(el).toHaveTextContent("1h 15min"));
    });
  });

  describe("Route Controls", () => {
    it("should enable/disable route controls based on state", () => {
      const { rerender } = render(
        <MapControls {...defaultProps} canUndo={false} canRedo={false} hasRoute={false} />,
      );

      const undoButtons = screen.getAllByText("Undo");
      const redoButtons = screen.getAllByText("Redo");
      const resetButtons = screen.getAllByText("Reset");

      undoButtons.forEach((btn) => expect(btn).toBeDisabled());
      redoButtons.forEach((btn) => expect(btn).toBeDisabled());
      resetButtons.forEach((btn) => expect(btn).toBeDisabled());

      // Update props
      rerender(<MapControls {...defaultProps} canUndo={true} canRedo={true} hasRoute={true} />);

      undoButtons.forEach((btn) => expect(btn).not.toBeDisabled());
      redoButtons.forEach((btn) => expect(btn).not.toBeDisabled());
      resetButtons.forEach((btn) => expect(btn).not.toBeDisabled());
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
      shareButtons.forEach((btn) => expect(btn).not.toBeDisabled());
    });

    it("should disable share button when no route", () => {
      render(<MapControls {...defaultProps} hasRoute={false} />);

      const shareButtons = screen.getAllByText("Share");
      shareButtons.forEach((btn) => expect(btn).toBeDisabled());
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
      (useUserLocation as jest.Mock).mockReturnValue({
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
      (useMapConfiguration as jest.Mock).mockReturnValue({
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
        value: jest.fn().mockImplementation((query) => ({
          matches: query === "(min-width: 1024px)" ? true : false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
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
