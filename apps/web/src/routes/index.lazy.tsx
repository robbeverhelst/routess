import { createLazyFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { AppShell } from "@/redesign/AppShell";
import { Route as IndexRoute } from "./index";

// Legacy shell stays lazy — only reached via ?legacy and shouldn't be in the main bundle.
const MapWithRouting = lazy(() => import("@/components/MapWithRouting"));

export const Route = createLazyFileRoute("/")({
	component: Index,
});

function Index() {
	const { center, zoom, route } = IndexRoute.useSearch();
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

	return (
		<Suspense fallback={<MapShellFallback />}>
			{useLegacyShell ? (
				<MapWithRouting height="100%" width="100%" initialCenter={center} initialZoom={zoom} routeId={route} />
			) : (
				<AppShell initialCenter={center} initialZoom={zoom} routeId={route} />
			)}
		</Suspense>
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
