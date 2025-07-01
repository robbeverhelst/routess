import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CacheManager } from "@/components/ui/cache-manager";
import { t } from "@/lib/i18n";
import type { SupportedLanguage } from "@/lib/i18n";
import {
  getVersionDisplay,
  getStoredVersionInfo,
  checkVersionChange,
  formatVersion,
} from "@/lib/version";
import { Settings } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { isDev } from "@/lib/utils/env";
import React from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  isLoggedIn: boolean;
  currentUser?: { name?: string; email?: string } | null;
  showSunDirection: boolean;
  onToggleSunDirection: (enabled: boolean) => void;
}

export function SettingsModal({
  isOpen,
  onOpenChange,
  currentLanguage,
  onLanguageChange,
  isLoggedIn,
  currentUser,
  showSunDirection,
  onToggleSunDirection,
}: SettingsModalProps) {
  const { showErrorToasts, setShowErrorToasts } = useSettingsStore();

  // Check for version changes when modal opens
  React.useEffect(() => {
    if (isOpen) {
      checkVersionChange();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-h-[80vh] p-0 w-[95vw] sm:w-full">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t("settings.title", currentLanguage)}
          </DialogTitle>
          <DialogDescription className="hidden sm:block">
            {t("settings.description", currentLanguage)}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-8">
            {/* Preferences Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                {t("settings.general", currentLanguage)}
              </h2>

              <div className="space-y-6">
                {/* Language */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    {t("settings.language", currentLanguage)}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { code: "en" as SupportedLanguage, name: "English" },
                      { code: "nl" as SupportedLanguage, name: "Nederlands" },
                      { code: "fr" as SupportedLanguage, name: "Français" },
                      { code: "de" as SupportedLanguage, name: "Deutsch" },
                    ].map((lang) => (
                      <Button
                        key={lang.code}
                        variant={currentLanguage === lang.code ? "default" : "outline"}
                        size="sm"
                        onClick={() => onLanguageChange(lang.code)}
                        className="justify-center h-10"
                      >
                        {lang.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Sun Direction */}
                <div>
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={showSunDirection}
                      onChange={(e) => onToggleSunDirection(e.target.checked)}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 h-4 w-4"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Sun Direction Indicator
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Show sun direction on the map to help plan routes based on sunlight
                      </div>
                    </div>
                  </label>
                </div>

                {/* Error Notifications */}
                <div>
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={showErrorToasts}
                      onChange={(e) => setShowErrorToasts(e.target.checked)}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 h-4 w-4"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Error Notifications
                        {isDev() && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                            (Dev mode)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Show error notifications for debugging
                        {isDev() && (
                          <span className="text-gray-400"> (recommended for development)</span>
                        )}
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Storage Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                {t("settings.storage", currentLanguage)}
              </h2>

              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  {t("settings.offlineStorage", currentLanguage)}
                </h3>
                <CacheManager currentLanguage={currentLanguage} />
              </div>
            </div>

            {/* Account Section */}
            {isLoggedIn && currentUser && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                  {t("settings.account", currentLanguage)}
                </h2>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                      Name
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {currentUser.name || "User"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                      Email
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {currentUser.email || "No email"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                      Account Type
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">Google Account</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                      Status
                    </div>
                    <div className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                      ● Connected
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* About Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                {t("settings.about", currentLanguage)}
              </h2>

              <div className="space-y-6">
                {/* Version */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    {t("settings.version", currentLanguage)}
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {getVersionDisplay()}
                    </div>
                    {(() => {
                      const versionInfo = getStoredVersionInfo();
                      if (versionInfo?.previous) {
                        return (
                          <div className="text-xs text-gray-500 mt-1">
                            {t("settings.previousVersion", currentLanguage)}:{" "}
                            {formatVersion(versionInfo.previous)}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {/* App Info */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Maps Application
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    A modern route planning and navigation tool
                  </p>
                  <p className="text-xs text-gray-500">Built with React, TypeScript, and Mapbox</p>
                </div>

                {/* Developer */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Developer
                  </h3>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Created by{" "}
                      <span className="font-medium text-gray-900 dark:text-white">
                        robbeverhelst
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={
                          currentLanguage === "nl"
                            ? "https://robbeverhelst.be"
                            : "https://robbeverhelst.com"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        {t("settings.visitWebsite", currentLanguage)}
                      </a>
                      <a
                        href="https://github.com/robbeverhelst"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        {t("settings.viewGithub", currentLanguage)}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
