import type { Map as MapboxMap } from "mapbox-gl";
import { useEffect } from "react";
import { useRouteImportExport } from "@/components/hooks/useRouteImportExport";
import { useMapInteraction } from "@/components/providers/MapInteractionProvider";
import { useUserLocation } from "@/components/providers/UserLocationProvider";
import { useModalsStore } from "@/stores/modalsStore";

interface MapShortcutBindingsProps {
	mapRef: React.RefObject<MapboxMap | null>;
	mapboxToken: string;
	setRouteDistance: React.Dispatch<React.SetStateAction<string>>;
	setRouteDuration: React.Dispatch<React.SetStateAction<string>>;
	setHasRoute: React.Dispatch<React.SetStateAction<boolean>>;
	onImportError: (message: string) => void;
}

export const MapShortcutBindings: React.FC<MapShortcutBindingsProps> = ({
	mapRef,
	mapboxToken,
	setRouteDistance,
	setRouteDuration,
	setHasRoute,
	onImportError,
}) => {
	const { handlePWAShortcuts } = useMapInteraction();
	const { handleLocateButtonClick } = useUserLocation();
	const { handleImportGPX } = useRouteImportExport({
		map: mapRef.current,
		accessToken: mapboxToken,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
		onRouteIoError: onImportError,
	});

	useEffect(() => {
		const cleanup = handlePWAShortcuts(
			() => useModalsStore.getState().openModal("routing"),
			() => {
				void handleLocateButtonClick();
			},
			handleImportGPX,
		);

		return cleanup;
	}, [handleImportGPX, handleLocateButtonClick, handlePWAShortcuts]);

	return null;
};
