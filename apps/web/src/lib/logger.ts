export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	NONE = 4,
}

let currentLogLevel: LogLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel): void {
	currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
	return currentLogLevel;
}

const LOG_PREFIX = "[App]";

function log(level: LogLevel, messages: unknown[]): void {
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
};

if (import.meta.env.PROD) {
	setLogLevel(LogLevel.NONE);
}
