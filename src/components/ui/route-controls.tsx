import { Button } from "@/components/ui/button";
import { ArrowLeftCircle, ArrowRightCircle, Locate, RefreshCw, Lock, Unlock } from "lucide-react";

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
}

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
  onToggleLock
}: RouteControlsProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
      <Button
        variant="secondary"
        size="icon"
        disabled={!canUndo || isLocked}
        onClick={onUndo}
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50"
        title="Undo"
      >
        <ArrowLeftCircle size={18} />
      </Button>
      
      <Button
        variant="secondary"
        size="icon"
        disabled={!canRedo || isLocked}
        onClick={onRedo}
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50"
        title="Redo"
      >
        <ArrowRightCircle size={18} />
      </Button>
      
      <Button
        variant="secondary"
        size="icon"
        onClick={onLocate}
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60"
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
        onClick={onReset}
        disabled={!hasRoute || isLocked}
        className={`bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 px-3 md:px-4 py-2 ${(!hasRoute || isLocked) ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : ''}`}
        title="Reset route"
      >
        <RefreshCw size={18} className="mr-0 md:mr-1" />
        <span className="hidden md:inline">Reset</span>
      </Button>
      
      <Button
        variant="secondary"
        size="icon"
        onClick={onToggleLock}
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60"
        title={isLocked ? "Unlock map interaction" : "Lock map interaction"}
      >
        {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
      </Button>
    </div>
  );
} 