// ProductEvent firing seam. Reads common context (auth, locale, theme, units,
// app version) at call time and merges it with per-event properties before
// dispatching to Umami. ADR-0019 defines this as the canonical client-side
// fire site for behavioural events.

import { getStoredUser } from "@/lib/auth-state";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useUiStore } from "@/stores/uiStore";
import type { ProductEvent } from "./events";

type UmamiPropertyValue = string | number | boolean | null;

declare global {
	interface Window {
		umami?: {
			track: (event: string, data?: Record<string, UmamiPropertyValue>) => void;
		};
		doNotTrack?: string | null;
	}
}

function buildCommonContext(): Record<string, UmamiPropertyValue> {
	const user = getStoredUser();
	const ui = useUiStore.getState();
	const settings = useRedesignSettingsStore.getState();

	return {
		signed_in: user !== null,
		user_id_hash: user?.idHash ?? null,
		app_version: getRuntimeConfig("VITE_APP_VERSION") ?? null,
		locale: ui.language,
		theme: ui.theme,
		units_preference: settings.units,
	};
}

// Honours the per-device analytics opt-out and the browser's Do Not Track
// signal. Both are objections under GDPR Art. 21, so this is a hard gate: no
// event leaves the client once either is set.
export function analyticsAllowed(): boolean {
	if (typeof window === "undefined") return false;
	if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return false;
	// Only an explicit false opts out, matching the loader gate in index.html.
	// A missing value means "never chosen", not "opted out".
	return useRedesignSettingsStore.getState().analyticsEnabled !== false;
}

export function trackEvent<E extends ProductEvent>(event: E): void {
	if (!analyticsAllowed()) return;
	const merged: Record<string, UmamiPropertyValue> = {
		...buildCommonContext(),
		...(event.properties as Record<string, UmamiPropertyValue>),
	};
	window.umami?.track(event.name, merged);
}
