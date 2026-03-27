import { Search } from "lucide-react";
import React, { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SupportedLanguage } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface LocationSearchProps {
	mapboxToken: string;
	onSelectLocation: (location: { lng: number; lat: number; name: string }) => void;
	currentValue?: string;
	isMobileContext?: boolean;
	isMobileSearchOpen?: boolean;
	onToggleMobileSearch?: () => void;
	startDesktopExpanded?: boolean;
	desktopInputWidthClass?: string;
	currentLanguage: SupportedLanguage;
}

const LocationSearchLoaded = React.lazy(() =>
	import("./location-search-loaded").then((module) => ({
		default: module.LocationSearchLoaded,
	})),
);

function SearchFallback({
	isMobileContext,
	isMobileSearchOpen,
	onToggleMobileSearch,
	currentLanguage,
	desktopInputWidthClass,
}: {
	isMobileContext: boolean;
	isMobileSearchOpen: boolean;
	onToggleMobileSearch?: () => void;
	currentLanguage: SupportedLanguage;
	desktopInputWidthClass: string;
}) {
	if (isMobileContext) {
		if (!isMobileSearchOpen) {
			return (
				<Button
					variant="secondary"
					size="icon"
					onClick={onToggleMobileSearch}
					className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10"
					title={t("locationSearch.button.searchTitle", currentLanguage)}
				>
					<Search size={18} />
				</Button>
			);
		}

		return <div className="h-10 w-60 sm:w-72 animate-pulse rounded-md bg-white/70 dark:bg-black/50" />;
	}

	return (
		<div className={`relative ${desktopInputWidthClass}`}>
			<div className="h-10 w-full animate-pulse rounded-md bg-white/70 shadow-sm dark:bg-black/50" />
		</div>
	);
}

export function LocationSearch({
	mapboxToken,
	onSelectLocation,
	currentValue,
	isMobileContext = false,
	isMobileSearchOpen = false,
	onToggleMobileSearch,
	startDesktopExpanded = false,
	desktopInputWidthClass = "w-56",
	currentLanguage,
}: LocationSearchProps) {
	const [hasDesktopSearchLoaded, setHasDesktopSearchLoaded] = useState(startDesktopExpanded);

	if (isMobileContext && !isMobileSearchOpen) {
		return (
			<Button
				variant="secondary"
				size="icon"
				onClick={onToggleMobileSearch}
				className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10"
				title={t("locationSearch.button.searchTitle", currentLanguage)}
			>
				<Search size={18} />
			</Button>
		);
	}

	if (!isMobileContext && !hasDesktopSearchLoaded) {
		return (
			<div className="relative">
				<Button
					variant="secondary"
					size="icon"
					onClick={() => setHasDesktopSearchLoaded(true)}
					className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10 shadow-sm"
					title={t("locationSearch.button.searchLocationTitle", currentLanguage)}
				>
					<Search size={18} />
				</Button>
			</div>
		);
	}

	return (
		<Suspense
			fallback={
				<SearchFallback
					isMobileContext={isMobileContext}
					isMobileSearchOpen={isMobileSearchOpen}
					onToggleMobileSearch={onToggleMobileSearch}
					currentLanguage={currentLanguage}
					desktopInputWidthClass={desktopInputWidthClass}
				/>
			}
		>
			<LocationSearchLoaded
				mapboxToken={mapboxToken}
				onSelectLocation={onSelectLocation}
				currentValue={currentValue}
				isMobileContext={isMobileContext}
				isMobileSearchOpen={isMobileSearchOpen}
				onToggleMobileSearch={onToggleMobileSearch}
				startDesktopExpanded={startDesktopExpanded || hasDesktopSearchLoaded}
				desktopInputWidthClass={desktopInputWidthClass}
				currentLanguage={currentLanguage}
			/>
		</Suspense>
	);
}
