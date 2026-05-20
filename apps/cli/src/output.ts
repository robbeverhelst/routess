import type { DomainErrorCode, DomainErrorPayload } from "@routess/core";
import { isDomainErrorPayload } from "@routess/core";

// Exit code mapping. Documented in docs/skills/routess.skill.md so agents
// can branch on them reliably. Keep in sync with the skill file.
export const EXIT_CODES: Record<DomainErrorCode | "USAGE" | "NETWORK" | "GENERIC", number> = {
	GENERIC: 1,
	USAGE: 2,
	VALIDATION_FAILED: 3,
	NOT_FOUND: 4,
	UNAUTHORIZED: 5,
	FORBIDDEN: 6,
	CONFLICT: 7,
	RATE_LIMITED: 8,
	PRECONDITION_REQUIRED: 9,
	NETWORK: 10,
	INTERNAL: 11,
};

export interface RunOptions {
	json: boolean;
}

export class CliError extends Error {
	constructor(
		message: string,
		public readonly exitCode: number,
		public readonly payload?: DomainErrorPayload,
	) {
		super(message);
		this.name = "CliError";
	}
}

export function cliErrorFromDomain(payload: DomainErrorPayload): CliError {
	return new CliError(payload.message, EXIT_CODES[payload.code], payload);
}

// Renders a successful command result. JSON mode pipes machine-readable
// output to stdout; human mode prints the same data through a renderer
// supplied by the caller. The renderer is responsible for choosing the
// most useful columns; this module only knows about the mode switch.
export function renderResult<T>(options: RunOptions, data: T, humanRenderer: (data: T) => string): void {
	if (options.json) {
		process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
		return;
	}
	const rendered = humanRenderer(data);
	if (rendered.length > 0) {
		process.stdout.write(`${rendered}\n`);
	}
}

// Renders an error. JSON mode emits the DomainErrorPayload verbatim when
// available so agents can parse it; human mode prints a single readable
// line to stderr. Returns the exit code the caller should pass to
// process.exit.
export function renderError(options: RunOptions, error: unknown): number {
	if (error instanceof CliError) {
		if (options.json) {
			// When the error came from a DomainErrorPayload over the wire, emit
			// it verbatim so agents can branch on `code` directly. Otherwise
			// emit a smaller shape that doesn't pretend to be a domain payload
			// (USAGE / NETWORK have no DomainErrorCode equivalent).
			const body = error.payload ?? { exitCode: error.exitCode, message: error.message };
			process.stderr.write(`${JSON.stringify(body, null, 2)}\n`);
		} else {
			process.stderr.write(`error: ${error.message}\n`);
		}
		return error.exitCode;
	}
	if (isDomainErrorPayload(error)) {
		if (options.json) {
			process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
		} else {
			process.stderr.write(`error: ${error.message}\n`);
		}
		return EXIT_CODES[error.code];
	}
	const message = error instanceof Error ? error.message : String(error);
	if (options.json) {
		process.stderr.write(`${JSON.stringify({ exitCode: EXIT_CODES.GENERIC, message }, null, 2)}\n`);
	} else {
		process.stderr.write(`error: ${message}\n`);
	}
	return EXIT_CODES.GENERIC;
}
