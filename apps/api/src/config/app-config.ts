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
	};
	auth: {
		jwtSecret: string;
		jwtExpiresIn: string;
		googleClientId: string;
		sessionTtlMs: number;
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
	docs: {
		enabled: boolean;
		path: string;
	};
}

const DEFAULTS = {
	appName: "Routess API",
	appDescription: "API for route management and mapping functionality",
	appPort: 3000,
	frontendUrl: "http://localhost:5173",
	jwtExpiresIn: "7d",
	sessionTtlDays: 7,
	metricsPath: "/metrics",
	metricsPort: 9464,
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
		const parsed = JSON.parse(value) as unknown;
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
	return [...new Set(values.flatMap((value) => value?.split(/[\n,]/).map((entry) => entry.trim()) ?? []).filter(Boolean))];
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
			version: process.env.VITE_APP_VERSION || "dev",
			description: DEFAULTS.appDescription,
			port: parseInteger(process.env.PORT, DEFAULTS.appPort),
			nodeEnv,
			isDevelopment,
			isProduction,
			isTest,
			frontendUrl: allowedFrontendUrls[0],
			frontendUrls: allowedFrontendUrls,
		},
		auth: {
			jwtSecret: process.env.JWT_SECRET || "development-only-secret-change-me",
			jwtExpiresIn: process.env.JWT_EXPIRES_IN || DEFAULTS.jwtExpiresIn,
			googleClientId: process.env.GOOGLE_CLIENT_ID || "",
			sessionTtlMs,
		},
		database: {
			host: process.env.DB_HOST || "localhost",
			port: parseInteger(process.env.DB_PORT, 5432),
			user: process.env.DB_USER || "postgres",
			password: process.env.DB_PASSWORD || "postgres",
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
	};
}
