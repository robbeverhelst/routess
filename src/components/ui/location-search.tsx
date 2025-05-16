import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";

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
}

export function LocationSearch({ mapboxToken, onSelectLocation }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
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
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=5`
        );
        const data = await response.json();
        setResults(data.features || []);
      } catch (error) {
        console.error("Error searching for locations:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    
    return () => clearTimeout(searchTimeout);
  }, [query, mapboxToken]);
  
  // Handle click outside to close results
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const handleSelect = (result: GeocodingFeature) => {
    onSelectLocation({
      lng: result.center[0], 
      lat: result.center[1],
      name: result.place_name
    });
    setQuery("");
    setShowResults(false);
  };
  
  return (
    <div ref={searchRef} className="relative w-64">
      <div className="relative">
        <input
          type="text"
          placeholder="Search for a location..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          className="w-full pl-9 pr-4 py-2 rounded-md bg-white/90 dark:bg-black/80 border border-gray-300 dark:border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Search size={18} className="absolute left-3 top-2.5 text-gray-500" />
        {loading && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        )}
      </div>
      
      {showResults && results.length > 0 && (
        <div className="absolute mt-1 w-full bg-white dark:bg-gray-900 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
          {results.map((result) => (
            <div
              key={result.id}
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm"
              onClick={() => handleSelect(result)}
            >
              <div className="font-medium">{result.text}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {result.place_name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 