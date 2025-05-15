import Map from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

// Correct Mapbox access token provided
const MAPBOX_TOKEN = 'pk.eyJ1Ijoicm9iYmV2ZXJoZWxzdCIsImEiOiJjbThzeThicDMwNjZ5MmxzNmpjenF6M3Y1In0.lgYzgzpN14eo7vlbUl-1Bw';

interface MapboxMapProps {
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  width?: string | number;
  height?: string | number;
}

export default function MapboxMap({
  initialViewState = {
    longitude: -98.5,
    latitude: 39.8,
    zoom: 3
  },
  width = '100%',
  height = '100%'
}: MapboxMapProps) {
  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={initialViewState}
      style={{ width, height, position: 'absolute', top: 0, left: 0 }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      reuseMaps
      attributionControl={false}
      projection="globe"
    />
  );
} 