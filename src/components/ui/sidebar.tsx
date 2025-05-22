import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Menu, User, Save, BookMarked, LogIn, Upload, Share2, FileDown, X, AlertCircle, MapPin, Clock, Copy, RotateCcw as BackIcon, ArrowRightLeft, Focus, Wand2, Lock, Unlock } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useRef } from "react";
import type { Map as MapboxMap } from 'mapbox-gl'; // Import MapboxMap type
import { exportRouteToGPX, importRouteFromGPX } from '../../lib/routing'; // Import GPX functions
import type { Dispatch, SetStateAction } from 'react';
import { Logger } from '@/lib/logger';

interface SidebarProps {
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onReverseRoute: () => void;
  onZoomToRoute: () => void;
  onShare: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasRoute?: boolean;
  routeDistance?: string;
  routeDuration?: string;
  isLocked: boolean;
  onToggleLock: () => void;
  // New props for GPX functionality
  map: MapboxMap | null;
  accessToken: string | undefined; // Can be undefined if not set
  setRouteDistance: Dispatch<SetStateAction<string>>;
  setRouteDuration: Dispatch<SetStateAction<string>>;
  setHasRoute: Dispatch<SetStateAction<boolean>>;
  onImportError: (message: string) => void;
  // Props for inline share display
  displayedShareUrl: string | null;
  onCopySharedUrl: (url: string) => void;
  onClearShareDisplay?: () => void;
  onOpenRouteGenerator: () => void;
}

