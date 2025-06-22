export type Coordinate = [number, number];

export interface WaypointHistory {
  points: Coordinate[];
  flags: boolean[];
}

export interface MapboxMapProps {
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  width?: string | number;
  height?: string | number;
}

// Map style types
export type MapStyle = "standard" | "satellite";

// Added just for type compatibility with the imported code
export interface BirdSighting {
  id: string;
  location: Coordinate;
  species: string;
  timestamp: string;
}
