import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { type SupportedLanguage, t } from "@/lib/i18n";
import { Logger } from "@/lib/logger";

interface GeocodingFeature {
	id: string;
	place_name: string;
	text: string;
	center: [number, number];
	properties: Record<string, unknown>;
}

interface LocationSearchLoadedProps {
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

export function LocationSearchLoaded({
	mapboxToken,
	onSelectLocation,
	currentValue,
	isMobileContext = false,
	isMobileSearchOpen = false,
	onToggleMobileSearch,
	startDesktopExpanded = false,
	desktopInputWidthClass = "w-56",
	currentLanguage,
}: LocationSearchLoadedProps) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<GeocodingFeature[]>([]);
	const [loading, setLoading] = useState(false);
	const [showResults, setShowResults] = useState(false);
	const [isDesktopSearchExpanded, setIsDesktopSearchExpanded] = useState(startDesktopExpanded);
	const searchRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isMobileContext && isMobileSearchOpen && inputRef.current) {
			inputRef.current.focus();
		} else if (!isMobileContext && isDesktopSearchExpanded && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isMobileContext, isMobileSearchOpen, isDesktopSearchExpanded]);

	useEffect(() => {
		if (currentValue && currentValue !== query) {
			setQuery(currentValue);
		}
	}, [currentValue, query]);

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
						setShowResults(false);
					} else {
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
		onSelectLocation({
			lng: result.center[0],
			lat: result.center[1],
			name: result.place_name,
		});
		setShowResults(false);
		if (isMobileContext && onToggleMobileSearch) {
			onToggleMobileSearch();
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setQuery(e.target.value);
	};

	const handleInputFocus = () => {
		setShowResults(true);
	};

	if (isMobileContext) {
		return (
			<div ref={searchRef} className="relative flex items-center justify-end transition-all duration-300 ease-in-out">
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
								<div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
							</div>
						)}
					</div>
				)}
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
