import { useEffect } from "react";
import type { RouteDraftEditor } from "@/features/routing/RouteDraftEditor";
import { useRouteDraftEditor } from "@/features/routing/RouteDraftEditorProvider";
import { useRoutingStore } from "@/stores/routingStore";

// Test-only bridge that exposes a handle on `window.__routess` for the
// Playwright E2E suite. Gated by `import.meta.env.VITE_E2E === "true"` at the
// call site, so this module is tree-shaken from production bundles. See
// ADR-0019 for the rationale.

export interface E2ETestApi {
	editor: RouteDraftEditor;
	getRouteDraft: () => ReturnType<typeof useRoutingStore.getState>;
	waitForRouteCalculated: (timeoutMs?: number) => Promise<void>;
	isReady: () => boolean;
}

declare global {
	interface Window {
		__routess?: E2ETestApi;
	}
}

export function E2ETestApiBridge() {
	const editor = useRouteDraftEditor();

	useEffect(() => {
		if (!editor) return;

		const api: E2ETestApi = {
			editor,
			getRouteDraft: () => useRoutingStore.getState(),
			isReady: () => true,
			waitForRouteCalculated: (timeoutMs = 10_000) =>
				new Promise<void>((resolve, reject) => {
					if (useRoutingStore.getState().hasRoute) {
						resolve();
						return;
					}
					const timeout = setTimeout(() => {
						unsubscribe();
						reject(new Error("waitForRouteCalculated: timed out"));
					}, timeoutMs);
					const unsubscribe = useRoutingStore.subscribe((state) => {
						if (state.hasRoute) {
							clearTimeout(timeout);
							unsubscribe();
							resolve();
						}
					});
				}),
		};

		window.__routess = api;
		window.dispatchEvent(new CustomEvent("routess:e2e-ready"));

		return () => {
			delete window.__routess;
		};
	}, [editor]);

	return null;
}
