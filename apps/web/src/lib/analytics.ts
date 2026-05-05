type EventData = Record<string, string | number | boolean | null | undefined>;

declare global {
	interface Window {
		umami?: {
			track: (event: string, data?: EventData) => void;
		};
	}
}

export function track(event: string, data?: EventData): void {
	if (typeof window === "undefined") return;
	window.umami?.track(event, data);
}
