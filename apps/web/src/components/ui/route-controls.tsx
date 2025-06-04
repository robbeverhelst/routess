import React from "react";
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
  Plus, Minus, Share2, Maximize, WifiOff, Layers // Added Plus and Minus icons for zoom, Added Share2, Added Maximize for Zoom to Route, Added WifiOff for offline indicator, Added Layers
} from "lucide-react";
import { t, type SupportedLanguage } from '@/lib/i18n'; // Added

// Define TimeOfDay type locally
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

// Define MapStyle type locally
export type MapStyle = 'standard' | 'satellite';

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
  isOffline?: boolean; // New prop for offline status
  currentMapStyle: MapStyle; // New prop for current map style
  onToggleMapStyle: () => void; // New prop for toggling map style
  // Enhanced location props
  isLocationTracking?: boolean; // New prop for tracking state
  locationAccuracy?: number | null; // New prop for location accuracy
  userLocation?: [number, number] | null; // New prop for user location
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
  currentLanguage, // Destructure new prop
  isOffline, // Destructure new prop
  currentMapStyle, // Destructure new prop
  onToggleMapStyle, // Destructure new prop
  // Enhanced location props
  isLocationTracking = false,
  locationAccuracy,
  userLocation,
}: RouteControlsProps) {
  const TimeOfDayIcon = getIconForTimeOfDay(currentTimeOfDay);
  const { Icon: OrientationIcon, title: orientationTitle } = getOrientationIconAndLabel(currentBearing, currentLanguage);

  const isLocateButtonDisabled = !canLocateCurrent && !canLocateLastKnown;
  
  let locateTooltipText = t('routeControls.locate.notAvailable', currentLanguage);
  let badgeType: 'none' | 'blue-pulse' | 'orange' | 'red' = 'red'; // Default to red if no location
  const locateIcon = Locate;
  const locateButtonClass = "bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50 h-10 w-10";
  let iconColor = "text-gray-400"; // Default gray when disabled

  // Determine badge type and icon color based on location state
  if (canLocateCurrent && !isLocationTracking) {
    // Current location available, not actively tracking
    badgeType = 'none';
    iconColor = "text-blue-500";
    locateTooltipText = hasRoute 
      ? "Center on location & start tracking"
      : t('routeControls.locate.current', currentLanguage);
  } else if (isLocationTracking) {
    // Actively tracking location
    badgeType = 'blue-pulse';
    iconColor = "text-blue-500";
    locateTooltipText = "Center on location & force update";
    
    // Add accuracy info if available
    if (locationAccuracy !== null && locationAccuracy !== undefined) {
      const accuracyText = locationAccuracy <= 10 
        ? t('location.accuracy.high', currentLanguage, { accuracy: Math.round(locationAccuracy).toString() })
        : locationAccuracy <= 50
        ? t('location.accuracy.medium', currentLanguage, { accuracy: Math.round(locationAccuracy).toString() })
        : t('location.accuracy.low', currentLanguage, { accuracy: Math.round(locationAccuracy).toString() });
      locateTooltipText += ` - ${accuracyText}`;
    }
  } else if (canLocateLastKnown) {
    // No current location but have last known
    badgeType = 'orange';
    iconColor = "text-orange-500";
    locateTooltipText = t('routeControls.locate.lastKnown', currentLanguage);
  } else {
    // No location data at all
    badgeType = 'red';
    iconColor = "text-red-500";
    locateTooltipText = t('routeControls.locate.notAvailable', currentLanguage);
  }

  // Get current map style display name for tooltip
  const currentMapStyleName = t(`routeControls.mapStyle.${currentMapStyle}`, currentLanguage);

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
              disabled={isOffline} // Disable toggle when offline
              className={`h-10 w-10 relative ${
                isLocked || isOffline
                  ? 'bg-amber-100 dark:bg-amber-800/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/50 border border-amber-300 dark:border-amber-600'
                  : 'bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60'
              }`}
            >
              {isLocked || isOffline ? <Lock size={18} /> : <Unlock size={18} />}
              {isOffline && (
                <div className="absolute -top-1 -right-1">
                  <WifiOff size={12} className="text-red-500 bg-white dark:bg-black rounded-full p-0.5" />
                </div>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isOffline 
                ? t('routeControls.tooltip.lockedOffline', currentLanguage)
                : isLocked 
                  ? t('routeControls.tooltip.unlockMap', currentLanguage) 
                  : t('routeControls.tooltip.lockMap', currentLanguage)
              }
            </p>
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
              disabled={currentMapStyle === 'satellite'}
              className="bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60 disabled:opacity-50 h-10 w-10 relative"
            >
              <div className="relative">
                <TimeOfDayIcon size={18} />
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {currentMapStyle === 'satellite' 
                ? t('routeControls.tooltip.timeOfDayDisabledSatellite', currentLanguage)
                : userLocation 
                  ? t('routeControls.tooltip.cycleTimeOfDayWithSun', currentLanguage, { time: currentTimeOfDay })
                  : t('routeControls.tooltip.cycleTimeOfDay', currentLanguage, { time: currentTimeOfDay })
              }
            </p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              onClick={onToggleMapStyle}
              className={`h-10 w-10 ${
                currentMapStyle === 'satellite'
                  ? 'bg-blue-100 dark:bg-blue-800/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50 border border-blue-300 dark:border-blue-600'
                  : 'bg-white/90 dark:bg-black/80 text-black dark:text-white hover:bg-white/70 dark:hover:bg-black/60'
              }`}
            >
              <Layers size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('routeControls.tooltip.toggleMapStyle', currentLanguage, { style: currentMapStyleName })}</p>
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
              disabled={isLocateButtonDisabled && !isLocationTracking}
              className={locateButtonClass}
            >
              <div className="relative">
                {React.createElement(locateIcon, {
                  size: 18,
                  className: iconColor
                })}
                {/* Status badges */}
                {badgeType === 'blue-pulse' && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white dark:border-black flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  </div>
                )}
                {badgeType === 'orange' && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full border border-white dark:border-black" />
                )}
                {badgeType === 'red' && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-black" />
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