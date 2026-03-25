/**
 * React hook for centralized error handling
 */

import { useCallback, useEffect, useState } from "react";
import { errorHandler } from "./error-handler";
import type { AppError, ErrorHandlerOptions } from "./types";
import { ErrorCategory, ErrorSeverity } from "./types";

export const useErrorHandler = () => {
	const [errors, setErrors] = useState<AppError[]>([]);
	const [isDisplaying, setIsDisplaying] = useState(false);

	// Subscribe to error notifications
	useEffect(() => {
		const unsubscribe = errorHandler.subscribe((error: AppError) => {
			setErrors((prev) => {
				// Limit to last 10 errors to prevent memory issues
				const newErrors = [error, ...prev].slice(0, 10);
				return newErrors;
			});
			setIsDisplaying(true);
		});

		return unsubscribe;
	}, []);

	// Main error handling function
	const handleError = useCallback(
		(
			error: Error | string,
			context: {
				category: ErrorCategory;
				severity: ErrorSeverity;
				context?: string;
				retry?: () => Promise<void> | void;
				metadata?: Record<string, unknown>;
			},
			options?: ErrorHandlerOptions,
		) => {
			return errorHandler.handleError(error, context, options);
		},
		[],
	);

	// Clear specific error
	const clearError = useCallback((errorId: string) => {
		setErrors((prev) => prev.filter((error) => error.id !== errorId));
	}, []);

	// Clear all errors
	const clearAllErrors = useCallback(() => {
		setErrors([]);
		setIsDisplaying(false);
	}, []);

	// Retry error
	const retryError = useCallback(
		async (errorId: string) => {
			const error = errors.find((e) => e.id === errorId);
			if (error?.retry) {
				try {
					await error.retry();
					clearError(errorId);
				} catch (retryError) {
					handleError(retryError as Error, {
						category: error.category,
						severity: error.severity,
						context: `retry_${error.context}`,
					});
				}
			}
		},
		[errors, clearError, handleError],
	);

	// Get errors by category
	const getErrorsByCategory = useCallback(
		(category: ErrorCategory) => {
			return errors.filter((error) => error.category === category);
		},
		[errors],
	);

	// Get errors by severity
	const getErrorsBySeverity = useCallback(
		(severity: ErrorSeverity) => {
			return errors.filter((error) => error.severity === severity);
		},
		[errors],
	);

	// Check if there are any critical errors
	const hasCriticalErrors = useCallback(() => {
		return errors.some((error) => error.severity === "critical");
	}, [errors]);

	// Get the most recent error
	const getLatestError = useCallback(() => {
		return errors.length > 0 ? errors[0] : null;
	}, [errors]);

	// Convenience functions for common error types
	const handleNetworkError = useCallback(
		(error: Error, context?: string, retry?: () => void) => {
			return handleError(error, {
				category: ErrorCategory.NETWORK,
				severity: ErrorSeverity.MEDIUM,
				context,
				retry,
			});
		},
		[handleError],
	);

	const handleAPIError = useCallback(
		(error: Error, context?: string, retry?: () => void) => {
			return handleError(error, {
				category: ErrorCategory.API,
				severity: ErrorSeverity.MEDIUM,
				context,
				retry,
			});
		},
		[handleError],
	);

	const handleLocationError = useCallback(
		(error: Error, context?: string) => {
			return handleError(error, {
				category: ErrorCategory.LOCATION,
				severity: ErrorSeverity.LOW,
				context,
			});
		},
		[handleError],
	);

	const handleRoutingError = useCallback(
		(error: Error, context?: string, retry?: () => void) => {
			return handleError(error, {
				category: ErrorCategory.ROUTING,
				severity: ErrorSeverity.MEDIUM,
				context,
				retry,
			});
		},
		[handleError],
	);

	const handleMapError = useCallback(
		(error: Error, context?: string) => {
			return handleError(error, {
				category: ErrorCategory.MAP,
				severity: ErrorSeverity.HIGH,
				context,
			});
		},
		[handleError],
	);

	const handleAuthError = useCallback(
		(error: Error, context?: string) => {
			return handleError(error, {
				category: ErrorCategory.AUTH,
				severity: ErrorSeverity.HIGH,
				context,
			});
		},
		[handleError],
	);

	const handleValidationError = useCallback(
		(message: string, context?: string) => {
			return handleError(message, {
				category: ErrorCategory.VALIDATION,
				severity: ErrorSeverity.LOW,
				context,
			});
		},
		[handleError],
	);

	return {
		// State
		errors,
		isDisplaying,
		hasCriticalErrors: hasCriticalErrors(),
		latestError: getLatestError(),

		// Actions
		handleError,
		clearError,
		clearAllErrors,
		retryError,

		// Queries
		getErrorsByCategory,
		getErrorsBySeverity,

		// Convenience handlers
		handleNetworkError,
		handleAPIError,
		handleLocationError,
		handleRoutingError,
		handleMapError,
		handleAuthError,
		handleValidationError,
	};
};
