import * as Sentry from "@sentry/react";

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	NONE = 4,
}

const LOG_PREFIX = "[Routess]";
const LOG_LEVEL_STORAGE_KEY = "routess:log-level";

const LOG_LEVEL_NAMES: Record<string, LogLevel> = {
	debug: LogLevel.DEBUG,
	info: LogLevel.INFO,
	warn: LogLevel.WARN,
	warning: LogLevel.WARN,
	error: LogLevel.ERROR,
	none: LogLevel.NONE,
	silent: LogLevel.NONE,
};

function parseLogLevel(value: unknown): LogLevel | null {
	if (typeof value !== "string") return null;
	return LOG_LEVEL_NAMES[value.trim().toLowerCase()] ?? null;
}

function readStoredLogLevel(): LogLevel | null {
	if (typeof window === "undefined") return null;

	try {
		return parseLogLevel(window.localStorage.getItem(LOG_LEVEL_STORAGE_KEY));
	} catch {
		return null;
	}
}

function resolveInitialLogLevel(): LogLevel {
	const configuredLevel = parseLogLevel(import.meta.env.VITE_LOG_LEVEL);
	if (configuredLevel !== null) return configuredLevel;

	const storedLevel = readStoredLogLevel();
	if (storedLevel !== null) return storedLevel;

	if (import.meta.env.MODE === "test") return LogLevel.NONE;
	return LogLevel.WARN;
}

let currentLogLevel: LogLevel = resolveInitialLogLevel();

export function setLogLevel(level: LogLevel): void {
	currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
	return currentLogLevel;
}

export function setLogLevelOverride(level: LogLevel | keyof typeof LOG_LEVEL_NAMES): void {
	currentLogLevel = typeof level === "number" ? level : LOG_LEVEL_NAMES[level];

	if (typeof window === "undefined") return;
	try {
		const name = Object.entries(LOG_LEVEL_NAMES).find(([, value]) => value === currentLogLevel)?.[0] ?? "warn";
		window.localStorage.setItem(LOG_LEVEL_STORAGE_KEY, name);
	} catch {
		// Logging configuration should never affect app behavior.
	}
}

// WARN and ERROR logs also surface in GlitchTip so we get visibility on
// caught failures that never bubble up to Sentry's GlobalHandlers (Mapbox
// NoSegment, GPS timeouts, etc.). Decoupled from `currentLogLevel` so that
// muting the console (e.g. in tests) does not mute Sentry; the test-mode
// guard below is what keeps unit tests quiet.
function stringifyForSentry(value: unknown): string {
	if (typeof value === "string") return value;
	if (value instanceof Error) return value.message;
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function reportToSentry(level: LogLevel, messages: unknown[]): void {
	if (import.meta.env.MODE === "test") return;
	if (level !== LogLevel.WARN && level !== LogLevel.ERROR) return;
	if (messages.length === 0) return;

	const sentryLevel: Sentry.SeverityLevel = level === LogLevel.ERROR ? "error" : "warning";
	const error = messages.find((m): m is Error => m instanceof Error);
	const joined = messages.map(stringifyForSentry).join(" ");

	if (error) {
		Sentry.captureException(error, {
			level: sentryLevel,
			extra: { logMessage: joined },
		});
	} else {
		Sentry.captureMessage(joined, sentryLevel);
	}
}

function log(level: LogLevel, messages: unknown[]): void {
	reportToSentry(level, messages);
	if (level < currentLogLevel) return;

	switch (level) {
		case LogLevel.DEBUG:
			console.debug(LOG_PREFIX, ...messages);
			break;
		case LogLevel.INFO:
			console.info(LOG_PREFIX, ...messages);
			break;
		case LogLevel.WARN:
			console.warn(LOG_PREFIX, ...messages);
			break;
		case LogLevel.ERROR:
			console.error(LOG_PREFIX, ...messages);
			break;
	}
}

export const Logger = {
	debug: (...messages: unknown[]): void => log(LogLevel.DEBUG, messages),
	info: (...messages: unknown[]): void => log(LogLevel.INFO, messages),
	warn: (...messages: unknown[]): void => log(LogLevel.WARN, messages),
	error: (...messages: unknown[]): void => log(LogLevel.ERROR, messages),
	setLevel: setLogLevelOverride,
};
