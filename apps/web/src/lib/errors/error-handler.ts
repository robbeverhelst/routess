/**
 * Centralized error handling system
 */

import { ApiDomainError } from "@routess/api-client";
import { type DomainErrorCode, severityForCode } from "@routess/core";
import * as Sentry from "@sentry/react";
import { Logger, withoutTelemetry } from "@/lib/logger";
import type { AppError, ErrorCategory, ErrorHandlerOptions, ErrorSeverity } from "./types";

const categoryForCode = (code: DomainErrorCode): ErrorCategory => {
	switch (code) {
		case "UNAUTHORIZED":
		case "FORBIDDEN":
			return "auth" as ErrorCategory;
		case "VALIDATION_FAILED":
			return "validation" as ErrorCategory;
		case "NOT_FOUND":
		case "CONFLICT":
		case "RATE_LIMITED":
		case "PRECONDITION_REQUIRED":
		case "INTERNAL":
			return "api" as ErrorCategory;
	}
};

const isExpectedAuthOutcome = (appError: AppError): boolean => {
	const code = (appError.originalError as ApiDomainError | undefined)?.payload?.code;
	return code === "UNAUTHORIZED" || code === "FORBIDDEN";
};

const severityToSentryLevel = (severity: ErrorSeverity): Sentry.SeverityLevel => {
	switch (severity) {
		case "low":
			return "info";
		case "medium":
			return "warning";
		case "high":
			return "error";
		case "critical":
			return "fatal";
		default:
			return "error";
	}
};

class ErrorHandlerService {
	private errorListeners: Array<(error: AppError) => void> = [];

	/**
	 * Main error handling method
	 */
	handleError(
		error: Error | string,
		context: {
			category: ErrorCategory;
			severity: ErrorSeverity;
			context?: string;
			retry?: () => Promise<void> | void;
			metadata?: Record<string, unknown>;
		},
		options: ErrorHandlerOptions = {},
	): AppError {
		const { showToUser = true, logError = true, autoRetry = false, retryAttempts = 3, retryDelay = 1000 } = options;

		const appError: AppError = {
			id: this.generateErrorId(),
			message: typeof error === "string" ? error : error.message,
			category: context.category,
			severity: context.severity,
			context: context.context,
			timestamp: new Date(),
			retry: context.retry,
			originalError: typeof error === "object" ? error : undefined,
			metadata: context.metadata,
		};

		if (logError) {
			const logLevel = this.getLogLevel(appError.severity);
			// reportToSentry below already sends this failure with structured
			// tags. Without the suppression the log line files a second,
			// message-shaped issue for the same error.
			withoutTelemetry(() =>
				Logger[logLevel](`[ErrorHandler] ${appError.category}:`, appError.message, {
					context: appError.context,
					metadata: appError.metadata,
					originalError: appError.originalError,
				}),
			);
		}

		this.reportToSentry(appError);

		if (showToUser) {
			this.notifyListeners(appError);
		}

		if (autoRetry && appError.retry) {
			this.scheduleRetry(appError, retryAttempts, retryDelay);
		}

		return appError;
	}

	/**
	 * Subscribe to error notifications
	 */
	subscribe(listener: (error: AppError) => void): () => void {
		this.errorListeners.push(listener);
		return () => {
			const index = this.errorListeners.indexOf(listener);
			if (index > -1) {
				this.errorListeners.splice(index, 1);
			}
		};
	}

	private reportToSentry(appError: AppError): void {
		// A 401/403 is the API answering a question, not a defect: anonymous
		// visitors and expired sessions hit authed endpoints constantly and
		// the app already handles it by prompting for sign-in.
		if (isExpectedAuthOutcome(appError)) return;

		const captureTarget = appError.originalError ?? new Error(appError.message);
		// ApiDomainError/ApiHttpError carry the X-Request-ID the API logged,
		// joining this browser event to the server-side log line and trace.
		const requestId = (appError.originalError as { requestId?: string } | undefined)?.requestId;
		Sentry.captureException(captureTarget, {
			level: severityToSentryLevel(appError.severity),
			tags: {
				category: appError.category,
				severity: appError.severity,
				...(appError.context ? { context: appError.context } : {}),
				...(requestId ? { api_request_id: requestId } : {}),
			},
			extra: {
				app_error_id: appError.id,
				...(appError.metadata ?? {}),
			},
		});
	}

	private notifyListeners(error: AppError) {
		this.errorListeners.forEach((listener) => {
			try {
				listener(error);
			} catch (listenerError) {
				Logger.error("[ErrorHandler] Error in listener:", listenerError);
			}
		});
	}

	private async scheduleRetry(error: AppError, attempts: number, delay: number, currentAttempt = 1) {
		if (currentAttempt > attempts || !error.retry) return;

		setTimeout(async () => {
			try {
				Logger.info(`[ErrorHandler] Retry attempt ${currentAttempt}/${attempts} for:`, error.id);
				await error.retry?.();
				Logger.info(`[ErrorHandler] Retry successful for:`, error.id);
			} catch (retryError) {
				Logger.warn(`[ErrorHandler] Retry ${currentAttempt} failed for:`, error.id, retryError);
				if (currentAttempt < attempts) {
					this.scheduleRetry(error, attempts, delay * 2, currentAttempt + 1);
				}
			}
		}, delay);
	}

	private generateErrorId(): string {
		return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private getLogLevel(severity: ErrorSeverity): "debug" | "info" | "warn" | "error" {
		switch (severity) {
			case "low":
				return "debug";
			case "medium":
				return "info";
			case "high":
				return "warn";
			case "critical":
				return "error";
			default:
				return "error";
		}
	}
}

// Create singleton instance
export const errorHandler = new ErrorHandlerService();

/**
 * Convenience functions for common error scenarios
 */
export const handleNetworkError = (error: Error, context?: string, retry?: () => void) =>
	errorHandler.handleError(error, {
		category: "network" as ErrorCategory,
		severity: "medium" as ErrorSeverity,
		context,
		retry,
	});

export const handleAPIError = (error: Error, context?: string, retry?: () => void) => {
	if (error instanceof ApiDomainError) {
		return errorHandler.handleError(error, {
			category: categoryForCode(error.payload.code),
			severity: severityForCode(error.payload.code) as ErrorSeverity,
			context,
			retry,
			metadata: { code: error.payload.code, ...(error.payload.details ? { details: error.payload.details } : {}) },
		});
	}
	return errorHandler.handleError(error, {
		category: "api" as ErrorCategory,
		severity: "medium" as ErrorSeverity,
		context,
		retry,
	});
};

export const handleLocationError = (error: Error, context?: string) =>
	errorHandler.handleError(error, {
		category: "location" as ErrorCategory,
		severity: "low" as ErrorSeverity,
		context,
	});

export const handleRoutingError = (error: Error, context?: string, retry?: () => void) =>
	errorHandler.handleError(error, {
		category: "routing" as ErrorCategory,
		severity: "medium" as ErrorSeverity,
		context,
		retry,
	});

export const handleMapError = (error: Error, context?: string) =>
	errorHandler.handleError(error, {
		category: "map" as ErrorCategory,
		severity: "high" as ErrorSeverity,
		context,
	});

export const handleAuthError = (error: Error, context?: string) =>
	errorHandler.handleError(error, {
		category: "auth" as ErrorCategory,
		severity: "high" as ErrorSeverity,
		context,
	});

export const handleValidationError = (message: string, context?: string) =>
	errorHandler.handleError(message, {
		category: "validation" as ErrorCategory,
		severity: "low" as ErrorSeverity,
		context,
	});
