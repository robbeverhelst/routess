import type { Coordinate, RouteActivity } from "@routess/core";
import { t } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { loadNavigationSnapshot, snapshotToSession, useNavigationStore } from "@/stores/navigationStore";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { fetchCues } from "./cuesClient";
import { primeSpeech } from "./speech";

// Session entry: called from a user gesture (the Navigate button), which is
// what lets primeSpeech unlock iOS voice. Cue fetch needs connectivity; the
// accepted ADR 0038 trade-off is that a route never opened online cannot
// start navigating offline.
export async function startNavigation(args: {
	routeName: string;
	geometry: Coordinate[];
	activity: RouteActivity;
}): Promise<boolean> {
	const pushToast = useToastStore.getState().push;
	if (args.geometry.length < 2) {
		pushToast({ kind: "warn", title: t("nav.startFailed"), body: t("nav.noGeometry") });
		return false;
	}

	primeSpeech();

	try {
		const locale = useUiStore.getState().language;
		const { cues, degraded } = await fetchCues({ geometry: args.geometry, activity: args.activity, locale });
		useNavigationStore.getState().start({
			routeName: args.routeName,
			activity: args.activity,
			path: args.geometry,
			cues,
			degraded,
		});
		pushToast({ kind: "info", title: t("nav.started"), body: t("nav.keepScreenOn") });
		return true;
	} catch (err) {
		Logger.warn("[Navigation] Could not start:", err);
		pushToast({ kind: "danger", title: t("nav.startFailed"), body: t("nav.startFailedBody") });
		return false;
	}
}

/** Resume the persisted session, if a fresh snapshot exists. */
export function resumeNavigation(): boolean {
	const snapshot = loadNavigationSnapshot();
	if (!snapshot) return false;
	primeSpeech();
	const { snapshot: snap, ...session } = snapshotToSession(snapshot);
	useNavigationStore.getState().start(session, snap);
	return true;
}
