import type { Map as MapboxMap } from "mapbox-gl";
import { useCallback } from "react";
import { exportCurrentRouteToGPXFile, importRouteFromGPXString } from "@/features/routing/services/RouteIOService";
import { Logger } from "@/lib/logger";

interface UseRouteImportExportProps {
	map: MapboxMap | null;
	accessToken: string;
	setRouteDistance: React.Dispatch<React.SetStateAction<string>>;
	setRouteDuration: React.Dispatch<React.SetStateAction<string>>;
	setHasRoute: React.Dispatch<React.SetStateAction<boolean>>;
	onRouteIoError: (message: string) => void;
}

export const useRouteImportExport = ({
	map,
	accessToken,
	setRouteDistance,
	setRouteDuration,
	setHasRoute,
	onRouteIoError,
}: UseRouteImportExportProps) => {
	const handleExportGPX = useCallback(() => {
		const result = exportCurrentRouteToGPXFile();

		if (!result.success && result.message) {
			onRouteIoError(result.message);
		}
	}, [onRouteIoError]);

	const handleImportGPX = useCallback(() => {
		if (!map || !accessToken) {
			onRouteIoError("Map or access token is not available for import.");
			return;
		}

		const fileInput = document.createElement("input");
		fileInput.type = "file";
		fileInput.accept = ".gpx";
		fileInput.style.display = "none";

		fileInput.onchange = (event: Event) => {
			const target = event.target as HTMLInputElement;
			const file = target.files?.[0];

			if (!file) {
				if (fileInput.parentElement) {
					document.body.removeChild(fileInput);
				}
				return;
			}

			const reader = new FileReader();
			reader.onload = async (loadEvent) => {
				try {
					const gpxString = loadEvent.target?.result;

					if (typeof gpxString !== "string" || gpxString.length === 0) {
						onRouteIoError("Failed to read GPX file.");
						return;
					}

					const result = await importRouteFromGPXString({
						map,
						accessToken,
						gpxString,
						setRouteDistance,
						setRouteDuration,
						setHasRoute,
					});

					if (!result.success && result.message) {
						onRouteIoError(result.message);
					}
				} catch (error) {
					Logger.error("[useRouteImportExport] Error importing GPX file:", error);
					onRouteIoError(error instanceof Error ? error.message : "An unknown error occurred during GPX import.");
				} finally {
					if (fileInput.parentElement) {
						document.body.removeChild(fileInput);
					}
				}
			};

			reader.onerror = () => {
				onRouteIoError("Error reading GPX file.");
				if (fileInput.parentElement) {
					document.body.removeChild(fileInput);
				}
			};

			reader.readAsText(file);
		};

		document.body.appendChild(fileInput);
		fileInput.click();
	}, [accessToken, map, onRouteIoError, setHasRoute, setRouteDistance, setRouteDuration]);

	return {
		handleExportGPX,
		handleImportGPX,
	};
};
