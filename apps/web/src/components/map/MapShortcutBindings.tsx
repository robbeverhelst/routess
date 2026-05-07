import { useEffect } from "react";
import { useRouteImportExport } from "@/components/hooks/useRouteImportExport";
import { useMapInteraction } from "@/components/providers/MapInteractionProvider";
import { useUserLocation } from "@/components/providers/UserLocationProvider";
import { useModalsStore } from "@/stores/modalsStore";

interface MapShortcutBindingsProps {
	onImportError: (message: string) => void;
}

export const MapShortcutBindings: React.FC<MapShortcutBindingsProps> = ({ onImportError }) => {
	const { handlePWAShortcuts } = useMapInteraction();
	const { handleLocateButtonClick } = useUserLocation();
	const { handleImportGPX } = useRouteImportExport({ onRouteIoError: onImportError });

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
