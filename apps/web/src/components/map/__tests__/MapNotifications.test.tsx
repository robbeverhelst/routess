import { render, screen } from "@testing-library/react";
import { MapNotifications } from "../MapNotifications";

describe("MapNotifications", () => {
	const defaultProps = {
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
					waypointError="Waypoint error"
					showRouteInfoError={true}
					routeInfoErrorMessage="Route error"
					shareNotification="Share notification"
				/>,
			);

			expect(screen.getByText("Waypoint error")).toBeInTheDocument();
			expect(screen.getByText("Route error")).toBeInTheDocument();
			expect(screen.getByText("Share notification")).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle all notifications being empty/false", () => {
			render(<MapNotifications {...defaultProps} />);

			const container = document.body.firstChild;
			expect(container).toBeInTheDocument();
			expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		});
	});
});
