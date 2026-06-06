import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import serviceWorkerManager from "@/lib/serviceWorker";
import { useToastStore } from "@/stores/toastStore";

// Keep the toast around long enough to be noticed mid-ride; if dismissed or
// ignored, the waiting worker still activates on the next cold start.
const UPDATE_TOAST_DURATION_MS = 10 * 60 * 1000;

// Surfaces "new version available" as a toast. The reload only happens when
// the user confirms: SKIP_WAITING -> controllerchange -> guarded reload.
export function usePwaUpdateToast(): void {
	const pushToast = useToastStore((s) => s.push);
	const t = useT();
	const announcedRef = useRef(false);

	useEffect(() => {
		const announce = () => {
			if (announcedRef.current) return;
			announcedRef.current = true;
			pushToast({
				kind: "info",
				title: t("pwa.update.title"),
				body: t("pwa.update.body"),
				durationMs: UPDATE_TOAST_DURATION_MS,
				action: {
					label: t("pwa.update.reload"),
					onClick: () => {
						void serviceWorkerManager.skipWaiting();
					},
				},
			});
		};

		serviceWorkerManager.on("updateavailable", announce);
		if (serviceWorkerManager.getState().hasUpdate) announce();

		return () => serviceWorkerManager.off("updateavailable", announce);
	}, [pushToast, t]);
}
