import React, { useMemo } from "react";

interface MapNotificationsProps {
	// Route info state
	hasRoute: boolean;
	routeDistance?: string;
	shareNotification: string;
	showRouteInfoError: boolean;
	routeInfoErrorMessage: string;

	// Waypoint error state
	waypointError: string | null;
}

const MapNotificationsComponent: React.FC<MapNotificationsProps> = ({
	hasRoute,
	routeDistance,
	shareNotification,
	showRouteInfoError,
	routeInfoErrorMessage,
	waypointError,
}) => {
	// Memoize the split operation for routeDistance to avoid repeated string operations
	const routeDistanceParts = useMemo(() => {
		if (!routeDistance) return { value: "", unit: "" };
		const parts = routeDistance.split(" ");
		return { value: parts[0] || "", unit: parts[1] || "" };
	}, [routeDistance]);

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

			{/* Custom Distance Box - Consistently Bottom Right */}
			{hasRoute && routeDistance && (
				<div className="absolute bottom-8 right-8 z-10 bg-white/25 dark:bg-neutral-800/30 text-neutral-700 dark:text-neutral-200 p-3 rounded-lg shadow-lg backdrop-blur-md flex items-baseline gap-0.5 w-auto">
					<span className="text-4xl font-bold">{routeDistanceParts.value}</span>
					<span className="text-sm">{routeDistanceParts.unit}</span>
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
