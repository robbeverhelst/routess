import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotEnv } from "dotenv";

export interface AppConfig {
	app: {
		name: string;
		version: string;
		description: string;
		port: number;
		nodeEnv: string;
		isDevelopment: boolean;
		isProduction: boolean;
		isTest: boolean;
		frontendUrl: string;
		frontendUrls: string[];
		// Canonical public-site origin (the landing host, ADR 0025). Serves
		// /r/{slugId}/og.png, which emails embed as the route preview image.
		publicSiteUrl: string;
	};
	auth: {
		jwtSecret: string;
		jwtExpiresIn: string;
		googleClientId: string;
		googleClientSecret: string;
		sessionTtlMs: number;
		cookieName: string;
		adminEmails: string[];
		// Server-side pepper for HMAC-SHA-256 hashing of personal access tokens.
		// Never exposed to clients; the API hashes the plaintext bearer token
		// with this pepper and looks the resulting digest up in the
		// personal_access_token table. See ADR-0022.
		patPepper: string;
	};
	database: {
		host: string;
		port: number;
		user: string;
		password: string;
		name: string;
		debug: boolean;
	};
	telemetry: {
		enabled: boolean;
		metricsEnabled: boolean;
		metricsPath: string;
		metricsPort: number;
		otlpEndpoint?: string;
		otlpHeaders?: Record<string, string>;
	};
	analytics: {
		// Server-side salt for pseudonymising user IDs in ProductEvents. Never
		// exposed to the browser; the API hashes user.id with this salt and ships
		// the hash on the profile response. See ADR-0020.
		salt: string;
		// Umami's own Postgres, used to erase a user's ProductEvent trail on hard
		// delete (ADR-0020) and to enforce the retention window. Umami exposes
		// neither a delete-by-property API nor a retention setting, so both are
		// direct DELETEs against its schema. Empty disables both.
		umamiDatabaseUrl: string;
		umamiWebsiteId: string;
		// Retention window for ProductEvents. Must match what the privacy policy
		// states (apps/landing/lib/legal/privacy.ts); changing one without the
		// other makes the policy false.
		umamiRetentionDays: number;
	};
	monitoring: {
		grafanaUrls: Record<string, string>;
		umamiUrl?: string;
		glitchtipUrl?: string;
	};
	docs: {
		enabled: boolean;
		path: string;
	};
	email: {
		// When provider is 'console', emails are logged instead of sent. Useful
		// in dev/test where no Resend API key is configured.
		provider: "resend" | "console";
		resendApiKey: string;
		from: string;
	};
	routing: {
		// Base URL of the self-hosted Valhalla service. The API proxies
		// /trace_attributes through this so the browser never hits Valhalla
		// directly (it lives on a cluster-internal Service).
		valhallaUrl: string;
		// TileJSON URL of the node-network tiles served by go-pmtiles (ADR
		// 0033/0037); the generation pipeline derives knooppunt anchor pools
		// from it. Empty disables knooppunt mode (silent degrade).
		nodeTilesUrl: string;
	};
	geocoding: {
		// Mapbox public token for server-side reverse geocoding (Place
		// derivation, CONTEXT.md "Place"). The token is URL-restricted, so
		// requests must carry the referer below. Empty token disables
		// derivation; Places stay null until the backfill runs with one set.
		mapboxToken: string;
		referer: string;
	};
	cache: {
		// Redis URL for the shared cache, throttle storage, and quota counters
		// (ADR 0032). Empty disables Redis; the API falls back to per-pod
		// in-memory caching, which halves hit rates across replicas but never
		// blocks startup.
		redisUrl: string;
	};
	quotas: {
		// Per-User daily cap on RouteGeneration attempts. Each attempt fans out
		// into many paid Valhalla calls, so the per-minute throttle alone does
		// not bound daily provider spend. 0 disables the quota.
		generationPerDay: number;
	};
}

const DEFAULTS = {
	appName: "Routess API",
	appDescription: "API for route management and mapping functionality",
	appPort: 3000,
	frontendUrl: "http://localhost:5173",
	jwtExpiresIn: "7d",
	sessionTtlDays: 7,
	sessionCookieName: "routess_session",
	metricsPath: "/metrics",
	metricsPort: 9464,
	// 14 months, matching the retention table in the privacy policy.
	umamiRetentionDays: 425,
};

let isEnvironmentLoaded = false;

function parseInteger(value: string | undefined, fallback: number): number {
	if (!value) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
	if (!value) {
		return fallback;
	}

	return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseJsonObject(value: string | undefined): Record<string, string> | undefined {
	if (!value) {
		return undefined;
	}

	try {
		const parsed: unknown = JSON.parse(value);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return undefined;
		}

		return Object.fromEntries(
			Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
		);
	} catch {
		return undefined;
	}
}

function parseStringList(...values: Array<string | undefined>): string[] {
	return [
		...new Set(values.flatMap((value) => value?.split(/[\n,]/).map((entry) => entry.trim()) ?? []).filter(Boolean)),
	];
}

function requireProductionValue(name: string, value: string | undefined): string {
	if (!value?.trim()) {
		throw new Error(`${name} must be set when NODE_ENV=production`);
	}

	return value;
}

export function loadEnvironment(): void {
	if (isEnvironmentLoaded) {
		return;
	}

	const candidatePaths = [
		resolve(process.cwd(), ".env"),
		resolve(process.cwd(), "../.env"),
		resolve(process.cwd(), "../../.env"),
	];

	for (const envPath of candidatePaths) {
		if (existsSync(envPath)) {
			loadDotEnv({ path: envPath, override: false });
			break;
		}
	}

	isEnvironmentLoaded = true;
}

