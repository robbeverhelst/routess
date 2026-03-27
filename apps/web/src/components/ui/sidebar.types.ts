import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import type { SupportedLanguage } from "@/lib/i18n";

export interface SidebarProps {
	onUndo: () => void;
	onRedo: () => void;
	onReset: () => void;
	onReverseRoute: () => void;
	onZoomToRoute: () => void;
	onShare: () => void;
	canUndo: boolean;
	canRedo: boolean;
	hasRoute?: boolean;
	routeDistance?: string;
	routeDuration?: string;
	isLocked: boolean;
	onToggleLock: () => void;
	map: MapboxMap | null;
	accessToken: string | undefined;
	setRouteDistance: Dispatch<SetStateAction<string>>;
	setRouteDuration: Dispatch<SetStateAction<string>>;
	setHasRoute: Dispatch<SetStateAction<boolean>>;
	onImportError: (message: string) => void;
	displayedShareUrl: string | null;
	onCopySharedUrl: (url: string) => void;
	onClearShareDisplay?: () => void;
	currentLanguage: SupportedLanguage;
	onLanguageChange: (lang: SupportedLanguage) => void;
	showSunDirection: boolean;
	onToggleSunDirection: (enabled: boolean) => void;
	onOpenRouteLibrary: () => void;
	onSaveRoute: () => void;
}
