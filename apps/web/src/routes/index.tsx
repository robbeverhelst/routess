import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import MapWithRouting from "@/components/MapWithRouting";
import { useVersionDetection } from "@/hooks/use-version-detection";
import { type SupportedLanguage, t } from "@/lib/i18n";
import { formatVersion } from "@/lib/version";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>) => {
		return {
			center: (() => {
				const center = search.center as string | undefined;
				if (!center) return undefined;
				const [lat, lng] = center.split(",").map(Number);
				if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined;
				return [lng, lat] as [number, number];
			})(),
			zoom: (() => {
				const zoom = search.zoom as string | undefined;
				if (!zoom) return undefined;
				const numZoom = Number(zoom);
				return Number.isNaN(numZoom) ? undefined : numZoom;
			})(),
			route: search.route as string | undefined,
		};
	},
	component: Index,
});

function Index() {
	const versionState = useVersionDetection();
	const [showVersionNotification, setShowVersionNotification] = useState(false);
	const { center, zoom, route } = Route.useSearch();

	// Get current language from localStorage or default to English
	const currentLanguage: SupportedLanguage = (localStorage.getItem("maps-language") as SupportedLanguage) || "en";

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
						window.dispatchEvent(new CustomEvent("pwa-shortcut", { detail: { action: "new-route" } }));
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
	}, [versionState.hasChanged, versionState.previousVersion, versionState.isClearingCaches]);

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
		<>
			<MapWithRouting height="100%" width="100%" initialCenter={center} initialZoom={zoom} routeId={route} />

			{/* Version change notification */}
			{showVersionNotification && (
				<div
					style={{
						position: "fixed",
						bottom: "20px",
						left: "20px",
						background: getNotificationContent().bgColor,
						color: "white",
						padding: "8px 12px",
						borderRadius: "6px",
						zIndex: 1000,
						boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
						maxWidth: "240px",
					}}
				>
					<div className="flex items-start gap-3">
						{getNotificationContent().showSpinner && (
							<div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent flex-shrink-0 mt-0.5"></div>
						)}
						<div className="flex-1 min-w-0">
							<div className="font-medium mb-1">{getNotificationContent().title}</div>
							<div className="text-sm opacity-90">
								{getNotificationContent().message}
								{versionState.previousVersion && !versionState.isClearingCaches && (
									<div className="text-xs mt-1 opacity-75">
										{t("settings.previousVersion", currentLanguage)}: {formatVersion(versionState.previousVersion)}
									</div>
								)}
							</div>
						</div>
						<button
							type="button"
							onClick={() => setShowVersionNotification(false)}
							className="flex-shrink-0 ml-2 text-white/80 hover:text-white transition-colors"
							style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<title>Close notification</title>
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</button>
					</div>
				</div>
			)}
		</>
	);
}
