import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { 
  Menu, 
  User, 
  LogIn, 
  Upload, 
  Share2, 
  FileDown, 
  X, 
  AlertCircle, 
  MapPin, 
  Clock, 
  Copy, 
  ArrowRightLeft, 
  Focus, 
  Wand2, 
  Lock, 
  Unlock, 
  Save, 
  BookMarked, 
  Settings,
  ArrowLeft as BackIcon
} from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useState, useRef, useEffect } from "react";
import type { Map as MapboxMap } from 'mapbox-gl';
import { GB, NL, FR, DE } from 'country-flag-icons/react/3x2';
import { exportRouteToGPX, importRouteFromGPX } from '../../lib/routing';
import { t } from '../../lib/i18n';
import type { SupportedLanguage } from '../../lib/i18n';
import type { Dispatch, SetStateAction } from 'react';
import { Logger } from '../../lib/logger';
import { LoginModal } from '../auth/login-modal';
import { googleAuth, type GoogleUser } from '../../lib/google-auth';
import { SettingsModal } from "@/components/ui/settings-modal";

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
  currentLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
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
  currentLanguage,
  onLanguageChange
}: SidebarProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<GoogleUser | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isLangPopoverOpen, setIsLangPopoverOpen] = useState(false);

  // Check authentication state on mount
  useEffect(() => {
    const authState = googleAuth.getAuthState();
    setIsLoggedIn(authState.isAuthenticated);
    setCurrentUser(authState.user);
  }, []);

  const baseLanguages: Array<{ code: SupportedLanguage; name: string; label: string; icon: React.ElementType }> = [
    { code: 'en', name: 'English', label: 'EN', icon: GB },
    { code: 'nl', name: 'Nederlands', label: 'NL', icon: NL },
    { code: 'fr', name: 'Français', label: 'FR', icon: FR },
    { code: 'de', name: 'Deutsch', label: 'DE', icon: DE },
  ];

  const getPrioritizedLanguages = () => {
    let browserLangCode: SupportedLanguage | undefined;
    if (typeof navigator !== 'undefined' && navigator.language) {
      const primaryBrowserLang = navigator.language.split('-')[0].toLowerCase() as SupportedLanguage;
      if (baseLanguages.some(lang => lang.code === primaryBrowserLang)) {
        browserLangCode = primaryBrowserLang;
      }
    }

    if (browserLangCode) {
      const browserLangObj = baseLanguages.find(lang => lang.code === browserLangCode);
      if (browserLangObj) {
        return [browserLangObj, ...baseLanguages.filter(lang => lang.code !== browserLangCode)];
      }
    }
    return baseLanguages;
  };

  const languages = getPrioritizedLanguages();

  const selectedLanguageDetails = languages.find(lang => lang.code === currentLanguage) || languages[0];

  const handleLanguageChange = (langCode: SupportedLanguage) => {
    onLanguageChange(langCode);
    setIsLangPopoverOpen(false);
  };
  
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

  const handleLoginSuccess = () => {
    const authState = googleAuth.getAuthState();
    setIsLoggedIn(authState.isAuthenticated);
    setCurrentUser(authState.user);
  };

  const handleSignOut = async () => {
    try {
      await googleAuth.signOut();
      setIsLoggedIn(false);
      setCurrentUser(null);
      Logger.info('User signed out successfully');
    } catch (error) {
      Logger.error('Sign out failed:', error);
    }
  };
  
  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="bg-white/90 dark:bg-black/80 hover:bg-white/70 dark:hover:bg-black/60 shadow-sm h-10 w-10">
            <Menu size={20} />
          </Button>
        </SheetTrigger>
        <SheetContent className="p-0 w-[280px] border-l" hideCloseButton>
          <VisuallyHidden asChild>
            <SheetTitle>{t('sidebar.menuTitle', currentLanguage)}</SheetTitle>
          </VisuallyHidden>
          <VisuallyHidden asChild>
            <SheetDescription>
              {t('sidebar.menuDescription', currentLanguage)}
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
                    {t('sidebar.currentRoute', currentLanguage)}
                    {isLocked && <Lock size={14} className="ml-2 text-yellow-600 dark:text-yellow-500" />}
                  </h3>
                  <div className={`text-xs px-2 py-0.5 rounded-full ${isLocked ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                    {isLocked ? t('sidebar.locked', currentLanguage) : t('sidebar.active', currentLanguage)}
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
                  <h3 className="text-base font-medium">{t('sidebar.noRouteSet', currentLanguage)}</h3>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  {t('sidebar.addWaypointsHelp', currentLanguage)}
                </p>
              </div>
            )}
          </div>
          
          <div className="px-4 overflow-y-auto max-h-[calc(100vh-100px)]">
            {/* Route History Controls */}
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-500 mb-2">{t('sidebar.routeActions', currentLanguage)}</div>
              <TooltipProvider>
                <div className="flex items-center gap-2 mb-2">
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={onUndo}
                        disabled={!canUndo || isLocked}
                        className="flex-1 h-10 justify-center rounded-md p-0"
                      >
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="m12 8-4 4 4 4" />
                          <path d="M16 12H8" />
                        </svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('sidebar.undo', currentLanguage)}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={onToggleLock}
                        className={`flex-1 h-10 justify-center rounded-md p-0 ${
                          isLocked
                            ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/40'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isLocked ? t('sidebar.tooltip.unlockRoute', currentLanguage) : t('sidebar.tooltip.lockRoute', currentLanguage)}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={onRedo}
                        disabled={!canRedo || isLocked}
                        className="flex-1 h-10 justify-center rounded-md p-0"
                      >
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="m12 16 4-4-4-4" />
                          <path d="M8 12h8" />
                        </svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('sidebar.redo', currentLanguage)}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              
                <Button
                  variant="default"
                  onClick={onReset}
                  disabled={!hasRoute || isLocked}
                  className={`w-full h-10 justify-center rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 mb-2 ${
                    (!hasRoute || isLocked) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <X className="w-4 h-4 mr-2" />
                  {t('sidebar.resetRoute', currentLanguage)}
                </Button>

                <Button
                  variant="outline"
                  onClick={onReverseRoute}
                  disabled={!hasRoute || isLocked}
                  className={`w-full h-10 justify-center rounded-md mb-2 ${ 
                    (!hasRoute || isLocked) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  {t('sidebar.reverseRoute', currentLanguage)}
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
                  {t('sidebar.generateRoute', currentLanguage)}
                </Button>

                <Button
                  variant="outline"
                  onClick={onZoomToRoute}
                  disabled={!hasRoute}
                  className={`w-full h-10 justify-center rounded-md mb-2 ${
                    !hasRoute ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Focus className="w-4 h-4 mr-2" />
                  {t('sidebar.zoomToRoute', currentLanguage)}
                </Button>

                {/* Route-related user actions - always visible */}
                {!isLoggedIn ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <span className="w-full">
                        <Button
                          variant="outline"
                          onClick={isLoggedIn ? () => {} : undefined}
                          disabled={!hasRoute || !isLoggedIn}
                          className={`w-full h-10 justify-center rounded-md mb-2 ${
                            !hasRoute || !isLoggedIn 
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {t('auth.feature.saveRoute', currentLanguage)}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('auth.tooltip.loginRequired', currentLanguage)}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {}}
                    disabled={!hasRoute}
                    className={`w-full h-10 justify-center rounded-md mb-2 ${
                      !hasRoute 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {t('auth.feature.saveRoute', currentLanguage)}
                  </Button>
                )}

                {!isLoggedIn ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <span className="w-full">
                        <Button
                          variant="outline"
                          onClick={isLoggedIn ? () => {} : undefined}
                          disabled={!isLoggedIn}
                          className={`w-full h-10 justify-center rounded-md mb-2 ${
                            !isLoggedIn 
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <BookMarked className="w-4 h-4 mr-2" />
                          {t('auth.feature.myRoutes', currentLanguage)}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('auth.tooltip.loginRequired', currentLanguage)}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {}}
                    className="w-full h-10 justify-center rounded-md mb-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <BookMarked className="w-4 h-4 mr-2" />
                    {t('auth.feature.myRoutes', currentLanguage)}
                  </Button>
                )}
              </TooltipProvider>
            </div>
            
            <div className="mt-6">
              <div className="text-sm font-medium text-gray-500 mb-2">{t('sidebar.filesAndSharing', currentLanguage)}</div>
              
              <div className="space-y-1">
                <div 
                  className={`flex items-center px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer`}
                  onClick={handleExportGPX}
                >
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3">
                    <FileDown className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{t('sidebar.exportRoute', currentLanguage)}</div>
                    <div className="text-xs text-gray-500">{t('sidebar.saveAsGpx', currentLanguage)}</div>
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
                    <div className="text-sm font-medium">{t('sidebar.importRoute', currentLanguage)}</div>
                    <div className="text-xs text-gray-500">{t('sidebar.fromGpx', currentLanguage)}</div>
                  </div>
                </div>
                
                {displayedShareUrl ? (
                  <div className="px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <div className="text-sm font-medium mb-1">{t('sidebar.shareableLink', currentLanguage)}</div>
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
                        <Copy size={14} className="mr-1.5" /> {t('sidebar.copy', currentLanguage)}
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
                      <div className="text-sm font-medium">{t('sidebar.shareRoute', currentLanguage)}</div>
                      <div className="text-xs text-gray-500">{t('sidebar.createShareableLink', currentLanguage)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Account Section at the bottom */}
            <div className="mt-6 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div className="text-sm font-medium text-gray-500 mb-2">{t('sidebar.account', currentLanguage)}</div>
              
              {isLoggedIn ? (
                <>
                  {/* Minimal User Bar */}
                  <div className="flex items-center justify-between mb-3 px-2 py-1 bg-blue-50/50 dark:bg-blue-900/10 rounded-md">
                    <div className="flex items-center">
                      <div className="relative mr-2">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                          <User size={10} />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-white dark:border-gray-900"></div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-900 dark:text-white">
                          {currentUser?.name || 'User'}
                        </div>
                        <div className="text-[9px] text-blue-600 dark:text-blue-400">
                          {currentUser?.email || 'Premium'}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-gray-400 hover:text-red-500 rounded-full"
                      onClick={handleSignOut}
                    >
                      <LogIn className="w-3 h-3 rotate-180" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Button 
                    variant="default"
                    className="w-full h-9 justify-center text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setIsLoginModalOpen(true)}
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    {t('sidebar.signIn', currentLanguage)}
                  </Button>
                  <div className="text-center text-xs text-gray-500">
                    {t('sidebar.signInToSave', currentLanguage)}
                  </div>
                </div>
              )}
            </div>
            
            <div className="h-16"></div> {/* Spacer for footer */}
          </div>
          
          {/* MODIFIED Footer with language button and background */}
          <div className="absolute bottom-0 inset-x-0 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-black/70 backdrop-blur-sm">
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              {/* Left side with settings icon */}
              <div className="flex-1 flex justify-start">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md"
                  onClick={() => setIsSettingsModalOpen(true)}
                >
                  <Settings size={12} />
                </Button>
              </div>
              
              {/* Centered "Made by" text */}
              <p className="text-center flex-shrink-0 flex items-center">
                {t('footer.madeBy', currentLanguage)} <a href="https://github.com/RobbeVerhelst" target="_blank" rel="noopener noreferrer" className="hover:underline">RobbeVerhelst</a>
              </p>
              
              {/* Right-aligned language popover */}
              <div className="flex-1 flex justify-end">
                <Popover open={isLangPopoverOpen} onOpenChange={setIsLangPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-auto px-2 flex items-center rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
                    >
                      <selectedLanguageDetails.icon title={selectedLanguageDetails.name} className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-auto p-1 mb-1 z-50 pointer-events-auto"
                    side="top" 
                    align="end"
                  >
                    <div className="flex flex-col space-y-1">
                      {languages.map((lang) => {
                        const FlagIcon = lang.icon;
                        return (
                          <Button
                            key={lang.code}
                            variant={currentLanguage === lang.code ? 'default' : 'ghost'}
                            size="sm"
                            className={`w-full justify-start h-8 px-2 flex items-center space-x-2 rounded-md transition-colors 
                              ${
                                currentLanguage === lang.code
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-200 font-medium hover:bg-blue-200 dark:hover:bg-blue-600'
                                  : 'text-gray-900 dark:text-white'
                              }
                            `}
                            onClick={() => {
                              handleLanguageChange(lang.code);
                            }}
                          >
                            <FlagIcon title={lang.name} className="h-4 w-4 flex-shrink-0" />
                            <span>{lang.name}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* External Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onOpenChange={setIsLoginModalOpen}
        onLoginSuccess={handleLoginSuccess}
        currentLanguage={currentLanguage}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onOpenChange={setIsSettingsModalOpen}
        currentLanguage={currentLanguage}
        onLanguageChange={onLanguageChange}
        isLoggedIn={isLoggedIn}
        currentUser={currentUser}
      />
    </>
  );
} 
