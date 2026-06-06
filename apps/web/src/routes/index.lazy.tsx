import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/AppShell";
import { consumeSharedGpxFile } from "@/lib/pwa";
import { Route as IndexRoute } from "./index";

export const Route = createLazyFileRoute("/")({
	component: Index,
});

function Index() {
	const { center, zoom, route } = IndexRoute.useSearch();

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
					case "shared-file":
						// Web Share Target: the service worker stashed the shared GPX
						// and redirected here; hand it to the import flow.
						void consumeSharedGpxFile();
						break;
				}

				window.history.replaceState({}, "", window.location.pathname);
			}, 500);
		}
	}, []);

	return <AppShell initialCenter={center} initialZoom={zoom} routeId={route} />;
}
