import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Menu, User, Save, BookMarked, LogIn, Upload, Share2, FileDown, X, AlertCircle, MapPin, Clock, Copy, RotateCcw as BackIcon } from "lucide-react";
import { useState } from "react";
import type { Map as MapboxMap } from 'mapbox-gl'; // Import MapboxMap type
import { exportRouteToGPX, importRouteFromGPX } from '../../lib/routing'; // Import GPX functions
import type { Dispatch, SetStateAction } from 'react';

interface SidebarProps {
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onShare: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasRoute?: boolean;
  routeDistance?: string;
  routeDuration?: string;
  // New props for GPX functionality
  map: MapboxMap | null;
  accessToken: string | undefined; // Can be undefined if not set
  setRouteDistance: Dispatch<SetStateAction<string>>;
  setRouteDuration: Dispatch<SetStateAction<string>>;
  setHasRoute: Dispatch<SetStateAction<boolean>>;
  onImportError: (message: string) => void;
  // Props for inline share display
  displayedShareUrl: string | null;
  setDisplayedShareUrl: (url: string | null) => void;
  onCopySharedUrl: (url: string) => void;
}

export function Sidebar({
  onUndo,
  onRedo,
  onReset,
  onShare,
  canUndo,
  canRedo,
  hasRoute = false,
  routeDistance = '',
  routeDuration = '',
  // Destructure new props
  map,
  accessToken,
  setRouteDistance,
  setRouteDuration,
  setHasRoute,
  onImportError,
  displayedShareUrl,
  setDisplayedShareUrl,
  onCopySharedUrl,
}: SidebarProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const handleExportGPX = () => {
    exportRouteToGPX();
  };

  const handleImportGPX = () => {
    if (!map || !accessToken) {
      onImportError("Map or access token is not available for import.");
      console.error("Map instance or accessToken not available for GPX import.");
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
            console.error("Error processing GPX file:", error);
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
        <Button variant="ghost" size="icon" className="bg-white/90 dark:bg-black/80 hover:bg-white/70 dark:hover:bg-black/60 shadow-sm">
          <Menu size={20} />
        </Button>
      </SheetTrigger>
      <SheetContent className="p-0 w-[330px] border-l" hideCloseButton>
        {/* Route Info Header */}
        <div className="border-b border-gray-100 dark:border-gray-800 relative">
          {/* Single Close Button */}
          <div className="absolute top-3 right-3 z-10">
            <SheetClose className="text-gray-400 hover:text-gray-500 transition-colors duration-150">
              <X size={18} />
            </SheetClose>
          </div>
          
          {hasRoute ? (
            <div className="px-4 py-4 pr-10">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-medium">Current Route</h3>
                <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full">
                  Active
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
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Button
                variant="outline"
                onClick={onUndo}
                disabled={!canUndo}
                className="h-10 justify-center rounded-md"
              >
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m12 8-4 4 4 4" />
                  <path d="M16 12H8" />
                </svg>
                Undo
              </Button>
              
              <Button
                variant="outline"
                onClick={onRedo}
                disabled={!canRedo}
                className="h-10 justify-center rounded-md"
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
              variant="default"
              onClick={onReset}
              disabled={!hasRoute}
              className={`w-full h-10 justify-center rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 ${
                !hasRoute ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <X className="w-4 h-4 mr-2" />
              Reset Route
            </Button>
          </div>
          
          <div className="mt-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Files & Sharing</div>
            
            <div className="space-y-1">
              <div className="flex items-center px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer" onClick={handleExportGPX}>
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3">
                  <FileDown className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Export Route</div>
                  <div className="text-xs text-gray-500">Save as GPX</div>
                </div>
              </div>
              
              <div className="flex items-center px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer" onClick={handleImportGPX}>
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
                      onClick={() => setDisplayedShareUrl(null)}
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