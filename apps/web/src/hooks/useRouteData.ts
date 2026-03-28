import { useCallback } from "react";
import { Logger } from "@/lib/logger";
import { serializeAndCompress } from "@/lib/shareUtils";
import {
	useClearShareState,
	useDirectFlags,
	useDisplayedShareUrl,
	useHasRoute,
	useIsMapLocked,
	useRouteDistance,
	useRouteDuration,
	useRouteInfoErrorMessage,
	useSetDisplayedShareUrl,
	useSetHasRoute,
	useSetRouteDistance,
	useSetRouteDuration,
	useSetRouteInfoErrorMessage,
	useSetShareNotification,
	useSetShowRouteInfoError,
	useShareNotification,
	useShowRouteInfoError,
	useWaypoints,
} from "@/stores/routingStore";

export interface RouteDataState {
	routeDistance: string;
	routeDuration: string;
	hasRoute: boolean;
	shareNotification: string;
	displayedShareUrl: string | null;
	showRouteInfoError: boolean;
	routeInfoErrorMessage: string;
}

export interface RouteDataHandlers {
	setRouteDistance: React.Dispatch<React.SetStateAction<string>>;
	setRouteDuration: React.Dispatch<React.SetStateAction<string>>;
	setHasRoute: React.Dispatch<React.SetStateAction<boolean>>;
	handleShareRoute: () => void;
	handleCopySharedUrl: (urlToCopy: string) => void;
	handleRouteInfoError: (message: string) => void;
	clearShareState: () => void; // For resetting share UI on route reset etc.
	setShareNotification: React.Dispatch<React.SetStateAction<string>>;
}

export function useRouteData(): RouteDataState & RouteDataHandlers {
	const routeDistance = useRouteDistance();
	const routeDuration = useRouteDuration();
	const hasRoute = useHasRoute();
	const shareNotification = useShareNotification();
	const displayedShareUrl = useDisplayedShareUrl();
	const showRouteInfoError = useShowRouteInfoError();
	const routeInfoErrorMessage = useRouteInfoErrorMessage();
	const waypoints = useWaypoints();
	const directFlags = useDirectFlags();
	const isMapLocked = useIsMapLocked();

	const zustandSetRouteDistance = useSetRouteDistance();
	const zustandSetRouteDuration = useSetRouteDuration();
	const zustandSetHasRoute = useSetHasRoute();
	const zustandSetShareNotification = useSetShareNotification();

	const setRouteDistance = useCallback(
		(value: React.SetStateAction<string>) => {
			const newValue = typeof value === "function" ? value(routeDistance) : value;
			zustandSetRouteDistance(newValue);
		},
		[zustandSetRouteDistance, routeDistance],
	);

	const setRouteDuration = useCallback(
		(value: React.SetStateAction<string>) => {
			const newValue = typeof value === "function" ? value(routeDuration) : value;
			zustandSetRouteDuration(newValue);
		},
		[zustandSetRouteDuration, routeDuration],
	);

	const setHasRoute = useCallback(
		(value: React.SetStateAction<boolean>) => {
			const newValue = typeof value === "function" ? value(hasRoute) : value;
			zustandSetHasRoute(newValue);
		},
		[zustandSetHasRoute, hasRoute],
	);

	const setShareNotification = useCallback(
		(value: React.SetStateAction<string>) => {
			const newValue = typeof value === "function" ? value(shareNotification) : value;
			zustandSetShareNotification(newValue);
		},
		[zustandSetShareNotification, shareNotification],
	);
	const setDisplayedShareUrl = useSetDisplayedShareUrl();
	const setShowRouteInfoError = useSetShowRouteInfoError();
	const setRouteInfoErrorMessage = useSetRouteInfoErrorMessage();
	const clearShareState = useClearShareState();

	const handleRouteInfoError = useCallback(
		(message: string) => {
			setShowRouteInfoError(true);
			setRouteInfoErrorMessage(message);
			setTimeout(() => {
				setShowRouteInfoError(false);
				setRouteInfoErrorMessage("");
			}, 5000);
		},
		[setShowRouteInfoError, setRouteInfoErrorMessage],
	);

	const handleShareRoute = useCallback(() => {
		if (waypoints.length === 0) {
			handleRouteInfoError("Cannot share an empty route.");
			return;
		}

		const encodedData = serializeAndCompress(waypoints, directFlags, isMapLocked);
		if (encodedData) {
			const shareUrl = `${window.location.origin}${window.location.pathname}?route=${encodedData}`;
			navigator.clipboard
				.writeText(shareUrl)
				.then(() => {
					setShareNotification("Link copied to clipboard!");
					setTimeout(() => setShareNotification(""), 2000);
				})
				.catch((err) => {
					Logger.error("[useRouteData] Failed to copy share link:", err);
					handleRouteInfoError("Failed to copy link. Please try again.");
					setDisplayedShareUrl(null); // Clear URL display on error
				});
			setDisplayedShareUrl(shareUrl);
		} else {
			handleRouteInfoError("Could not generate shareable link.");
			setDisplayedShareUrl(null);
		}
	}, [waypoints, directFlags, handleRouteInfoError, isMapLocked, setShareNotification, setDisplayedShareUrl]);

	const handleCopySharedUrl = useCallback(
		(urlToCopy: string) => {
			navigator.clipboard
				.writeText(urlToCopy)
				.then(() => {
					setShareNotification("Share link copied!");
					setTimeout(() => setShareNotification(""), 2000);
				})
				.catch((err) => {
					Logger.error("[useRouteData] Failed to copy share link from sidebar button:", err);
					handleRouteInfoError("Failed to copy. Please try again.");
				});
		},
		[handleRouteInfoError, setShareNotification],
	);

	const handleClearShareState = useCallback(() => {
		clearShareState();
	}, [clearShareState]);

	return {
		routeDistance,
		routeDuration,
		hasRoute,
		shareNotification,
		displayedShareUrl,
		showRouteInfoError,
		routeInfoErrorMessage,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
		handleShareRoute,
		handleCopySharedUrl,
		handleRouteInfoError,
		clearShareState: handleClearShareState,
		setShareNotification,
	};
}
