import React from 'react';
import type { Map } from 'mapbox-gl';
import { Button } from '@/components/ui/button';

export interface PopupInfo {
  longitude: number;
  latitude: number;
  type: 'direct' | 'remove' | 'info' | 'add_on_route';
  waypointIndex?: number;
  message?: string;
}

interface MapPopupProps {
  popupInfo: PopupInfo;
  mapInstance: Map;
  onAddDirectWaypoint: () => void;
  onRemoveWaypoint: () => void;
  onAddWaypointOnRoute: () => void;
  // onShowInfo: (message: string) => void; // If we want to handle info popups more actively
}

export const MapPopup: React.FC<MapPopupProps> = ({
  popupInfo,
  mapInstance,
  onAddDirectWaypoint,
  onRemoveWaypoint,
  onAddWaypointOnRoute,
}) => {
  if (!popupInfo) return null;

  const position = mapInstance.project([popupInfo.longitude, popupInfo.latitude]);

  return (
    <div
      className="absolute z-10 animate-in fade-in"
      style={{
        left: position.x,
        top: position.y - 10, // Adjusted for better pointing, original was -30 which might be too high
        transform: 'translate(-50%, -100%)',
      }}
    >
      {popupInfo.type === 'direct' && (
        <div className="p-2 bg-white rounded-md shadow-md border border-border">
          <Button
            variant="ghost"
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            onClick={onAddDirectWaypoint}
          >
            Add direct waypoint
          </Button>
        </div>
      )}
      
      {popupInfo.type === 'remove' && (
        <div className="p-2 bg-white rounded-md shadow-md border border-border">
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-800 hover:bg-red-50 flex items-center gap-2"
            onClick={onRemoveWaypoint}
          >
            <span className="text-lg">🗑️</span>
            <span>Remove point</span>
          </Button>
        </div>
      )}
      
      {popupInfo.type === 'add_on_route' && (
        <div className="p-2 bg-white rounded-md shadow-md border border-border">
          <Button
            variant="ghost"
            className="text-green-600 hover:text-green-800 hover:bg-green-50"
            onClick={onAddWaypointOnRoute}
          >
            Add waypoint here
          </Button>
        </div>
      )}
      
      {popupInfo.type === 'info' && popupInfo.message && (
        <div className="p-2 bg-white rounded-md shadow-md border border-border">
          <div className="text-sm text-gray-800">
            {popupInfo.message}
          </div>
        </div>
      )}
    </div>
  );
}; 