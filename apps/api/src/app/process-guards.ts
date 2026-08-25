import { Logger } from "@nestjs/common";

const logger = new Logger("Process");

// Last-resort diagnostics. Registering these suppresses the runtime's default
// crash output, so both handlers still exit(1) — the point is that the next
// fatal error lands as a structured log line with its full stack and origin
// instead of a bare trace on stderr.
export function installProcessGuards(): void {
	process.on("uncaughtException", (error: Error, origin: string) => {
		logger.fatal(`Uncaught exception (${origin}): ${error.message}`, error.stack);
		process.exit(1);
	});

	process.on("unhandledRejection", (reason: unknown) => {
		const error = reason instanceof Error ? reason : new Error(String(reason));
		logger.fatal(`Unhandled rejection: ${error.message}`, error.stack);
		process.exit(1);
	});
}
