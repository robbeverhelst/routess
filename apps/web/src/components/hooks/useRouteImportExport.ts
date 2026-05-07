import { useCallback } from "react";
import { useRouteDraftEditor } from "@/features/routing/RouteDraftEditorProvider";
import { Logger } from "@/lib/logger";

interface UseRouteImportExportProps {
	onRouteIoError: (message: string) => void;
}

export const useRouteImportExport = ({ onRouteIoError }: UseRouteImportExportProps) => {
	const editor = useRouteDraftEditor();

	const handleExportGPX = useCallback(() => {
		if (!editor) return;
		const result = editor.exportGpx();
		if (!result.success && result.message) onRouteIoError(result.message);
	}, [editor, onRouteIoError]);

	const handleImportGPX = useCallback(() => {
		if (!editor) {
			onRouteIoError("Map is not ready for import.");
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
				if (fileInput.parentElement) document.body.removeChild(fileInput);
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
					const result = await editor.loadFromGpx(gpxString);
					if (!result.success && result.message) onRouteIoError(result.message);
				} catch (error) {
					Logger.error("[useRouteImportExport] Error importing GPX file:", error);
					onRouteIoError(error instanceof Error ? error.message : "An unknown error occurred during GPX import.");
				} finally {
					if (fileInput.parentElement) document.body.removeChild(fileInput);
				}
			};

			reader.onerror = () => {
				onRouteIoError("Error reading GPX file.");
				if (fileInput.parentElement) document.body.removeChild(fileInput);
			};

			reader.readAsText(file);
		};

		document.body.appendChild(fileInput);
		fileInput.click();
	}, [editor, onRouteIoError]);

	return { handleExportGPX, handleImportGPX };
};
