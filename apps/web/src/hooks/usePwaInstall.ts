import { useEffect, useState } from "react";
import { canPromptInstall, isAppInstalled, isIosSafari, promptInstall, subscribeInstallState } from "@/lib/pwa";

export type PwaInstallAvailability = "installed" | "promptable" | "ios-manual" | "unavailable";

// Install state for settings UI. "promptable" means the captured
// beforeinstallprompt can be fired; iOS never fires it, so Safari users get
// manual add-to-home-screen instructions instead.
export function usePwaInstall(): { availability: PwaInstallAvailability; promptInstall: typeof promptInstall } {
	const [, setRevision] = useState(0);

	useEffect(() => subscribeInstallState(() => setRevision((r) => r + 1)), []);

	const availability: PwaInstallAvailability = isAppInstalled()
		? "installed"
		: canPromptInstall()
			? "promptable"
			: isIosSafari()
				? "ios-manual"
				: "unavailable";

	return { availability, promptInstall };
}
