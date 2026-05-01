import { createLazyFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { loadLanguageFromLocalStorage } from "@/features/routing/services/LocalStorageService";
import { useVersionDetection } from "@/hooks/use-version-detection";
import { type SupportedLanguage, t } from "@/lib/i18n";
import { formatVersion } from "@/lib/version";
import { Route as IndexRoute } from "./index";

const MapWithRouting = lazy(() => import("@/components/MapWithRouting"));
const AppShell = lazy(() => import("@/redesign/AppShell").then((m) => ({ default: m.AppShell })));

export const Route = createLazyFileRoute("/")({
	component: Index,
});

function Index() {
	const versionState = useVersionDetection();
	const [showVersionNotification, setShowVersionNotification] = useState(false);
	const { center, zoom, route } = IndexRoute.useSearch();
	const currentLanguage: SupportedLanguage = loadLanguageFromLocalStorage();
	const useLegacyShell = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("legacy");

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const action = urlParams.get("action");

		if (action) {
			setTimeout(() => {
				switch (action) {
					case "new-route":
						window.dispatchEvent(new CustomEvent("pwa-shortcut", { detail: { action: "new-route" } }));
						break;
					case "locate":
						window.dispatchEvent(new CustomEvent("pwa-shortcut", { detail: { action: "locate" } }));
						break;
					case "import":
						window.dispatchEvent(new CustomEvent("pwa-shortcut", { detail: { action: "import" } }));
						break;
				}

				window.history.replaceState({}, "", window.location.pathname);
			}, 500);
		}
	}, []);

	useEffect(() => {
		if (versionState.hasChanged && versionState.previousVersion) {
			setShowVersionNotification(true);
			const duration = versionState.isClearingCaches ? 8000 : 5000;
			const timer = setTimeout(() => setShowVersionNotification(false), duration);
			return () => clearTimeout(timer);
		}
	}, [versionState.hasChanged, versionState.previousVersion, versionState.isClearingCaches]);

	const notificationContent = getNotificationContent(versionState, currentLanguage);

	return (
		<>
			<Suspense fallback={<MapShellFallback />}>
				{useLegacyShell ? (
					<MapWithRouting height="100%" width="100%" initialCenter={center} initialZoom={zoom} routeId={route} />
				) : (
					<AppShell initialCenter={center} initialZoom={zoom} routeId={route} />
				)}
			</Suspense>

			{showVersionNotification && (
				<div
					style={{
						position: "fixed",
						bottom: "20px",
						left: "20px",
						background: notificationContent.bgColor,
						color: "white",
						padding: "8px 12px",
						borderRadius: "6px",
						zIndex: 1000,
						boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
						maxWidth: "240px",
					}}
				>
					<div className="flex items-start gap-3">
						{notificationContent.showSpinner && (
							<div className="mt-0.5 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
						)}
						<div className="min-w-0 flex-1">
							<div className="mb-1 font-medium">{notificationContent.title}</div>
							<div className="text-sm opacity-90">
								{notificationContent.message}
								{versionState.previousVersion && !versionState.isClearingCaches && (
									<div className="mt-1 text-xs opacity-75">
										{t("settings.previousVersion", currentLanguage)}: {formatVersion(versionState.previousVersion)}
									</div>
								)}
							</div>
						</div>
						<button
							type="button"
							onClick={() => setShowVersionNotification(false)}
							className="ml-2 flex-shrink-0 text-white/80 transition-colors hover:text-white"
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

function MapShellFallback() {
	return (
		<div className="relative h-full w-full overflow-hidden bg-slate-950">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1e293b,transparent_50%),linear-gradient(180deg,#020617,#0f172a)]" />
			<div className="absolute left-4 top-4 h-12 w-40 animate-pulse rounded-2xl bg-white/10 backdrop-blur" />
			<div className="absolute left-1/2 top-8 h-14 w-72 -translate-x-1/2 animate-pulse rounded-2xl bg-white/10 backdrop-blur" />
			<div className="absolute right-4 top-4 h-12 w-28 animate-pulse rounded-2xl bg-white/10 backdrop-blur" />
		</div>
	);
}

function getNotificationContent(
	versionState: ReturnType<typeof useVersionDetection>,
	currentLanguage: SupportedLanguage,
) {
	if (versionState.isClearingCaches) {
		return {
			title: t("version.notification.updating", currentLanguage),
			message: t("version.notification.clearingCache", currentLanguage),
			bgColor: "#3b82f6",
			showSpinner: true,
		};
	}

	if (versionState.error) {
		return {
			title: t("version.notification.updatedWithWarning", currentLanguage),
			message: `${formatVersion(versionState.currentVersion)} ${t("version.notification.cacheWarning", currentLanguage)}`,
			bgColor: "#f59e0b",
			showSpinner: false,
		};
	}

	if (versionState.cachesClearedSuccessfully) {
		return {
			title: t("version.notification.updatedAndRefreshed", currentLanguage),
			message: formatVersion(versionState.currentVersion),
			bgColor: "#10b981",
			showSpinner: false,
		};
	}

	return {
		title: t("version.notification.updated", currentLanguage),
		message: formatVersion(versionState.currentVersion),
		bgColor: "#10b981",
		showSpinner: false,
	};
}
