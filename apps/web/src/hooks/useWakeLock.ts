import { useEffect } from "react";
import { Logger } from "@/lib/logger";

// Releasing an already-released sentinel rejects; that is fine.
const ignoreRelease = () => undefined;

// Holds a screen wake lock while `active`. The lock is released by the OS
// whenever the page is hidden, so it is re-acquired on visibilitychange.
// No-ops on browsers without the API (Safari < 16.4, Firefox).
export function useWakeLock(active: boolean): void {
	useEffect(() => {
		if (!active || !("wakeLock" in navigator)) return;

		let sentinel: WakeLockSentinel | null = null;
		let cancelled = false;

		const acquire = async () => {
			try {
				const lock = await navigator.wakeLock.request("screen");
				if (cancelled) {
					void lock.release().catch(ignoreRelease);
					return;
				}
				sentinel = lock;
				Logger.debug("[WakeLock] Screen wake lock acquired");
			} catch (error) {
				// Denied (battery saver, page hidden); harmless.
				Logger.debug("[WakeLock] Request failed:", error);
			}
		};

		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") void acquire();
		};

		void acquire();
		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			cancelled = true;
			document.removeEventListener("visibilitychange", onVisibilityChange);
			void sentinel?.release().catch(ignoreRelease);
			sentinel = null;
		};
	}, [active]);
}
