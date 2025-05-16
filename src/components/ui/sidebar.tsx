import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Menu, RotateCcw, Layers, User, Save, BookMarked, LogIn, Upload, Share2, FileDown, X, AlertCircle, MapPin, Clock } from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasRoute?: boolean;
  routeDistance?: string;
  routeDuration?: string;
}

export function Sidebar({
  onUndo,
  onRedo,
  onReset,
  canUndo,
  canRedo,
  hasRoute = false,
  routeDistance = '',
  routeDuration = ''
}: SidebarProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
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
              className="w-full h-10 justify-center rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Route
            </Button>
          </div>
          
          <div className="mt-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Files & Sharing</div>
            
            <div className="space-y-1">
              <div className="flex items-center px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer" onClick={() => {}}>
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3">
                  <FileDown className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Export Route</div>
                  <div className="text-xs text-gray-500">Save as GPX, KML or JSON</div>
                </div>
              </div>
              
              <div className="flex items-center px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer" onClick={() => {}}>
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mr-3">
                  <Upload className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Import Route</div>
                  <div className="text-xs text-gray-500">From GPX, KML or JSON</div>
                </div>
              </div>
              
              <div className="flex items-center px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer" onClick={() => {}}>
                <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 mr-3">
                  <Share2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Share Route</div>
                  <div className="text-xs text-gray-500">Create shareable link</div>
                </div>
              </div>
              
              <div className="flex items-center px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer" onClick={() => {}}>
                <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mr-3">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Map Layers</div>
                  <div className="text-xs text-gray-500">Coming soon</div>
                </div>
              </div>
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
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Current Route
                  </Button>
                  
                  <Button
                    variant="outline" 
                    className="w-full h-9 justify-start text-sm rounded-md"
                    onClick={() => {}}
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
                  className="w-full h-9 justify-center text-sm rounded-md bg-blue-600 hover:bg-blue-700"
                  onClick={() => setIsLoggedIn(true)}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
                <div className="text-center text-xs text-gray-500">
                  Sign in to save routes and access account features
                </div>
              </div>
            )}
          </div>
          
          <div className="h-16"></div> {/* Spacer for footer */}
        </div>
        
        <div className="absolute bottom-3 inset-x-0 px-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Made with ❤️ by RobbeVerhelst
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
} 