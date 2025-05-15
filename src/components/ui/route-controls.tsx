import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeftCircle, ArrowRightCircle, Locate, RefreshCw } from "lucide-react";

interface RouteControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onLocate: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasUserLocation: boolean;
}

export function RouteControls({
  onUndo,
  onRedo,
  onReset,
  onLocate,
  canUndo,
  canRedo,
  hasUserLocation
}: RouteControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="icon"
        disabled={!canUndo}
        onClick={onUndo}
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50"
        title="Undo"
      >
        <ArrowLeftCircle size={18} />
      </Button>
      
      <Button
        variant="secondary"
        size="icon"
        disabled={!canRedo}
        onClick={onRedo}
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50"
        title="Redo"
      >
        <ArrowRightCircle size={18} />
      </Button>
      
      <Button
        variant="secondary"
        size="icon"
        disabled={!hasUserLocation}
        onClick={onLocate}
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50"
        title="Center on my location"
      >
        <Locate size={18} className={hasUserLocation ? "text-blue-500" : ""} />
      </Button>
      
      <Button
        variant="secondary"
        onClick={onReset}
        className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60"
        title="Reset route"
      >
        <RefreshCw size={18} className="mr-1" />
        <span>Reset</span>
      </Button>
    </div>
  );
} 