export function Sidebar({
  onUndo,
  onRedo,
  onReset,
  onReverseRoute,
  onZoomToRoute,
  onShare,
  canUndo,
  canRedo,
  hasRoute = false,
  routeDistance = '',
  routeDuration = '',
  isLocked,
  onToggleLock,
  // Destructure new props
  map,
  accessToken,
  setRouteDistance,
  setRouteDuration,
  setHasRoute,
  onImportError,
  displayedShareUrl,
  onCopySharedUrl,
  onClearShareDisplay,
  onOpenRouteGenerator,
}: SidebarProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  
  const handleExportGPX = () => {
    const result = exportRouteToGPX();
    if (!result.success && result.message) {
      onImportError(result.message); // Reusing onImportError for feedback
    } else if (result.success) {
      Logger.info('Route exported successfully.'); // Placeholder for success feedback
      // onImportError("Route exported successfully."); // Or use the same feedback for success
    }
  };

  const handleImportGPX = () => {
    if (!map || !accessToken) {
      onImportError("Map or access token is not available for import.");
      Logger.error("Map instance or accessToken not available for GPX import.");
      return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.gpx';
    fileInput.style.display = 'none';

    fileInput.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target && target.files && target.files.length > 0) {
        const file = target.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const gpxString = e.target?.result as string;
            if (!gpxString) {
              onImportError("Failed to read GPX file.");
              return;
            }
            await importRouteFromGPX(
              gpxString, 
              map, 
              accessToken, 
              setRouteDistance, 
              setRouteDuration, 
              setHasRoute, 
              onImportError
            );
          } catch (error) {
            Logger.error("Error processing GPX file:", error);
            onImportError(error instanceof Error ? error.message : "An unknown error occurred during GPX import.");
          }
        };
        reader.onerror = () => {
          onImportError("Error reading GPX file.");
        };
        reader.readAsText(file);
      }
      if (fileInput.parentElement) {
        document.body.removeChild(fileInput);
      }
    };
    document.body.appendChild(fileInput);
    fileInput.click();
    setTimeout(() => {
        if (fileInput.parentElement) {
            document.body.removeChild(fileInput);
        }
    }, 2000);
  };
  
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="bg-white/90 dark:bg-black/80 hover:bg-white/70 dark:hover:bg-black/60 shadow-sm h-10 w-10">
          <Menu size={20} />
        </Button>
      </SheetTrigger>
      <SheetContent className="p-0 w-[330px] border-l" hideCloseButton>
        <VisuallyHidden asChild>
          <SheetTitle>Main Menu and Route Controls</SheetTitle>
        </VisuallyHidden>
        <VisuallyHidden asChild>
          <SheetDescription>
            Access route history, file operations, sharing, and account settings.
          </SheetDescription>
        </VisuallyHidden>
        {/* Route Info Header */}
        <div className="border-b border-gray-100 dark:border-gray-800 relative">
          {/* Single Close Button */}
          <div className="absolute top-3 right-3 z-10">
            <SheetClose className="text-gray-400 hover:text-gray-500 transition-colors duration-150" ref={closeButtonRef}>
              <X size={18} />
            </SheetClose>
          </div>
          
          {hasRoute ? (
            <div className="px-4 py-4 pr-10">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-medium flex items-center">
                  Current Route
                  {isLocked && <Lock size={14} className="ml-2 text-yellow-600 dark:text-yellow-500" />}
                </h3>
                <div className={`text-xs px-2 py-0.5 rounded-full ${isLocked ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                  {isLocked ? "Locked" : "Active"}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                  <span className="truncate">{routeDistance}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                  <span className="truncate">{routeDuration}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-4 pr-10">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 text-amber-500 flex-shrink-0" />
                <h3 className="text-base font-medium">No Route Set</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Right-click on the map to add waypoints
              </p>
            </div>
          )}
        </div>
        
        <div className="px-4 overflow-y-auto max-h-[calc(100vh-100px)]">
          {/* Route History Controls */}
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-500 mb-2">Route History</div>
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="outline"
                onClick={onUndo}
                disabled={!canUndo || isLocked}
                className="flex-1 h-10 justify-center rounded-md"
              >
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m12 8-4 4 4 4" />
                  <path d="M16 12H8" />
                </svg>
                Undo
              </Button>
              
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={onToggleLock}
                      className="h-10 w-10 justify-center rounded-md p-0"
                    >
                      {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isLocked ? "Unlock route editing" : "Lock route editing"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <Button
                variant="outline"
                onClick={onRedo}
                disabled={!canRedo || isLocked}
                className="flex-1 h-10 justify-center rounded-md"
              >
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m12 16 4-4-4-4" />
                  <path d="M8 12h8" />
                </svg>
                Redo
              </Button>
            </div>
            
            <Button
              variant="outline"
              onClick={onReverseRoute}
              disabled={!hasRoute || isLocked}
              className={`w-full h-10 justify-center rounded-md mb-2 ${
                (!hasRoute || isLocked) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Reverse Route
            </Button>
            
            <Button
              variant="default"
              onClick={onReset}
              disabled={!hasRoute || isLocked}
              className={`w-full h-10 justify-center rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 mb-2 ${
                (!hasRoute || isLocked) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <X className="w-4 h-4 mr-2" />
              Reset Route
            </Button>

            <Button
              onClick={() => {
                // First close the sidebar using the ref
                if (closeButtonRef.current) {
                  closeButtonRef.current.click();
                }
                
                // Then open the modal after a small delay to ensure sidebar is closed
                setTimeout(() => {
                  onOpenRouteGenerator();
                }, 50);
              }}
              disabled={isLocked}
              className={`w-full h-10 justify-center rounded-md mb-2 text-white 
                         bg-gradient-to-r from-indigo-500 to-teal-400 
                         hover:from-indigo-600 hover:to-teal-500 
                         dark:from-indigo-600 dark:to-teal-500 
                         dark:hover:from-indigo-700 dark:hover:to-teal-600 
                         ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Route
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                onZoomToRoute();
                if (closeButtonRef.current) {
                  closeButtonRef.current.click();
                }
              }}
              disabled={!hasRoute}
              className={`w-full h-10 justify-center rounded-md mb-2 ${
                !hasRoute ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Focus className="w-4 h-4 mr-2" />
              Zoom to Route
            </Button>
          </div>
          
          <div className="mt-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Files & Sharing</div>
            
            <div className="space-y-1">
              <div 
                className={`flex items-center px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer`}
                onClick={handleExportGPX}
              >
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3">
                  <FileDown className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Export Route</div>
                  <div className="text-xs text-gray-500">Save as GPX</div>
                </div>
              </div>
              
              <div 
                className={`flex items-center px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`} 
                onClick={isLocked ? undefined : handleImportGPX}
              >
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mr-3">
                  <Upload className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Import Route</div>
                  <div className="text-xs text-gray-500">From GPX</div>
                </div>
              </div>
              
              {displayedShareUrl ? (
                <div className="px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <div className="text-sm font-medium mb-1">Shareable Link:</div>
                  <input 
                    type="text" 
                    readOnly 
                    value={displayedShareUrl} 
                    className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-0 focus:outline-none mb-2"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => onCopySharedUrl(displayedShareUrl)}
                    >
                      <Copy size={14} className="mr-1.5" /> Copy
                    </Button>
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={onClearShareDisplay}
                      className="p-1.5 rounded-md"
                    >
                      <BackIcon size={18} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="flex items-center px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                  onClick={onShare}
                >
                  <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 mr-3">
                    <Share2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Share Route</div>
                    <div className="text-xs text-gray-500">Create shareable link</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Account Section at the bottom */}
          <div className="mt-6 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-500 mb-2">Account</div>
            
            {isLoggedIn ? (
              <>
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-3">
                    <User size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium">John Doe</div>
                    <div className="text-xs text-gray-500">john.doe@example.com</div>
                  </div>
                </div>
                
                <div className="space-y-1 mt-2">
                  <Button
                    variant="outline" 
                    className="w-full h-9 justify-start text-sm rounded-md"
                    onClick={() => {}}
                    disabled
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Current Route
                  </Button>
                  
                  <Button
                    variant="outline" 
                    className="w-full h-9 justify-start text-sm rounded-md"
                    onClick={() => {}}
                    disabled
                  >
                    <BookMarked className="w-4 h-4 mr-2" />
                    My Saved Routes
                  </Button>
                  
                  <Button
                    variant="ghost" 
                    className="w-full h-9 justify-start text-sm rounded-md text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setIsLoggedIn(false)}
                  >
                    <LogIn className="w-4 h-4 mr-2 rotate-180" />
                    Sign Out
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Button 
                  variant="default"
                  className="w-full h-9 justify-center text-sm rounded-md opacity-50 cursor-not-allowed"
                  disabled
                  onClick={undefined}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
                <div className="text-center text-xs text-gray-500">
                  Sign in to save routes (Coming soon)
                </div>
              </div>
            )}
          </div>
          
          <div className="h-16"></div> {/* Spacer for footer */}
        </div>
        
        <div className="absolute bottom-3 inset-x-0 px-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Made by <a href="https://github.com/RobbeVerhelst" target="_blank" rel="noopener noreferrer" className="hover:underline">RobbeVerhelst</a>
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
} 