import { render, screen } from "@testing-library/react";
import { MapNotifications } from "../MapNotifications";

describe("MapNotifications", () => {
	const defaultProps = {
		hasRoute: false,
		routeDistance: "",
		shareNotification: "",
		showRouteInfoError: false,
		routeInfoErrorMessage: "",
		waypointError: null,
	};

	describe("Waypoint Error Notification", () => {
		it("should not show waypoint error when error is null", () => {
			render(<MapNotifications {...defaultProps} />);

			expect(screen.queryByText("⚠️")).not.toBeInTheDocument();
		});

		it("should show waypoint error when error exists", () => {
			render(<MapNotifications {...defaultProps} waypointError="Waypoint too close to previous point" />);

			expect(screen.getByText("⚠️")).toBeInTheDocument();
			expect(screen.getByText("Waypoint too close to previous point")).toBeInTheDocument();
		});

		it("should apply correct styling to waypoint error", () => {
			render(<MapNotifications {...defaultProps} waypointError="Test error" />);

			const errorContainer = screen.getByText("Test error").closest("div")?.parentElement;
			expect(errorContainer).toHaveClass("absolute", "bottom-8", "left-8", "z-10");
			expect(errorContainer).toHaveClass("bg-orange-50", "border-orange-200", "text-orange-800");
		});
	});

	describe("Route Distance Display", () => {
		it("should not show distance when no route", () => {
			render(<MapNotifications {...defaultProps} />);

			expect(screen.queryByText(/km|mi/)).not.toBeInTheDocument();
		});

		it("should not show distance when route exists but no distance", () => {
			render(<MapNotifications {...defaultProps} hasRoute={true} />);

			expect(screen.queryByText(/km|mi/)).not.toBeInTheDocument();
		});

		it("should show distance when route and distance exist", () => {
			render(<MapNotifications {...defaultProps} hasRoute={true} routeDistance="5.2 km" />);

			expect(screen.getByText("5.2")).toBeInTheDocument();
			expect(screen.getByText("km")).toBeInTheDocument();
		});

		it("should correctly split distance value and unit", () => {
			render(<MapNotifications {...defaultProps} hasRoute={true} routeDistance="10.5 miles" />);

			const value = screen.getByText("10.5");
			const unit = screen.getByText("miles");

			expect(value).toHaveClass("text-4xl", "font-bold");
			expect(unit).toHaveClass("text-sm");
		});

		it("should handle distance with no unit", () => {
			render(<MapNotifications {...defaultProps} hasRoute={true} routeDistance="42" />);

			expect(screen.getByText("42")).toBeInTheDocument();
			// Unit span should exist but be empty
			const spans = screen.getByText("42").parentElement?.querySelectorAll("span");
			expect(spans).toHaveLength(2);
			expect(spans?.[1].textContent).toBe("");
		});

		it("should position distance box at bottom right", () => {
			render(<MapNotifications {...defaultProps} hasRoute={true} routeDistance="5.2 km" />);

			const distanceBox = screen.getByText("5.2").parentElement;
			expect(distanceBox).toHaveClass("absolute", "bottom-8", "right-8", "z-10");
		});
	});

	describe("Route Info Error", () => {
		it("should not show route info error when showRouteInfoError is false", () => {
			render(<MapNotifications {...defaultProps} routeInfoErrorMessage="Route calculation failed" />);

			expect(screen.queryByText("Route calculation failed")).not.toBeInTheDocument();
		});

		it("should show route info error when enabled", () => {
			render(
				<MapNotifications
					{...defaultProps}
					showRouteInfoError={true}
					routeInfoErrorMessage="Unable to calculate route"
				/>,
			);

			expect(screen.getByText("Unable to calculate route")).toBeInTheDocument();
		});

		it("should position route info error at bottom center", () => {
			render(<MapNotifications {...defaultProps} showRouteInfoError={true} routeInfoErrorMessage="Error message" />);

			const errorDiv = screen.getByText("Error message");
			expect(errorDiv).toHaveStyle({
				position: "fixed",
				bottom: "20px",
				left: "50%",
				transform: "translateX(-50%)",
			});
		});
	});

	describe("Share Notification", () => {
		it("should not show share notification when empty", () => {
			render(<MapNotifications {...defaultProps} />);

			expect(screen.queryByText(/shared|copied/i)).not.toBeInTheDocument();
		});

		it("should show share notification when provided", () => {
			render(<MapNotifications {...defaultProps} shareNotification="Link copied to clipboard!" />);

			expect(screen.getByText("Link copied to clipboard!")).toBeInTheDocument();
		});

		it("should position share notification at bottom center", () => {
			render(<MapNotifications {...defaultProps} shareNotification="Shared successfully" />);

			const notification = screen.getByText("Shared successfully");
			expect(notification).toHaveStyle({
				position: "fixed",
				bottom: "20px",
				left: "50%",
				transform: "translateX(-50%)",
			});
		});

		it("should style share notification consistently", () => {
			render(<MapNotifications {...defaultProps} shareNotification="Test notification" />);

			const notification = screen.getByText("Test notification");
			expect(notification).toHaveStyle({
				background: "rgb(44, 62, 80)",
				color: "rgb(255, 255, 255)",
				padding: "10px 20px",
				borderRadius: "5px",
				zIndex: "1000",
			});
		});
	});

	describe("Multiple Notifications", () => {
		it("should show multiple notifications simultaneously", () => {
			render(
				<MapNotifications
					{...defaultProps}
					hasRoute={true}
					routeDistance="3.5 km"
					waypointError="Waypoint error"
					showRouteInfoError={true}
					routeInfoErrorMessage="Route error"
					shareNotification="Share notification"
				/>,
			);

			// All notifications should be visible
			expect(screen.getByText("3.5")).toBeInTheDocument();
			expect(screen.getByText("Waypoint error")).toBeInTheDocument();
			expect(screen.getByText("Route error")).toBeInTheDocument();
			expect(screen.getByText("Share notification")).toBeInTheDocument();
		});
	});

	describe("Memoization", () => {
		it("should memoize route distance parts", () => {
			const { rerender } = render(<MapNotifications {...defaultProps} hasRoute={true} routeDistance="5.2 km" />);

			expect(screen.getByText("5.2")).toBeInTheDocument();
			expect(screen.getByText("km")).toBeInTheDocument();

			// Re-render with same props
			rerender(<MapNotifications {...defaultProps} hasRoute={true} routeDistance="5.2 km" />);

			// Should still render the same
			expect(screen.getByText("5.2")).toBeInTheDocument();
			expect(screen.getByText("km")).toBeInTheDocument();
		});

		it("should update when route distance changes", () => {
			const { rerender } = render(<MapNotifications {...defaultProps} hasRoute={true} routeDistance="5.2 km" />);

			expect(screen.getByText("5.2")).toBeInTheDocument();

			// Update distance
			rerender(<MapNotifications {...defaultProps} hasRoute={true} routeDistance="10.7 miles" />);

			expect(screen.queryByText("5.2")).not.toBeInTheDocument();
			expect(screen.getByText("10.7")).toBeInTheDocument();
			expect(screen.getByText("miles")).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty route distance string", () => {
			render(<MapNotifications {...defaultProps} hasRoute={true} routeDistance="" />);

			// Should not render distance box
			expect(screen.queryByText("km")).not.toBeInTheDocument();
		});

		it("should handle malformed route distance", () => {
			render(<MapNotifications {...defaultProps} hasRoute={true} routeDistance="invalid-format" />);

			expect(screen.getByText("invalid-format")).toBeInTheDocument();
			// Unit span should be empty
			const spans = screen.getByText("invalid-format").parentElement?.querySelectorAll("span");
			expect(spans?.[1].textContent).toBe("");
		});

		it("should handle all notifications being empty/false", () => {
			render(<MapNotifications {...defaultProps} />);

			// Component should render but show nothing
			const container = document.body.firstChild;
			expect(container).toBeInTheDocument();
			expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		});
	});
});
