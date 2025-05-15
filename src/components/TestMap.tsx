import { useRef, useCallback, useState } from 'react';
import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1Ijoicm9iYmV2ZXJoZWxzdCIsImEiOiJjbThzeThicDMwNjZ5MmxzNmpjenF6M3Y1In0.lgYzgzpN14eo7vlbUl-1Bw';

export default function TestMap() {
  const mapRef = useRef(null);
  const [markers, setMarkers] = useState<Array<{ longitude: number; latitude: number }>>([]);

  const handleMapLoad = useCallback(({ target }: any) => {
    console.log('Map loaded!');
    mapRef.current = target;
  }, []);
  
  const handleMapClick = useCallback((event: any) => {
    console.log('Map clicked at:', event.lngLat);
    
    setMarkers(prev => [
      ...prev, 
      { 
        longitude: event.lngLat.lng, 
        latitude: event.lngLat.lat 
      }
    ]);
  }, []);
  
  return (
    <div className="relative w-full h-full">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: -98.5,
          latitude: 39.8,
          zoom: 3
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        reuseMaps
        attributionControl={false}
        projection="globe"
        onLoad={handleMapLoad}
        onClick={handleMapClick}
        ref={mapRef}
      >
        {markers.map((marker, index) => (
          <Marker 
            key={`marker-${index}`}
            longitude={marker.longitude}
            latitude={marker.latitude}
          >
            <div 
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: 'red',
                borderRadius: '50%',
                border: '2px solid white'
              }}
            />
          </Marker>
        ))}
      </Map>
      <div className="absolute top-4 left-4 bg-white p-2 rounded shadow">
        Test Map - Click to add markers ({markers.length} markers)
      </div>
    </div>
  );
} 