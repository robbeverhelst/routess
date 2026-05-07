import { HttpException } from "@nestjs/common";
import type { DomainErrorCode, DomainErrorPayload } from "@routess/core";

// Throw this from services/controllers when you want to communicate a coded
// domain error. The GlobalExceptionFilter passes the payload through verbatim;
// callers on the wire side branch on `code` (and optionally `details`).
export class DomainException extends HttpException {
	constructor(
		statusCode: number,
		public readonly code: DomainErrorCode,
		message: string,
		public readonly details?: Record<string, unknown>,
	) {
		const payload: DomainErrorPayload = {
			statusCode,
			code,
			message,
			...(details ? { details } : {}),
		};
		super(payload, statusCode);
	}
}
