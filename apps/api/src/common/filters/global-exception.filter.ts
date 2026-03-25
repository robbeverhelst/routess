import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(GlobalExceptionFilter.name);

	private getErrorMessage(status: number): string {
		switch (status) {
			case HttpStatus.BAD_REQUEST:
				return "Bad Request";
			case HttpStatus.UNAUTHORIZED:
				return "Unauthorized";
			case HttpStatus.FORBIDDEN:
				return "Forbidden";
			case HttpStatus.NOT_FOUND:
				return "Not Found";
			case HttpStatus.CONFLICT:
				return "Conflict";
			case HttpStatus.UNPROCESSABLE_ENTITY:
				return "Unprocessable Entity";
			case HttpStatus.INTERNAL_SERVER_ERROR:
				return "Internal Server Error";
			default:
				return "Error";
		}
	}

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest();

		let status = HttpStatus.INTERNAL_SERVER_ERROR;
		let message: string | string[] = "Internal server error";
		let error = "Internal Server Error";

		if (exception instanceof HttpException) {
			status = exception.getStatus();
			const exceptionResponse = exception.getResponse();

			if (typeof exceptionResponse === "string") {
				message = exceptionResponse;
				error = this.getErrorMessage(status);
			} else if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
				const resp = exceptionResponse as Record<string, unknown>;
				message = (resp.message as string | string[]) || message;
				error = (resp.error as string) || this.getErrorMessage(status);
			}
		}

		// Log the error for debugging
		this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : exception);

		// Only show stack traces in development mode, not in production or test
		const isDevelopment = process.env.NODE_ENV === "development";

		response.status(status).json({
			statusCode: status,
			timestamp: new Date().toISOString(),
			path: request.url,
			method: request.method,
			error,
			message: Array.isArray(message) ? message : [message],
			...(isDevelopment &&
				exception instanceof Error && {
					stack: exception.stack,
				}),
		});
	}
}
