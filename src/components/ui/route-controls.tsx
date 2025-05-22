import { Button } from "@/components/ui/button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ArrowLeftCircle, ArrowRightCircle, Locate, RefreshCw, Lock, Unlock, 
  SunIcon, MoonIcon, SunriseIcon, SunsetIcon, SparklesIcon as Sparkles,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowRightLeft, // Added ArrowRightLeft
  Plus, Minus, Share2, Maximize // Added Plus and Minus icons for zoom, Added Share2, Added Maximize for Zoom to Route
} from "lucide-react";
import { t, type SupportedLanguage } from '@/lib/i18n'; // Added

// Define TimeOfDay type locally
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

interface RouteControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  onReverseRoute: () => void; // New prop
  onReset: () => void;
  onLocate: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canLocateCurrent: boolean;
  canLocateLastKnown: boolean;
  hasRoute?: boolean;
  isLocked: boolean;
  onToggleLock: () => void;
  currentTimeOfDay: TimeOfDay; // New prop
  onCycleTimeOfDay: () => void; // New prop
  onOpenRouteGenerator: () => void; // New prop for opening the modal
  currentBearing: number; // New prop
  onCycleBearing: () => void; // New prop
  onZoomIn: () => void; // New prop for zoom in
  onZoomOut: () => void; // New prop for zoom out
  onCopyShareLink: () => void; // New prop for copying share link
  onZoomToRoute: () => void; // New prop for zooming to route
  currentLanguage: SupportedLanguage; // Added
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

// Helper to get icon and label for current map orientation
const getOrientationIconAndLabel = (bearing: number, lang: SupportedLanguage): { Icon: React.ElementType; label: string; title: string } => {
  const normalizedBearing = ((bearing % 360) + 360) % 360;
  if (normalizedBearing >= 315 || normalizedBearing < 45) { // North (0 or 360)
    return { Icon: ArrowUp, label: "N", title: t('routeControls.orientation.north', lang) };
  }
  if (normalizedBearing >= 45 && normalizedBearing < 135) { // East (90)
    return { Icon: ArrowRight, label: "E", title: t('routeControls.orientation.east', lang) };
  }
  if (normalizedBearing >= 135 && normalizedBearing < 225) { // South (180)
    return { Icon: ArrowDown, label: "S", title: t('routeControls.orientation.south', lang) };
  }
  // West (270)
  return { Icon: ArrowLeft, label: "W", title: t('routeControls.orientation.west', lang) };
};

export function RouteControls({
  onUndo,
  onRedo,
  onReverseRoute, // Destructure new prop
  onReset,
  onLocate,
  canUndo,
  canRedo,
  canLocateCurrent,
  canLocateLastKnown,
  hasRoute = false,
  isLocked,
  onToggleLock,
  currentTimeOfDay,
  onCycleTimeOfDay,
  onOpenRouteGenerator,
  currentBearing,
  onCycleBearing,
  onZoomIn,
  onZoomOut,
  onCopyShareLink,
  onZoomToRoute,
  currentLanguage // Destructure new prop
}: RouteControlsProps) {
  const TimeOfDayIcon = getIconForTimeOfDay(currentTimeOfDay);
  const { Icon: OrientationIcon, title: orientationTitle } = getOrientationIconAndLabel(currentBearing, currentLanguage);

  const isLocateButtonDisabled = !canLocateCurrent && !canLocateLastKnown;
  
  let locateTooltipText = t('routeControls.locate.notAvailable', currentLanguage);
  let locateDotColorClass = "bg-red-500"; // Default to red dot if disabled

  if (canLocateCurrent) {
    locateTooltipText = t('routeControls.locate.current', currentLanguage);
    // No dot needed when current location is active, icon itself will be blue
  } else if (canLocateLastKnown) {
    locateTooltipText = t('routeControls.locate.lastKnown', currentLanguage);
    locateDotColorClass = "bg-orange-500"; // Orange dot for last known
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2">
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onUndo}
              disabled={!canUndo || isLocked}
              className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50 h-10 w-10"
            >
              <ArrowLeftCircle size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('routeControls.tooltip.undo', currentLanguage)}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onRedo}
              disabled={!canRedo || isLocked}
              className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50 h-10 w-10"
            >
              <ArrowRightCircle size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('routeControls.tooltip.redo', currentLanguage)}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onReverseRoute} // Use the new prop
              disabled={!hasRoute || isLocked} // Same disabled logic as in sidebar
              className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50 h-10 w-10"
            >
              <ArrowRightLeft size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('routeControls.tooltip.reverseRoute', currentLanguage)}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onReset}
              disabled={!hasRoute || isLocked}
              className={`bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50 h-10 w-10`}
            >
              <RefreshCw size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('routeControls.tooltip.resetRoute', currentLanguage)}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onOpenRouteGenerator}
              disabled={isLocked}
              className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10"
            >
              <Sparkles size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('routeControls.tooltip.generateRoute', currentLanguage)}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onToggleLock}
              className={`h-10 w-10 ${
                isLocked
                  ? 'bg-amber-100 dark:bg-amber-800/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/50 border border-amber-300 dark:border-amber-600'
                  : 'bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60'
              }`}
            >
              {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isLocked ? t('routeControls.tooltip.unlockMap', currentLanguage) : t('routeControls.tooltip.lockMap', currentLanguage)}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onCopyShareLink}
              disabled={!hasRoute}
              className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50 h-10 w-10"
            >
              <Share2 size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('routeControls.tooltip.copyShareLink', currentLanguage)}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onZoomToRoute}
              disabled={!hasRoute}
              className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50 h-10 w-10"
            >
              <Maximize size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('routeControls.tooltip.zoomToRoute', currentLanguage)}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onCycleTimeOfDay}
              className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10"
            >
              <TimeOfDayIcon size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('routeControls.tooltip.cycleTimeOfDay', currentLanguage, { time: currentTimeOfDay })}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onCycleBearing}
              className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10 flex items-center justify-center"
            >
              <OrientationIcon size={22} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('routeControls.tooltip.setMapOrientation', currentLanguage, { orientation: orientationTitle })}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onZoomIn}
              className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10"
            >
              <Plus size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('routeControls.tooltip.zoomIn', currentLanguage)}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onZoomOut}
              className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 h-10 w-10"
            >
              <Minus size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('routeControls.tooltip.zoomOut', currentLanguage)}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onLocate}
              disabled={isLocateButtonDisabled}
              className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50 h-10 w-10"
            >
              <div className="relative">
                <Locate size={18} className={canLocateCurrent ? "text-blue-500" : "text-gray-400"} />
                {!canLocateCurrent && ( // Show dot only if not using current location
                  <div className={`absolute -top-1 -right-1 w-2 h-2 ${locateDotColorClass} rounded-full`} />
                )}
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{locateTooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
} 