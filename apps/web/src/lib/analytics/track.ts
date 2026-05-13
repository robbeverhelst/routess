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

export function trackEvent<E extends ProductEvent>(event: E): void {
	if (typeof window === "undefined") return;
	const merged: Record<string, UmamiPropertyValue> = {
		...buildCommonContext(),
		...(event.properties as Record<string, UmamiPropertyValue>),
	};
	window.umami?.track(event.name, merged);
}
