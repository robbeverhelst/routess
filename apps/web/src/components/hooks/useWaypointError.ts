import { useCallback, useEffect, useRef, useState } from "react";

const WAYPOINT_ERROR_TIMEOUT = 5000; // 5 seconds

export const useWaypointError = () => {
	const [waypointError, setWaypointError] = useState<string | null>(null);
	const waypointErrorTimeout = useRef<number | null>(null);

	// Clear timeout on error change
	useEffect(() => {
		if (waypointError && !waypointErrorTimeout.current) {
			waypointErrorTimeout.current = window.setTimeout(() => {
				setWaypointError(null);
				waypointErrorTimeout.current = null;
			}, WAYPOINT_ERROR_TIMEOUT);
		}

		return () => {
			if (waypointErrorTimeout.current) {
				clearTimeout(waypointErrorTimeout.current);
				waypointErrorTimeout.current = null;
			}
		};
	}, [waypointError]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (waypointErrorTimeout.current) {
				clearTimeout(waypointErrorTimeout.current);
				waypointErrorTimeout.current = null;
			}
		};
	}, []);

	// Waypoint error handler
	const handleWaypointError = useCallback((message: string | null) => {
		setWaypointError(message);

		if (waypointErrorTimeout.current) {
			clearTimeout(waypointErrorTimeout.current);
			waypointErrorTimeout.current = null;
		}

		if (message) {
			waypointErrorTimeout.current = window.setTimeout(() => {
				setWaypointError(null);
				waypointErrorTimeout.current = null;
			}, WAYPOINT_ERROR_TIMEOUT);
		}
	}, []);

	return {
		waypointError,
		handleWaypointError,
	};
};