export function getAppConfig(): AppConfig {
	loadEnvironment();

	const nodeEnv = process.env.NODE_ENV || "development";
	const isProduction = nodeEnv === "production";
	const isTest = nodeEnv === "test";
	const isDevelopment = !isProduction && !isTest;
	const sessionTtlMs = parseInteger(process.env.SESSION_TTL_DAYS, DEFAULTS.sessionTtlDays) * 24 * 60 * 60 * 1000;
	const jwtSecret = isProduction
		? requireProductionValue("JWT_SECRET", process.env.JWT_SECRET)
		: process.env.JWT_SECRET || "development-only-secret-change-me";
	const analyticsSalt = isProduction
		? requireProductionValue("ANALYTICS_SALT", process.env.ANALYTICS_SALT)
		: process.env.ANALYTICS_SALT || "development-only-analytics-salt-change-me";
	const patPepper = isProduction
		? requireProductionValue("PAT_PEPPER", process.env.PAT_PEPPER)
		: process.env.PAT_PEPPER || "development-only-pat-pepper-change-me";
	const explicitFrontendUrls = parseStringList(process.env.FRONTEND_URLS);
	const fallbackFrontendUrls = parseStringList(process.env.FRONTEND_URL);
	const allowedFrontendUrls =
		explicitFrontendUrls.length > 0
			? explicitFrontendUrls
			: fallbackFrontendUrls.length > 0
				? fallbackFrontendUrls
				: [DEFAULTS.frontendUrl];

	return {
		app: {
			name: DEFAULTS.appName,
			// APP_VERSION is the canonical runtime injection (Helm); VITE_APP_VERSION
			// kept for the selfhost compose file, which shares one tag variable.
			version: process.env.APP_VERSION || process.env.VITE_APP_VERSION || "dev",
			description: DEFAULTS.appDescription,
			port: parseInteger(process.env.PORT, DEFAULTS.appPort),
			nodeEnv,
			isDevelopment,
			isProduction,
			isTest,
			frontendUrl: allowedFrontendUrls[0],
			frontendUrls: allowedFrontendUrls,
			publicSiteUrl: (process.env.PUBLIC_SITE_URL || allowedFrontendUrls[0]).replace(/\/+$/, ""),
		},
		auth: {
			jwtSecret,
			jwtExpiresIn: process.env.JWT_EXPIRES_IN || DEFAULTS.jwtExpiresIn,
			googleClientId: process.env.GOOGLE_CLIENT_ID || "",
			googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
			sessionTtlMs,
			cookieName: process.env.SESSION_COOKIE_NAME || DEFAULTS.sessionCookieName,
			adminEmails: parseStringList(process.env.ADMIN_EMAILS).map((email) => email.toLowerCase()),
			patPepper,
		},
		database: {
			host: process.env.DB_HOST || "localhost",
			port: parseInteger(process.env.DB_PORT, 5432),
			user: process.env.DB_USER || "postgres",
			password: isProduction
				? requireProductionValue("DB_PASSWORD", process.env.DB_PASSWORD)
				: process.env.DB_PASSWORD || "postgres",
			name: process.env.DB_NAME || "routess_db",
			debug: isDevelopment,
		},
		telemetry: {
			enabled: parseBoolean(process.env.TELEMETRY_ENABLED, true),
			metricsEnabled: parseBoolean(process.env.METRICS_ENABLED, true),
			metricsPath: process.env.METRICS_PATH || DEFAULTS.metricsPath,
			metricsPort: parseInteger(process.env.OTEL_EXPORTER_PROMETHEUS_PORT, DEFAULTS.metricsPort),
			otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
			otlpHeaders: parseJsonObject(process.env.OTEL_EXPORTER_OTLP_HEADERS),
		},
		docs: {
			enabled: parseBoolean(process.env.SWAGGER_ENABLED, !isProduction),
			path: process.env.SWAGGER_PATH || "/api",
		},
		monitoring: {
			grafanaUrls: parseJsonObject(process.env.GRAFANA_URLS) ?? {},
			umamiUrl: process.env.UMAMI_DASHBOARD_URL || undefined,
			glitchtipUrl: process.env.GLITCHTIP_URL || undefined,
		},
		analytics: {
			salt: analyticsSalt,
			umamiDatabaseUrl: (process.env.UMAMI_DATABASE_URL ?? "").trim(),
			umamiWebsiteId: (process.env.UMAMI_WEBSITE_ID ?? "").trim(),
			umamiRetentionDays: parseInteger(process.env.UMAMI_RETENTION_DAYS, DEFAULTS.umamiRetentionDays),
		},
		email: {
			provider: process.env.RESEND_API_KEY ? "resend" : "console",
			resendApiKey: process.env.RESEND_API_KEY ?? "",
			from: process.env.EMAIL_FROM || "Routess <noreply@routess.app>",
		},
		routing: {
			valhallaUrl: (process.env.VALHALLA_URL ?? "").replace(/\/+$/, ""),
			nodeTilesUrl: (process.env.NODE_TILES_URL ?? "").trim(),
		},
		geocoding: {
			mapboxToken: process.env.MAPBOX_PUBLIC_TOKEN ?? "",
			referer: process.env.GEOCODING_REFERER || "https://routess.com",
		},
		cache: {
			redisUrl: process.env.REDIS_URL ?? "",
		},
		quotas: {
			generationPerDay: parseInteger(process.env.GENERATION_QUOTA_PER_DAY, 50),
		},
	};
}
