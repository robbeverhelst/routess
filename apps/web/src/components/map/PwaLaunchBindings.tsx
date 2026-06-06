import { useEffect } from "react";
import { emitAppEvent } from "@/lib/app-events";
import { setGpxImportHandler } from "@/lib/pwa";

// Bridges GPX files arriving via PWA file handlers / share target into the
// import flow. Mounted inside MapWithRouting once the editor exists; earlier
// launches queue in lib/pwa. The flush is deferred a tick because child
// effects run before the parent's routess:import-gpx subscription.
export const PwaLaunchBindings: React.FC = () => {
	useEffect(() => {
		let cleanup: (() => void) | undefined;
		const timer = window.setTimeout(() => {
			cleanup = setGpxImportHandler(({ gpxString, fileName }) => {
				emitAppEvent("routess:import-gpx", { gpxString, fileName });
			});
		}, 0);

		return () => {
			window.clearTimeout(timer);
			cleanup?.();
		};
	}, []);

	return null;
};
