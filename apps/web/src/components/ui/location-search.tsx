import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { type SupportedLanguage, t } from "@/lib/i18n";
import { Logger } from "@/lib/logger";

// Define the result type from Mapbox geocoding API
interface GeocodingFeature {
	id: string;
	place_name: string;
	text: string;
	center: [number, number]; // longitude, latitude
	properties: Record<string, unknown>;
}

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
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<GeocodingFeature[]>([]);
	const [loading, setLoading] = useState(false);
	const [showResults, setShowResults] = useState(false);
	const [isDesktopSearchExpanded, setIsDesktopSearchExpanded] = useState(startDesktopExpanded);
	const searchRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Focus input when mobile search opens or desktop search expands
	useEffect(() => {
		if (isMobileContext && isMobileSearchOpen && inputRef.current) {
			inputRef.current.focus();
		} else if (!isMobileContext && isDesktopSearchExpanded && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isMobileContext, isMobileSearchOpen, isDesktopSearchExpanded]);

	// Effect to update query when currentValue prop changes
	useEffect(() => {
		if (currentValue && currentValue !== query) {
			setQuery(currentValue);
		}
		// If currentValue is cleared by the parent, and the user is not actively typing,
		// we might want to clear the query. However, the parent should control clearing.
		// For now, this primarily sets the initial/selected value.
	}, [currentValue, query]);

	// Search for locations when query changes
	useEffect(() => {
		const searchTimeout = setTimeout(async () => {
			if (query.length < 3) {
				setResults([]);
				return;
			}

			setLoading(true);
			try {
				const response = await fetch(
					`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=5`,
				);
				const data = await response.json();
				setResults(data.features || []);
			} catch (error) {
				Logger.error("Error searching for locations:", error);
				setResults([]);
			} finally {
				setLoading(false);
			}
		}, 300);

		return () => clearTimeout(searchTimeout);
	}, [query, mapboxToken]);

	// Handle click outside to close results dropdown (and mobile search if open)
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
				setShowResults(false);
				if (isMobileContext && isMobileSearchOpen && onToggleMobileSearch) {
					onToggleMobileSearch();
					setQuery("");
					setResults([]);
				} else if (!isMobileContext && isDesktopSearchExpanded) {
					if (startDesktopExpanded) {
						// If it started expanded (e.g. in modal), only hide results on outside click.
						// The input itself remains visible.
						setShowResults(false);
					} else {
						// If it started collapsed (e.g. on map page), then an outside click should collapse it again.
						setIsDesktopSearchExpanded(false);
						setQuery("");
						setResults([]);
					}
				}
			}
		}

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isMobileContext, isMobileSearchOpen, onToggleMobileSearch, isDesktopSearchExpanded, startDesktopExpanded]);

	const handleSelect = (result: GeocodingFeature) => {
		const selectedLocation = {
			lng: result.center[0],
			lat: result.center[1],
			name: result.place_name,
		};
		onSelectLocation(selectedLocation);
		setShowResults(false);
		if (isMobileContext && onToggleMobileSearch) {
			onToggleMobileSearch(); // Close mobile search after selection
		}
		// For desktop, keep it open for further interaction or let clickOutside handle it.
		// If we want to close desktop on select: setIsDesktopSearchExpanded(false);
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setQuery(e.target.value);
		// If user starts typing, we are no longer strictly reflecting `currentValue`
		// The search useEffect will take over.
	};

	const handleInputFocus = () => {
		setShowResults(true);
	};

	if (isMobileContext) {
		return (
			<div ref={searchRef} className={`relative flex items-center justify-end transition-all duration-300 ease-in-out`}>
				{!isMobileSearchOpen ? (
					<Button
						variant="secondary"
						size="icon"
						onClick={onToggleMobileSearch}
						className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10"
						title={t("locationSearch.button.searchTitle", currentLanguage)}
					>
						<Search size={18} />
					</Button>
				) : (
					<div className="relative flex items-center w-60 sm:w-72">
						<Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
						<input
							ref={inputRef}
							type="text"
							placeholder={t("locationSearch.placeholder.searchLocation", currentLanguage)}
							value={query}
							onChange={handleInputChange}
							onFocus={handleInputFocus}
							className="w-full pl-10 pr-10 py-2 rounded-md bg-white/90 dark:bg-black/80 border border-gray-300 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
						/>
						<Button
							variant="ghost"
							size="icon"
							onClick={onToggleMobileSearch}
							className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 h-8 w-8"
							title={t("locationSearch.button.closeSearchTitle", currentLanguage)}
						>
							<X size={18} />
						</Button>
						{loading && (
							<div className="absolute right-10 top-1/2 -translate-y-1/2 mr-1">
								{" "}
								{/* Adjusted for X button */}
								<div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
							</div>
						)}
					</div>
				)}
				{/* Results dropdown for mobile (absolutely positioned relative to the main expanding container) */}
				{isMobileSearchOpen && showResults && results.length > 0 && (
					<div
						role="listbox"
						className="absolute mt-1 top-full left-0 w-full bg-white dark:bg-gray-900 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto"
					>
						{results.map((result) => (
							<div
								key={result.id}
								role="option"
								aria-selected={false}
								tabIndex={0}
								className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm"
								onClick={() => handleSelect(result)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										handleSelect(result);
									}
								}}
							>
								<div className="font-medium">{result.text}</div>
								<div className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.place_name}</div>
							</div>
						))}
					</div>
				)}
			</div>
		);
	}

	// Default Desktop view
	if (!isMobileContext) {
		if (!isDesktopSearchExpanded) {
			return (
				<div ref={searchRef} className="relative">
					<Button
						variant="secondary"
						size="icon"
						onClick={() => setIsDesktopSearchExpanded(true)}
						className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10 shadow-sm"
						title={t("locationSearch.button.searchLocationTitle", currentLanguage)}
					>
						<Search size={18} />
					</Button>
				</div>
			);
		}

		// Expanded Desktop View
		return (
			<div ref={searchRef} className={`relative ${desktopInputWidthClass}`}>
				<div className="relative flex items-center">
					<Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
					<input
						ref={inputRef}
						type="text"
						placeholder={t("locationSearch.placeholder.searchLocation", currentLanguage)}
						value={query}
						onChange={handleInputChange}
						onFocus={handleInputFocus}
						className="w-full pl-10 pr-10 py-2 rounded-md bg-white/90 dark:bg-black/80 border border-gray-300 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
					/>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => {
							setIsDesktopSearchExpanded(false);
							setQuery("");
							setResults([]);
							setShowResults(false);
						}}
						className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 h-8 w-8"
						title={t("locationSearch.button.closeSearchTitle", currentLanguage)}
					>
						<X size={18} />
					</Button>
					{loading && (
						<div className="absolute right-10 top-1/2 -translate-y-1/2 mr-1">
							{" "}
							{/* Adjusted for X button */}
							<div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
						</div>
					)}
				</div>

				{showResults && results.length > 0 && (
					<div
						role="listbox"
						className="absolute mt-1 w-full bg-white dark:bg-gray-900 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto"
					>
						{results.map((result) => (
							<div
								key={result.id}
								role="option"
								aria-selected={false}
								tabIndex={0}
								className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm"
								onClick={() => handleSelect(result)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										handleSelect(result);
									}
								}}
							>
								<div className="font-medium">{result.text}</div>
								<div className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.place_name}</div>
							</div>
						))}
					</div>
				)}
			</div>
		);
	}
}
