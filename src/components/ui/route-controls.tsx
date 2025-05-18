import { Button } from "@/components/ui/button";
import { ArrowLeftCircle, ArrowRightCircle, Locate, RefreshCw, Lock, Unlock, SunIcon, MoonIcon, SunriseIcon, SunsetIcon } from "lucide-react";

// Define TimeOfDay type locally
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

interface RouteControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onLocate: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasUserLocation: boolean;
  hasRoute?: boolean;
  isLocked: boolean;
  onToggleLock: () => void;
  currentTimeOfDay: TimeOfDay; // New prop
  onCycleTimeOfDay: () => void; // New prop
}

// Helper to get the icon component based on TimeOfDay
const getIconForTimeOfDay = (time: TimeOfDay): React.ElementType => {
  switch (time) {
    case 'dawn': return SunriseIcon;
    case 'day': return SunIcon;
    case 'dusk': return SunsetIcon;
    case 'night': return MoonIcon;
    default: return SunIcon; // Default to day icon
  }
};

export function RouteControls({
  onUndo,
  onRedo,
  onReset,
  onLocate,
  canUndo,
  canRedo,
  hasUserLocation,
  hasRoute = false,
  isLocked,
  onToggleLock,
  currentTimeOfDay,
  onCycleTimeOfDay
}: RouteControlsProps) {
  const TimeOfDayIcon = getIconForTimeOfDay(currentTimeOfDay);

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
      <Button
        variant="secondary"
        onClick={onUndo}
        disabled={!canUndo || isLocked}
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50 h-10 w-10"
        title="Undo"
      >
        <ArrowLeftCircle size={18} />
      </Button>
      
      <Button
        variant="secondary"
        onClick={onRedo}
        disabled={!canRedo || isLocked}
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50 h-10 w-10"
        title="Redo"
      >
        <ArrowRightCircle size={18} />
      </Button>
      
      <Button
        variant="secondary"
        onClick={onReset}
        disabled={!hasRoute || isLocked}
        className={`bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50 h-10 w-10`}
        title="Reset route"
      >
        <RefreshCw size={18} />
      </Button>
      
      <Button
        variant="secondary"
        onClick={onToggleLock}
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10"
        title={isLocked ? "Unlock map interaction" : "Lock map interaction"}
      >
        {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
      </Button>
      
      <Button
        variant="secondary"
        onClick={onLocate}
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10"
        title={hasUserLocation ? "Center on my location" : "Location not available"}
      >
        <div className="relative">
          <Locate size={18} className={hasUserLocation ? "text-blue-500" : "text-gray-400"} />
          {!hasUserLocation && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </div>
      </Button>

      <Button
        variant="secondary"
        onClick={onCycleTimeOfDay} 
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10"
        title={`Cycle time of day (Current: ${currentTimeOfDay})`}
      >
        <TimeOfDayIcon size={18} />
      </Button>
    </div>
  );
} 