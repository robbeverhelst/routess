// PWA runtime integration: service worker registration, persistent storage,
// install prompt capture, and GPX intake from file handlers / share target.
import { Logger } from "./logger";
import serviceWorkerManager from "./serviceWorker";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_CHECK_MIN_GAP_MS = 15 * 60 * 1000;

// Must match SHARED_FILE_CACHE_KEY in src/sw.js.
const SHARED_FILE_CACHE_KEY = "/__routess_shared_file__";

// ---------------------------------------------------------------------------
// GPX intake (PWA file handlers + share target)
//
// Launch files can arrive before the map subtree has mounted its
// routess:import-gpx listener, so payloads queue here until a handler is set
// (PwaLaunchBindings inside MapWithRouting).
// ---------------------------------------------------------------------------

export interface GpxLaunchPayload {
	gpxString: string;
	fileName?: string;
}

let pendingGpxImports: GpxLaunchPayload[] = [];
let gpxImportHandler: ((payload: GpxLaunchPayload) => void) | null = null;

export function deliverGpxImport(payload: GpxLaunchPayload): void {
	if (gpxImportHandler) {
		gpxImportHandler(payload);
	} else {
		pendingGpxImports.push(payload);
	}
}

export function setGpxImportHandler(handler: (payload: GpxLaunchPayload) => void): () => void {
	gpxImportHandler = handler;
	const queued = pendingGpxImports;
	pendingGpxImports = [];
	for (const payload of queued) {
		handler(payload);
	}
	return () => {
		if (gpxImportHandler === handler) {
			gpxImportHandler = null;
		}
	};
}

interface LaunchParams {
	files?: FileSystemFileHandle[];
}

interface LaunchQueue {
	setConsumer(consumer: (params: LaunchParams) => void): void;
}

function initLaunchQueue(): void {
	const launchQueue = (window as Window & { launchQueue?: LaunchQueue }).launchQueue;
	if (!launchQueue) return;

	launchQueue.setConsumer((params) => {
		void handleLaunchFiles(params.files ?? []);
	});
}

async function handleLaunchFiles(handles: FileSystemFileHandle[]): Promise<void> {
	for (const handle of handles) {
		try {
			const file = await handle.getFile();
			deliverGpxImport({ gpxString: await file.text(), fileName: file.name });
		} catch (error) {
			Logger.warn("[PWA] Failed to read launched file:", error);
		}
	}
}

// Picks up a file the service worker stashed for the Web Share Target
// redirect (/?action=shared-file). Cache Storage is shared with the worker.
export async function consumeSharedGpxFile(): Promise<void> {
	if (!("caches" in window)) return;

	try {
		const response = await caches.match(SHARED_FILE_CACHE_KEY);
		if (!response) return;

		const fileName = decodeURIComponent(response.headers.get("x-routess-file-name") ?? "shared.gpx");
		const gpxString = await response.text();

		const cacheNames = await caches.keys();
		await Promise.all(
			cacheNames
				.filter((name) => name.startsWith("routess-"))
				.map(async (name) => (await caches.open(name)).delete(SHARED_FILE_CACHE_KEY)),
		);

		deliverGpxImport({ gpxString, fileName });
	} catch (error) {
		Logger.warn("[PWA] Failed to consume shared file:", error);
	}
}

// ---------------------------------------------------------------------------
// Install prompt
//
// beforeinstallprompt fires once, early, and only while uninstalled. The
// event is captured here so settings UI mounted later can still trigger it.
// ---------------------------------------------------------------------------

export interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let appInstalledThisSession = false;
const installSubscribers = new Set<() => void>();

function notifyInstallSubscribers(): void {
	for (const subscriber of installSubscribers) {
		subscriber();
	}
}

export function subscribeInstallState(callback: () => void): () => void {
	installSubscribers.add(callback);
	return () => {
		installSubscribers.delete(callback);
	};
}

export function canPromptInstall(): boolean {
	return deferredInstallPrompt !== null;
}

export function isStandalone(): boolean {
	if (typeof window === "undefined") return false;
	return (
		window.matchMedia?.("(display-mode: standalone)").matches === true ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

export function isAppInstalled(): boolean {
	return appInstalledThisSession || isStandalone();
}

export function isIosSafari(): boolean {
	const ua = navigator.userAgent;
	const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
	return isIos && !isStandalone();
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
	const prompt = deferredInstallPrompt;
	if (!prompt) return "unavailable";

	try {
		await prompt.prompt();
		const choice = await prompt.userChoice;
		if (choice.outcome === "accepted") {
			deferredInstallPrompt = null;
			notifyInstallSubscribers();
		}
		return choice.outcome;
	} catch (error) {
		Logger.warn("[PWA] Install prompt failed:", error);
		deferredInstallPrompt = null;
		notifyInstallSubscribers();
		return "unavailable";
	}
}

// ---------------------------------------------------------------------------
// Storage + update checks
// ---------------------------------------------------------------------------

// Without persistence the browser may evict cached tiles and offline routes
// under storage pressure, exactly when they matter (offline in the field).
async function requestPersistentStorage(): Promise<void> {
	try {
		if (!navigator.storage?.persist) return;
		if (await navigator.storage.persisted()) return;
		const granted = await navigator.storage.persist();
		Logger.debug("[PWA] Persistent storage granted:", granted);
	} catch (error) {
		Logger.warn("[PWA] Persistent storage request failed:", error);
	}
}

// Long-lived map sessions never re-navigate, so without this they only learn
// about a new deploy on the next cold start.
function scheduleUpdateChecks(): void {
	let lastCheckAt = Date.now();

	const check = () => {
		lastCheckAt = Date.now();
		void serviceWorkerManager.checkForUpdates();
	};

	setInterval(check, UPDATE_CHECK_INTERVAL_MS);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible" && Date.now() - lastCheckAt > UPDATE_CHECK_MIN_GAP_MS) {
			check();
		}
	});
}

// ---------------------------------------------------------------------------
// Entry point, called once from main.tsx
// ---------------------------------------------------------------------------

export function initPwa(): void {
	window.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		deferredInstallPrompt = event as BeforeInstallPromptEvent;
		notifyInstallSubscribers();
	});

	window.addEventListener("appinstalled", () => {
		deferredInstallPrompt = null;
		appInstalledThisSession = true;
		notifyInstallSubscribers();
	});

	initLaunchQueue();

	// Registration is prod-only; useServiceWorker's dev cleanup unregisters
	// any stale worker during development.
	if (!import.meta.env.PROD) return;

	void serviceWorkerManager.register().then((registration) => {
		if (!registration) return;
		void requestPersistentStorage();
		scheduleUpdateChecks();
	});
}
