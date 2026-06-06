import { useCallback, useEffect, useRef, useState } from "react";
import { useToastStore } from "@/stores/toastStore";

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

	const lastToast = useRef<{ message: string; at: number } | null>(null);

	// Waypoint error handler. Errors also surface as a toast: nothing else
	// renders this state, and a silently rolled-back waypoint is invisible.
	const handleWaypointError = useCallback((message: string | null) => {
		setWaypointError(message);
		if (message) {
			const now = Date.now();
			const last = lastToast.current;
			if (!last || last.message !== message || now - last.at > 4000) {
				lastToast.current = { message, at: now };
				useToastStore.getState().push({ kind: "warn", title: message });
			}
		}

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
