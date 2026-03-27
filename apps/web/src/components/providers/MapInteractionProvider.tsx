import type React from "react";
import { createContext, useCallback, useContext } from "react";
import { Logger } from "@/lib/logger";

interface MapInteractionContextType {
	// Keyboard shortcuts
	handleKeyboardShortcuts: (canUndo: boolean, canRedo: boolean, onUndo: () => void, onRedo: () => void) => () => void;

	// PWA shortcuts
	handlePWAShortcuts: (onOpenRouteGenerator: () => void, onLocate: () => void, onImportGPX: () => void) => () => void;
}

const MapInteractionContext = createContext<MapInteractionContextType | null>(null);

export const useMapInteraction = () => {
	const context = useContext(MapInteractionContext);
	if (!context) {
		throw new Error("useMapInteraction must be used within a MapInteractionProvider");
	}
	return context;
};
// Export context for separate import
export { MapInteractionContext };

interface MapInteractionProviderProps {
	children: React.ReactNode;
}

export const MapInteractionProvider: React.FC<MapInteractionProviderProps> = ({ children }) => {
	// Keyboard shortcuts for undo/redo
	const handleKeyboardShortcuts = useCallback(
		(canUndo: boolean, canRedo: boolean, onUndo: () => void, onRedo: () => void) => {
			const handleKeyDown = (event: KeyboardEvent) => {
				// Check for Cmd (Mac) or Ctrl (Windows/Linux)
				const isModifierPressed = event.metaKey || event.ctrlKey;

				if (!isModifierPressed) return;

				// Prevent default browser behavior for these shortcuts
				if (event.key === "z" || event.key === "Z") {
					event.preventDefault();

					if (event.shiftKey) {
						// Cmd/Ctrl + Shift + Z = Redo
						if (canRedo) {
							onRedo();
							Logger.info("[MapInteractionProvider] Redo triggered via keyboard shortcut");
						}
					} else {
						// Cmd/Ctrl + Z = Undo
						if (canUndo) {
							onUndo();
							Logger.info("[MapInteractionProvider] Undo triggered via keyboard shortcut");
						}
					}
				}
			};

			// Add event listener
			window.addEventListener("keydown", handleKeyDown);

			// Return cleanup function
			return () => {
				window.removeEventListener("keydown", handleKeyDown);
			};
		},
		[],
	);

	// PWA Shortcut Event Listeners
	const handlePWAShortcuts = useCallback(
		(onOpenRouteGenerator: () => void, onLocate: () => void, onImportGPX: () => void) => {
			const handlePWAShortcut = (event: CustomEvent) => {
				const { action } = event.detail;
				Logger.info("[MapInteractionProvider] PWA shortcut triggered:", action);

				switch (action) {
					case "new-route":
						// Open route generator modal
						onOpenRouteGenerator();
						break;
					case "locate":
						// Trigger location finding
						onLocate();
						break;
					case "import": {
						// Trigger GPX import by simulating a click on the import button
						onImportGPX();
						break;
					}
					default:
						Logger.warn("[MapInteractionProvider] Unknown PWA shortcut action:", action);
				}
			};

			// Add event listener for PWA shortcuts
			window.addEventListener("pwa-shortcut", handlePWAShortcut as EventListener);

			// Return cleanup function
			return () => {
				window.removeEventListener("pwa-shortcut", handlePWAShortcut as EventListener);
			};
		},
		[],
	);

	const contextValue: MapInteractionContextType = {
		handleKeyboardShortcuts,
		handlePWAShortcuts,
	};

	return <MapInteractionContext.Provider value={contextValue}>{children}</MapInteractionContext.Provider>;
};
