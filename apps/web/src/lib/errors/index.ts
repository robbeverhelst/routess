/**
 * Centralized error handling system exports
 */

export * from "./types";
export * from "./error-handler";
export * from "./useErrorHandler";
export * from "./ErrorBoundary";
export * from "./ErrorToast";

// Re-export convenience functions for easy access
export {
  handleNetworkError,
  handleAPIError,
  handleLocationError,
  handleRoutingError,
  handleMapError,
  handleAuthError,
  handleValidationError,
  errorHandler,
} from "./error-handler";
