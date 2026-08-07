import * as Sentry from "@sentry/react";
import { getStoredUser } from "@/lib/auth-state";
import { Logger } from "@/lib/logger";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { useRoutingStore } from "@/stores/routingStore";
import { rateLimitBeforeSend } from "./rate-limit";
import { scrubBreadcrumb } from "./scrub";

let initialized = false;

function parseRate(raw: string | undefined, fallback: number): number {
	if (!raw) return fallback;
	const n = Number.parseFloat(raw);
	return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
	if (raw === undefined) return fallback;
	return raw === "true" || raw === "1";
}

export function initTelemetry(): void {
	if (initialized) return;

	const dsn = getRuntimeConfig("VITE_SENTRY_DSN");
	if (!dsn) {
		Logger.debug("[telemetry] No Sentry DSN configured; telemetry disabled");
		return;
	}

	const environment = getRuntimeConfig("VITE_SENTRY_ENVIRONMENT") ?? "production";
	const release = getRuntimeConfig("VITE_APP_VERSION");
	const tracesSampleRate = parseRate(getRuntimeConfig("VITE_SENTRY_TRACES_SAMPLE_RATE"), 0.1);
	const debug = parseBool(getRuntimeConfig("VITE_SENTRY_DEBUG"), false);
	const logsEnabled = parseBool(getRuntimeConfig("VITE_SENTRY_LOGS_ENABLED"), false);

	Sentry.init({
		dsn,
		// Same-origin tunnel for built bundles (ADR-0021). bun dev has no nginx,
		// so leave it undefined and post directly to GlitchTip in dev.
		tunnel: import.meta.env.PROD ? "/__t" : undefined,
		environment,
		release,
		debug,
		sendDefaultPii: false,
		maxBreadcrumbs: 50,
		tracesSampleRate,
		_experiments: logsEnabled ? { enableLogs: true } : undefined,
		integrations: [Sentry.browserTracingIntegration()],
		ignoreErrors: [
			/ResizeObserver loop/,
			/^Non-Error promise rejection/,
			/AbortError/,
			/NetworkError when attempting to fetch/,
			/Failed to fetch/,
		],
		denyUrls: [/chrome-extension:\/\//, /moz-extension:\/\//, /safari-extension:\/\//],
		beforeBreadcrumb: scrubBreadcrumb,
		beforeSend: rateLimitBeforeSend,
	});

	Sentry.setTag("app", "web");
	if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
		const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
		Sentry.setTag("is_pwa_installed", isStandalone);
	}

	syncUserFromStorage();
	if (typeof window !== "undefined") {
		window.addEventListener("auth-change", syncUserFromStorage);
	}

	syncRouteDraftContext();
	useRoutingStore.subscribe(syncRouteDraftContext);

	initialized = true;
	Logger.info(`[telemetry] Sentry initialized (environment=${environment}, release=${release ?? "unknown"})`);
}

function syncUserFromStorage(): void {
	const user = getStoredUser();
	if (!user) {
		Sentry.setUser(null);
		return;
	}
	// Pseudonymous id only, same posture as ProductEvents (ADR-0020): the raw
	// primary key never leaves the app for an observability store. A stale
	// pre-ADR-0020 profile snapshot has no idHash, so report it as anonymous.
	if (!user.idHash) {
		Sentry.setUser({ segment: user.role });
		return;
	}
	Sentry.setUser({ id: user.idHash, segment: user.role });
}

function syncRouteDraftContext(): void {
	const state = useRoutingStore.getState();
	const mode = state.mode?.kind ?? "unsaved";
	Sentry.setContext("route_draft", {
		mode,
		waypoint_count: state.waypoints.length,
		distance_m: state.distanceMeters ?? null,
		duration_s: state.durationSeconds ?? null,
		has_route_path: state.hasRoute,
	});
}

export function captureException(error: unknown, context?: Parameters<typeof Sentry.captureException>[1]): void {
	Sentry.captureException(error, context);
}
