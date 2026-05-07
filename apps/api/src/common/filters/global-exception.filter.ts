import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { type DomainErrorPayload, inferCodeFromStatus, isDomainErrorPayload } from "@routess/core";
import type { Response } from "express";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(GlobalExceptionFilter.name);

	private toPayload(exception: unknown): DomainErrorPayload {
		if (exception instanceof HttpException) {
			const status = exception.getStatus();
			const raw = exception.getResponse();

			if (typeof raw === "object" && raw !== null && isDomainErrorPayload(raw)) {
				return raw;
			}

			const rawObj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : null;
			const messageField = rawObj?.message ?? raw;
			const messages = Array.isArray(messageField)
				? (messageField as string[])
				: typeof messageField === "string"
					? [messageField]
					: ["Error"];

			const payload: DomainErrorPayload = {
				statusCode: status,
				code: inferCodeFromStatus(status),
				message: messages[0],
			};
			if (messages.length > 1) {
				payload.details = { messages };
			}
			return payload;
		}

		return {
			statusCode: 500,
			code: "INTERNAL",
			message: "Internal server error",
		};
	}

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest();
		const payload = this.toPayload(exception);

		this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : exception);

		const isDevelopment = process.env.NODE_ENV === "development";
		const body: DomainErrorPayload =
			isDevelopment && exception instanceof Error
				? { ...payload, details: { ...(payload.details ?? {}), stack: exception.stack } }
				: payload;

		response.status(payload.statusCode).json(body);
	}
}
