import { DirectionalIndicator } from "./DirectionalIndicator";
import { Sun } from "lucide-react";

interface SunPositionIndicatorProps {
  azimuth: number; // Sun direction in degrees (0° = North, 90° = East, etc.)
  elevation: number; // Sun height above horizon (-90° to +90°)
  isVisible: boolean; // Whether sun is above horizon
  timeOfDay: "dawn" | "day" | "dusk" | "night";
  mapBearing?: number; // Current map bearing in degrees (0° = North up)
}

export function SunPositionIndicator({
  azimuth,
  elevation,
  isVisible,
  timeOfDay,
  mapBearing = 0, // Default to 0 if not provided
}: SunPositionIndicatorProps) {
  if (!isVisible || elevation <= 0) {
    return null;
  }

  // Adjust azimuth for map bearing - subtract map bearing to rotate sun with map
  // When map bearing is 90° (East up), sun at 90° should appear at top (North position on screen)
  const adjustedAzimuth = azimuth - mapBearing;
  const normalizedAzimuth = ((adjustedAzimuth % 360) + 360) % 360;

  // Calculate which edge and position
  let position: { top?: string; bottom?: string; left?: string; right?: string };
  let transform = "";

  if (normalizedAzimuth >= 315 || normalizedAzimuth < 45) {
    // North edge
    position = { top: "1rem", left: "50%" };
    transform = `translateX(-50%)`;
  } else if (normalizedAzimuth >= 45 && normalizedAzimuth < 135) {
    // East edge
    const offset = ((normalizedAzimuth - 45) / 90) * 100;
    position = { right: "1rem", top: `${15 + offset * 0.7}%` };
    transform = `translateY(-50%)`;
  } else if (normalizedAzimuth >= 135 && normalizedAzimuth < 225) {
    // South edge
    const offset = ((normalizedAzimuth - 135) / 90) * 100;
    position = { bottom: "1rem", left: `${100 - offset}%` };
    transform = `translateX(-50%)`;
  } else {
    // West edge
    const offset = ((normalizedAzimuth - 225) / 90) * 100;
    position = { left: "1rem", top: `${85 - offset * 0.7}%` };
    transform = `translateY(-50%)`;
  }

  // Enhanced color scheme based on time of day
  const sunColor =
    timeOfDay === "dawn" || timeOfDay === "dusk"
      ? "#FB923C" // orange-400
      : "#FCD34D"; // yellow-300

  return (
    <div
      className="absolute z-30 pointer-events-auto group"
      style={{
        ...position,
        transform,
      }}
    >
      <DirectionalIndicator
        direction={normalizedAzimuth}
        color={sunColor}
        size={48}
        beamLength={100}
        beamWidth={50}
        icon={<Sun size={20} color="white" strokeWidth={2.5} />}
      />

      {/* Enhanced tooltip */}
      <div
        className="absolute top-full left-1/2 transform -translate-x-1/2 mt-3 
                      bg-gray-900/90 text-white text-sm px-3 py-2 rounded-lg shadow-xl backdrop-blur-sm
                      opacity-0 group-hover:opacity-100 transition-all duration-200 
                      pointer-events-none whitespace-nowrap border border-gray-700/50"
      >
        <div className="flex items-center gap-2">
          <span>☀️</span>
          <div>
            <div className="font-medium">{Math.round(azimuth)}° azimuth</div>
            <div className="text-xs opacity-75">{Math.round(elevation)}° elevation</div>
          </div>
        </div>
        {/* Tooltip arrow */}
        <div
          className="absolute -top-1 left-1/2 transform -translate-x-1/2 
                        w-0 h-0 border-l-[4px] border-r-[4px] border-b-[4px] 
                        border-l-transparent border-r-transparent border-b-gray-900/90"
        />
      </div>
    </div>
  );
}
