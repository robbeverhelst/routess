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

// Added just for type compatibility with the imported code
export interface BirdSighting {
  id: string;
  location: Coordinate;
  species: string;
  timestamp: string;
} 