/**
 * Centralized error handling system exports
 */

export * from "./ErrorBoundary";
export * from "./ErrorToast";
export * from "./error-handler";
// Re-export convenience functions for easy access
export {
	errorHandler,
	handleAPIError,
	handleAuthError,
	handleLocationError,
	handleMapError,
	handleNetworkError,
	handleRoutingError,
	handleValidationError,
} from "./error-handler";
export * from "./types";
export * from "./useErrorHandler";
