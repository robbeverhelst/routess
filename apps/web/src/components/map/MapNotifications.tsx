import React from "react";

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

export const MapNotifications: React.FC<MapNotificationsProps> = ({
  hasRoute,
  routeDistance,
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

      {/* Custom Distance Box - Consistently Bottom Right */}
      {hasRoute && routeDistance && (
        <div className="absolute bottom-8 right-8 z-10 bg-white/25 dark:bg-neutral-800/30 text-neutral-700 dark:text-neutral-200 p-3 rounded-lg shadow-lg backdrop-blur-md flex items-baseline gap-0.5 w-auto">
          <span className="text-4xl font-bold">{routeDistance.split(" ")[0]}</span>
          <span className="text-sm">{routeDistance.split(" ")[1]}</span>
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
