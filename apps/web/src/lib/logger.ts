export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	NONE = 4, // Special level to disable all logs
}

let currentLogLevel: LogLevel = LogLevel.INFO; // Default log level

export function setLogLevel(level: LogLevel): void {
	currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
	return currentLogLevel;
}

// In a real application, you might get this from an environment variable
// For example: setLogLevel(process.env.LOG_LEVEL as LogLevel || LogLevel.INFO);

const _LOG_PREFIX = "[App]";

function log(level: LogLevel, _messages: unknown[]): void {
	if (level >= currentLogLevel) {
		const _timestamp = new Date().toISOString();
		const _levelString = LogLevel[level];
		switch (level) {
			case LogLevel.DEBUG:
				break;
			case LogLevel.INFO:
				break;
			case LogLevel.WARN:
				break;
			case LogLevel.ERROR:
				break;
			default:
				// Should not happen
				break;
		}
	}
}

export const Logger = {
	debug: (...messages: unknown[]): void => log(LogLevel.DEBUG, messages),
	info: (...messages: unknown[]): void => log(LogLevel.INFO, messages),
	warn: (...messages: unknown[]): void => log(LogLevel.WARN, messages),
	error: (...messages: unknown[]): void => log(LogLevel.ERROR, messages),
};

if (process.env.NODE_ENV === "production") {
	setLogLevel(LogLevel.NONE);
}
