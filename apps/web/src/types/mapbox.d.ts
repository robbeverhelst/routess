declare global {
  interface Window {
    mapboxgl: typeof import('mapbox-gl');
  }
}

export {}; 