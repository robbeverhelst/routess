import { useEffect, useRef, useState } from "react";
import { Logger } from "@/lib/logger";

export interface UserLocationState {
	location: [number, number] | null;
	error: string | null;
	isLoading: boolean;
}

export function useUserLocation() {
	const [location, setLocation] = useState<[number, number] | null>(() => {
		const lastKnown = localStorage.getItem("lastKnownLocation");
		if (lastKnown) {
			try {
				const parsed = JSON.parse(lastKnown);
				if (
					Array.isArray(parsed) &&
					parsed.length === 2 &&
					typeof parsed[0] === "number" &&
					typeof parsed[1] === "number"
				) {
					return parsed as [number, number];
				}
			} catch (e) {
				Logger.error("Failed to parse lastKnownLocation from localStorage", e);
			}
		}
		return null;
	});
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const hasInitiallyZoomedRef = useRef<boolean>(false); // To manage initial zoom behavior

	useEffect(() => {
		let isMounted = true;
		setIsLoading(true);

		if (!("geolocation" in navigator)) {
			if (isMounted) {
				setError("Geolocation is not supported by your browser.");
				setIsLoading(false);
			}
			return;
		}

		const successCallback = (position: GeolocationPosition) => {
			if (!isMounted) return;

			const newLocation: [number, number] = [position.coords.longitude, position.coords.latitude];
			setLocation(newLocation);
			localStorage.setItem("lastKnownLocation", JSON.stringify(newLocation));
			setError(null);
			setIsLoading(false);
		};

		const errorCallback = (err: GeolocationPositionError) => {
			if (!isMounted) return;

			let errorMessage = "Unable to access your location.";
			switch (err.code) {
				case err.PERMISSION_DENIED:
					errorMessage = "Location access denied. Please enable location services in your browser.";
					break;
				case err.POSITION_UNAVAILABLE:
					errorMessage = "Your location could not be determined. Try again later.";
					break;
				case err.TIMEOUT:
					errorMessage = "Location request timed out.";
					// Attempt with lower accuracy as a fallback
					navigator.geolocation.getCurrentPosition(
						successCallback,
						(fallbackError) => {
							if (!isMounted) return;
							let fallbackErrorMessage = "Your location could not be determined even with lower accuracy.";
							switch (fallbackError.code) {
								case fallbackError.PERMISSION_DENIED:
									fallbackErrorMessage = "Location access denied. Please enable location services in your browser.";
									break;
								case fallbackError.POSITION_UNAVAILABLE:
									fallbackErrorMessage = "Your location could not be determined. Try again later.";
									break;
								case fallbackError.TIMEOUT:
									fallbackErrorMessage = "Location request timed out even with lower accuracy.";
									break;
							}
							setError(fallbackErrorMessage);
							setIsLoading(false);
						},
						{ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
					);
					return; // Return here as the fallback will set loading and error
			}
			setError(errorMessage);
			setIsLoading(false);
		};

		// Get location once
		navigator.geolocation.getCurrentPosition(successCallback, errorCallback, {
			enableHighAccuracy: true,
			timeout: 10000,
			maximumAge: 0,
		});

		return () => {
			isMounted = false;
		};
	}, []); // Empty dependency array means this runs once on mount

	return { location, error, isLoading, hasInitiallyZoomedRef };
}
