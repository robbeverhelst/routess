import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  Copy,
  ArrowRightLeft,
  Focus,
  Lock,
  Unlock,
  Save,
  BookMarked,
  Settings,
  RotateCcw,
  RotateCw,
  Globe,
  Sun,
  Trash2,
} from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import React, { useState, useRef, useCallback, Suspense } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { GB, NL, FR, DE } from "country-flag-icons/react/3x2";
import { exportRouteToGPX, importRouteFromGPX } from "../../lib/routing";
import { t } from "../../lib/i18n";
import type { SupportedLanguage } from "../../lib/i18n";
import type { Dispatch, SetStateAction } from "react";
import { Logger } from "../../lib/logger";
import { LoginModal } from "../auth/LoginModal";
import { googleAuth } from "../../lib/google-auth";
import { useAuthState } from "@/hooks/useAuthState";
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
  showSunDirection: boolean;
  onToggleSunDirection: (enabled: boolean) => void;
  onOpenRouteLibrary: () => void;
  onSaveRoute: () => void;
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
  routeDistance = "",
  routeDuration = "",
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
  onOpenRouteGenerator, // Disabled feature but still in props
  currentLanguage,
  onLanguageChange,
  showSunDirection,
  onToggleSunDirection,
  onOpenRouteLibrary,
  onSaveRoute,
}: SidebarProps) {
  // Disabled feature - not using onOpenRouteGenerator
  void onOpenRouteGenerator;
  // Use reactive auth state hook
  const authState = useAuthState();
  const isLoggedIn = authState.isAuthenticated;
  const currentUser = authState.user;

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isLangPopoverOpen, setIsLangPopoverOpen] = useState(false);

  const baseLanguages: Array<{
    code: SupportedLanguage;
    name: string;
    label: string;
    icon: React.ElementType;
  }> = [
    { code: "en", name: "English", label: "EN", icon: GB },
    { code: "nl", name: "Nederlands", label: "NL", icon: NL },
    { code: "fr", name: "Français", label: "FR", icon: FR },
    { code: "de", name: "Deutsch", label: "DE", icon: DE },
  ];

  const getPrioritizedLanguages = () => {
    let browserLangCode: SupportedLanguage | undefined;
    if (typeof navigator !== "undefined" && navigator.language) {
      const primaryBrowserLang = navigator.language
        .split("-")[0]
        .toLowerCase() as SupportedLanguage;
      if (baseLanguages.some((lang) => lang.code === primaryBrowserLang)) {
        browserLangCode = primaryBrowserLang;
      }
    }

    if (browserLangCode) {
      const browserLangObj = baseLanguages.find((lang) => lang.code === browserLangCode);
      if (browserLangObj) {
        return [browserLangObj, ...baseLanguages.filter((lang) => lang.code !== browserLangCode)];
      }
    }
    return baseLanguages;
  };

  const languages = getPrioritizedLanguages();

  const selectedLanguageDetails =
    languages.find((lang) => lang.code === currentLanguage) || languages[0];

  // Memoize event handlers to prevent unnecessary re-renders
  const handleLanguageChange = useCallback(
    (langCode: SupportedLanguage) => {
      onLanguageChange(langCode);
      setIsLangPopoverOpen(false);
    },
    [onLanguageChange],
  );

  const handleExportGPX = useCallback(() => {
    const result = exportRouteToGPX();
    if (!result.success && result.message) {
      onImportError(result.message); // Reusing onImportError for feedback
    } else if (result.success) {
      Logger.info("Route exported successfully."); // Placeholder for success feedback
      // onImportError("Route exported successfully."); // Or use the same feedback for success
    }
  }, [onImportError]);

  const handleImportGPX = useCallback(() => {
    if (!map || !accessToken) {
      onImportError("Map or access token is not available for import.");
      Logger.error("Map instance or accessToken not available for GPX import.");
      return;
    }

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".gpx";
    fileInput.style.display = "none";

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
              onImportError,
            );
          } catch (error) {
            Logger.error("Error processing GPX file:", error);
            onImportError(
              error instanceof Error
                ? error.message
                : "An unknown error occurred during GPX import.",
            );
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
  }, [map, accessToken, onImportError, setRouteDistance, setRouteDuration, setHasRoute]);

  const handleLoginSuccess = useCallback(() => {
    // Auth state will be automatically updated by the reactive hook
    Logger.info("Login successful");
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await googleAuth.signOut();
      // Auth state will be automatically updated by the reactive hook
      Logger.info("User signed out successfully");
    } catch (error) {
      Logger.error("Sign out failed:", error);
    }
  }, []);

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="bg-white/90 dark:bg-black/80 hover:bg-white/70 dark:hover:bg-black/60 shadow-sm h-10 w-10"
          >
            <Menu size={20} />
          </Button>
        </SheetTrigger>
        <SheetContent className="p-0 w-[320px] border-l flex flex-col" hideCloseButton>
          <VisuallyHidden asChild>
            <SheetTitle>{t("sidebar.menuTitle", currentLanguage)}</SheetTitle>
          </VisuallyHidden>
          <VisuallyHidden asChild>
            <SheetDescription>{t("sidebar.menuDescription", currentLanguage)}</SheetDescription>
          </VisuallyHidden>

          {/* Header Section */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Routes</h2>
            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full p-0 overflow-hidden"
                    onClick={() => setIsSettingsModalOpen(true)}
                  >
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                      <User size={14} />
                    </div>
                  </Button>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-900"></div>
                </div>
              )}
              <SheetClose
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                ref={closeButtonRef}
              >
                <X size={20} />
              </SheetClose>
            </div>
          </div>

          {/* Route Status Card */}
          <div className="border-b border-gray-200 dark:border-gray-800">
            {hasRoute ? (
              <div className="px-6 py-5 bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {t("sidebar.currentRoute", currentLanguage)}
                    </span>
                  </div>
                  {isLocked && <Lock size={16} className="text-amber-600 dark:text-amber-400" />}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {routeDistance}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">•</span>
                  <span className="text-gray-700 dark:text-gray-300">{routeDuration}</span>
                  {isLocked && (
                    <>
                      <span className="text-gray-400 dark:text-gray-500">•</span>
                      <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                        {t("sidebar.locked", currentLanguage)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-6 py-5 bg-gray-50 dark:bg-gray-900/50">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {t("sidebar.noRouteSet", currentLanguage)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t("sidebar.addWaypointsHelp", currentLanguage)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Quick Actions Section */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Quick Actions
              </h3>
              <TooltipProvider>
                <div className="grid grid-cols-3 gap-2">
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={onUndo}
                        disabled={!canUndo || isLocked}
                        className="h-14 w-full justify-center rounded-xl p-0 transition-all hover:scale-105"
                      >
                        <RotateCcw size={20} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("sidebar.undo", currentLanguage)}</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={onToggleLock}
                        className={`h-12 w-full justify-center rounded-lg p-0 transition-all ${
                          isLocked
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/40 border-amber-300 dark:border-amber-700"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {isLocked
                          ? t("sidebar.tooltip.unlockRoute", currentLanguage)
                          : t("sidebar.tooltip.lockRoute", currentLanguage)}
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={onRedo}
                        disabled={!canRedo || isLocked}
                        className="h-14 w-full justify-center rounded-xl p-0 transition-all hover:scale-105"
                      >
                        <RotateCw size={20} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("sidebar.redo", currentLanguage)}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Button
                    variant="outline"
                    onClick={onReverseRoute}
                    disabled={!hasRoute || isLocked}
                    className="h-12 justify-center rounded-xl transition-all font-medium"
                  >
                    <ArrowRightLeft size={18} className="mr-3" />
                    {t("sidebar.reverseRoute", currentLanguage)}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={onZoomToRoute}
                    disabled={!hasRoute}
                    className="h-12 justify-center rounded-xl transition-all font-medium"
                  >
                    <Focus size={18} className="mr-3" />
                    {t("sidebar.zoomToRoute", currentLanguage)}
                  </Button>
                </div>
              </TooltipProvider>
            </div>

            {/* Route Management Section */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Route Management
              </h3>
              <div className="space-y-3">
                <TooltipProvider>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <span className="w-full">
                        <Button
                          variant="outline"
                          disabled={!isLoggedIn || !hasRoute}
                          onClick={onSaveRoute}
                          className="w-full h-12 justify-start rounded-xl transition-all font-medium"
                        >
                          <Save size={18} className="mr-3" />
                          {t("auth.feature.saveRoute", currentLanguage)}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {!isLoggedIn
                          ? t("auth.tooltip.loginRequired", currentLanguage)
                          : !hasRoute
                            ? t("auth.tooltip.createRouteFirst", currentLanguage)
                            : t("routeControls.tooltip.saveRoute", currentLanguage)}
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <span className="w-full">
                        <Button
                          variant="outline"
                          disabled={!isLoggedIn}
                          onClick={onOpenRouteLibrary}
                          className="w-full h-12 justify-start rounded-xl transition-all font-medium"
                        >
                          <BookMarked size={18} className="mr-3" />
                          {t("auth.feature.myRoutes", currentLanguage)}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {isLoggedIn
                          ? t("routeLibrary.tooltip", currentLanguage)
                          : t("auth.tooltip.loginRequired", currentLanguage)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Import/Export Section */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Import/Export
              </h3>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={handleExportGPX}
                  disabled={!hasRoute}
                  className="w-full h-10 justify-start rounded-lg transition-all"
                >
                  <FileDown size={18} className="mr-3" />
                  {t("sidebar.exportRoute", currentLanguage)}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleImportGPX}
                  disabled={isLocked}
                  className="w-full h-10 justify-start rounded-lg transition-all"
                >
                  <Upload size={18} className="mr-3" />
                  {t("sidebar.importRoute", currentLanguage)}
                </Button>

                {displayedShareUrl ? (
                  <div className="mt-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <div className="text-sm font-medium mb-2">
                      {t("sidebar.shareableLink", currentLanguage)}
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={displayedShareUrl}
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-0 focus:outline-none mb-3"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-sm"
                        onClick={() => onCopySharedUrl(displayedShareUrl)}
                      >
                        <Copy size={14} className="mr-1.5" /> {t("sidebar.copy", currentLanguage)}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClearShareDisplay}
                        className="p-1.5 h-9 w-9"
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={onShare}
                    disabled={!hasRoute}
                    className="w-full h-10 justify-start rounded-lg transition-all"
                  >
                    <Share2 size={18} className="mr-3" />
                    {t("sidebar.shareRoute", currentLanguage)}
                  </Button>
                )}
              </div>
            </div>

            {/* Settings Section */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Settings
              </h3>
              <div className="space-y-3">
                <Popover open={isLangPopoverOpen} onOpenChange={setIsLangPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="w-full h-12 px-4 flex items-center justify-between rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-center">
                        <Globe size={18} className="mr-3 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm">{selectedLanguageDetails.name}</span>
                      </div>
                      <selectedLanguageDetails.icon className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" side="right" align="start">
                    <div className="flex flex-col space-y-1">
                      {languages.map((lang) => {
                        const FlagIcon = lang.icon;
                        return (
                          <Button
                            key={lang.code}
                            variant={currentLanguage === lang.code ? "default" : "ghost"}
                            size="sm"
                            className="w-full justify-start h-8 px-2 flex items-center space-x-2"
                            onClick={() => handleLanguageChange(lang.code)}
                          >
                            <FlagIcon title={lang.name} className="h-4 w-4 flex-shrink-0" />
                            <span>{lang.name}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                <button
                  className="w-full h-12 px-4 flex items-center justify-between rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => onToggleSunDirection(!showSunDirection)}
                >
                  <div className="flex items-center">
                    <Sun size={18} className="mr-3 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm">{t("settings.sunDirection", currentLanguage)}</span>
                  </div>
                  <div
                    className={`w-9 h-5 rounded-full transition-colors ${
                      showSunDirection
                        ? "bg-blue-600 dark:bg-blue-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${
                        showSunDirection ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </button>

                {isLoggedIn && (
                  <Button
                    variant="outline"
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="w-full h-10 justify-start rounded-lg transition-all"
                  >
                    <Settings size={18} className="mr-3" />
                    {t("sidebar.moreSettings", currentLanguage)}
                  </Button>
                )}
              </div>
            </div>

            {/* Account Section */}
            <div className="px-6 py-5">
              <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Account
              </h3>

              {isLoggedIn ? (
                <div className="space-y-3">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <div className="relative mr-3">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                            <User size={18} />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {currentUser?.name || "User"}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {currentUser?.email}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="w-full h-12 justify-center rounded-xl transition-all text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800 font-medium"
                  >
                    <LogIn className="w-4 h-4 rotate-180 mr-3" />
                    {t("sidebar.signOut", currentLanguage)}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    variant="default"
                    className="w-full h-12 justify-center text-base rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    onClick={() => setIsLoginModalOpen(true)}
                  >
                    <LogIn className="w-4 h-4 mr-3" />
                    {t("sidebar.signIn", currentLanguage)}
                  </Button>
                  <div className="text-center text-xs text-gray-500">
                    {t("sidebar.signInToSave", currentLanguage)}
                  </div>
                </div>
              )}
            </div>

            {/* Danger Zone - always at bottom */}
            <div className="px-6 py-5 mt-auto border-t border-gray-200 dark:border-gray-800 bg-red-50/50 dark:bg-red-950/20">
              <Button
                variant="outline"
                onClick={onReset}
                disabled={!hasRoute || isLocked}
                className="w-full h-12 justify-center rounded-xl transition-all text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border-red-300 dark:border-red-800 font-medium"
              >
                <Trash2 size={18} className="mr-3" />
                {t("sidebar.resetRoute", currentLanguage)}
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              {t("footer.madeBy", currentLanguage)}{" "}
              <a
                href={
                  currentLanguage === "nl"
                    ? "https://robbeverhelst.be"
                    : "https://robbeverhelst.com"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline text-gray-700 dark:text-gray-300"
              >
                Robbe Verhelst
              </a>
            </p>
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
      <Suspense
        fallback={<div className="flex items-center justify-center p-4">Loading settings...</div>}
      >
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onOpenChange={setIsSettingsModalOpen}
          currentLanguage={currentLanguage}
          onLanguageChange={onLanguageChange}
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          showSunDirection={showSunDirection}
          onToggleSunDirection={onToggleSunDirection}
        />
      </Suspense>
    </>
  );
}
