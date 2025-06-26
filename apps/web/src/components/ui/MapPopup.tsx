import React from "react";
import type { Map } from "mapbox-gl";
import { Button } from "@/components/ui/button";
import { t, type SupportedLanguage } from "@/lib/i18n";

export interface PopupInfo {
  longitude: number;
  latitude: number;
  type: "direct" | "remove" | "info" | "add_on_route";
  waypointIndex?: number;
  message?: string;
}

interface MapPopupProps {
  popupInfo: PopupInfo;
  mapInstance: Map;
  onAddDirectWaypoint: () => void;
  onRemoveWaypoint: () => void;
  onAddWaypointOnRoute: () => void;
  currentLanguage: SupportedLanguage;
  // onShowInfo: (message: string) => void; // If we want to handle info popups more actively
}

const MapPopupComponent: React.FC<MapPopupProps> = ({
  popupInfo,
  mapInstance,
  onAddDirectWaypoint,
  onRemoveWaypoint,
  onAddWaypointOnRoute,
  currentLanguage,
}) => {
  if (!popupInfo) return null;

  const position = mapInstance.project([popupInfo.longitude, popupInfo.latitude]);

  return (
    <div
      className="absolute z-10 animate-in fade-in"
      style={{
        left: position.x,
        top: position.y - 10, // Adjusted for better pointing, original was -30 which might be too high
        transform: "translate(-50%, -100%)",
      }}
    >
      {popupInfo.type === "direct" && (
        <div className="p-2 bg-white rounded-md shadow-md border border-border">
          <Button
            variant="ghost"
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            onClick={onAddDirectWaypoint}
          >
            {t("mapPopup.button.addDirectWaypoint", currentLanguage)}
          </Button>
        </div>
      )}

      {popupInfo.type === "remove" && (
        <div className="p-2 bg-white rounded-md shadow-md border border-border">
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-800 hover:bg-red-50 flex items-center gap-2"
            onClick={onRemoveWaypoint}
          >
            <span className="text-lg">🗑️</span>
            <span>{t("mapPopup.button.removePoint", currentLanguage)}</span>
          </Button>
        </div>
      )}

      {popupInfo.type === "add_on_route" && (
        <div className="p-2 bg-white rounded-md shadow-md border border-border">
          <Button
            variant="ghost"
            className="text-green-600 hover:text-green-800 hover:bg-green-50"
            onClick={onAddWaypointOnRoute}
          >
            {t("mapPopup.button.addWaypointHere", currentLanguage)}
          </Button>
        </div>
      )}

      {popupInfo.type === "info" && popupInfo.message && (
        <div className="p-2 bg-white rounded-md shadow-md border border-border">
          <div className="text-sm text-gray-800">{popupInfo.message}</div>
        </div>
      )}
    </div>
  );
};

// Memoize MapPopup to prevent unnecessary re-renders when props haven't changed
export const MapPopup = React.memo(MapPopupComponent);
