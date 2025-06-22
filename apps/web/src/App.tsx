import { GoogleOAuthProvider } from "@react-oauth/google";
import { useEffect, useState } from "react";
import MapWithRouting from "@/components/MapWithRouting";
import { googleAuth } from "@/lib/google-auth";
import { useVersionDetection } from "@/hooks/use-version-detection";
import { formatVersion } from "@/lib/version";
import { t, type SupportedLanguage } from "@/lib/i18n";

function App() {
  const versionState = useVersionDetection();
  const [showVersionNotification, setShowVersionNotification] = useState(false);

  // Get current language from localStorage or default to English
  const currentLanguage: SupportedLanguage =
    (localStorage.getItem("maps-language") as SupportedLanguage) || "en";

  useEffect(() => {
    // Handle PWA shortcut URLs
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");

    if (action) {
      // Small delay to ensure the map component is mounted
      setTimeout(() => {
        switch (action) {
          case "new-route":
            // Trigger route generator modal
            window.dispatchEvent(
              new CustomEvent("pwa-shortcut", { detail: { action: "new-route" } }),
            );
            break;
          case "locate":
            // Trigger location finding
            window.dispatchEvent(new CustomEvent("pwa-shortcut", { detail: { action: "locate" } }));
            break;
          case "import":
            // Trigger GPX import
            window.dispatchEvent(new CustomEvent("pwa-shortcut", { detail: { action: "import" } }));
            break;
        }

        // Clean up URL after handling
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }, 500);
    }
  }, []);

  // Show version change notification
  useEffect(() => {
    if (versionState.hasChanged && versionState.previousVersion) {
      setShowVersionNotification(true);

      // Keep notification visible longer if caches are being cleared
      const duration = versionState.isClearingCaches ? 8000 : 5000;

      const timer = setTimeout(() => {
        setShowVersionNotification(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [
    versionState.hasChanged,
    versionState.previousVersion,
    versionState.isClearingCaches,
    versionState.cachesClearedSuccessfully,
  ]);

  const getNotificationContent = () => {
    if (versionState.isClearingCaches) {
      return {
        title: t("version.notification.updating", currentLanguage),
        message: t("version.notification.clearingCache", currentLanguage),
        bgColor: "#3b82f6", // Blue for processing
        showSpinner: true,
      };
    }

    if (versionState.error) {
      return {
        title: t("version.notification.updatedWithWarning", currentLanguage),
        message: `${formatVersion(versionState.currentVersion)} ${t("version.notification.cacheWarning", currentLanguage)}`,
        bgColor: "#f59e0b", // Orange for warning
        showSpinner: false,
      };
    }

    if (versionState.cachesClearedSuccessfully) {
      return {
        title: t("version.notification.updatedAndRefreshed", currentLanguage),
        message: formatVersion(versionState.currentVersion),
        bgColor: "#10b981", // Green for success
        showSpinner: false,
      };
    }

    return {
      title: t("version.notification.updated", currentLanguage),
      message: formatVersion(versionState.currentVersion),
      bgColor: "#10b981", // Green for success
      showSpinner: false,
    };
  };

  return (
    <GoogleOAuthProvider clientId={googleAuth.getClientId()}>
      <div className="w-full h-svh">
        <MapWithRouting height="100%" width="100%" />

        {/* Version change notification */}
        {showVersionNotification && (
          <div
            style={{
              position: "fixed",
              top: "20px",
              right: "20px",
              background: getNotificationContent().bgColor,
              color: "white",
              padding: "12px 20px",
              borderRadius: "8px",
              zIndex: 1000,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              maxWidth: "320px",
            }}
          >
            <div className="flex items-center gap-3">
              {getNotificationContent().showSpinner && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              )}
              <div className="flex-1">
                <div className="font-medium mb-1">{getNotificationContent().title}</div>
                <div className="text-sm opacity-90">
                  {getNotificationContent().message}
                  {versionState.previousVersion && !versionState.isClearingCaches && (
                    <div className="text-xs mt-1 opacity-75">
                      {t("settings.previousVersion", currentLanguage)}:{" "}
                      {formatVersion(versionState.previousVersion)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
