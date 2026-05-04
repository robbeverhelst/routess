import React from "react";

interface MapNotificationsProps {
	shareNotification: string;
	showRouteInfoError: boolean;
	routeInfoErrorMessage: string;
	waypointError: string | null;
}

const MapNotificationsComponent: React.FC<MapNotificationsProps> = ({
	shareNotification,
	showRouteInfoError,
	routeInfoErrorMessage,
	waypointError,
}) => {
	return (
		<>
			{/* Waypoint error notification - BOTTOM LEFT */}
			{waypointError && (
				<div className="absolute bottom-8 left-8 z-10 max-w-xs bg-orange-50 p-3 rounded-md border border-orange-200 text-sm text-orange-800 shadow-md">
					<div className="flex items-center gap-2">
						<span className="text-xl">⚠️</span>
						<span>{waypointError}</span>
					</div>
				</div>
			)}

			{/* Route Info Error */}
			{showRouteInfoError && (
				<div
					style={{
						position: "fixed",
						bottom: "20px",
						left: "50%",
						transform: "translateX(-50%)",
						background: "#2c3e50",
						color: "white",
						padding: "10px 20px",
						borderRadius: "5px",
						zIndex: 1000,
						boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
					}}
				>
					{routeInfoErrorMessage}
				</div>
			)}

			{/* Share Notification */}
			{shareNotification && (
				<div
					style={{
						position: "fixed",
						bottom: "20px",
						left: "50%",
						transform: "translateX(-50%)",
						background: "#2c3e50",
						color: "white",
						padding: "10px 20px",
						borderRadius: "5px",
						zIndex: 1000,
						boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
					}}
				>
					{shareNotification}
				</div>
			)}
		</>
	);
};

// Memoize MapNotifications to prevent unnecessary re-renders when props haven't changed
export const MapNotifications = React.memo(MapNotificationsComponent);
