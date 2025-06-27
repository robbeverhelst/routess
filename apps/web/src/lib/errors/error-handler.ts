/**
 * Centralized error handling system
 */

import { Logger } from "@/lib/logger";
import type { AppError, ErrorCategory, ErrorSeverity, ErrorHandlerOptions } from "./types";

class ErrorHandlerService {
  private errorListeners: Array<(error: AppError) => void> = [];
  private errorReportingService?: {
    report: (error: AppError) => void;
  };

  constructor() {
    // Set up global error handlers
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers() {
    // Only set up handlers in browser environment
    if (typeof window === "undefined") {
      return;
    }

    // Catch unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.handleError(new Error(event.reason?.message || "Unhandled promise rejection"), {
        category: "unknown" as ErrorCategory,
        severity: "high" as ErrorSeverity,
        context: "unhandledrejection",
      });
    });

    // Catch global errors
    window.addEventListener("error", (event) => {
      this.handleError(event.error || new Error(event.message), {
        category: "unknown" as ErrorCategory,
        severity: "high" as ErrorSeverity,
        context: "global",
      });
    });
  }

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
    const {
      showToUser = true,
      logError = true,
      reportError = false,
      autoRetry = false,
      retryAttempts = 3,
      retryDelay = 1000,
    } = options;

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

    // Log error if requested
    if (logError) {
      const logLevel = this.getLogLevel(appError.severity);
      Logger[logLevel](`[ErrorHandler] ${appError.category}:`, appError.message, {
        context: appError.context,
        metadata: appError.metadata,
        originalError: appError.originalError,
      });
    }

    // Report error if requested
    if (reportError && this.errorReportingService) {
      this.errorReportingService.report(appError);
    }

    // Notify listeners (UI components)
    if (showToUser) {
      this.notifyListeners(appError);
    }

    // Auto-retry if requested
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

  /**
   * Set error reporting service (for production)
   */
  setErrorReportingService(service: { report: (error: AppError) => void }) {
    this.errorReportingService = service;
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

  private async scheduleRetry(
    error: AppError,
    attempts: number,
    delay: number,
    currentAttempt = 1,
  ) {
    if (currentAttempt > attempts || !error.retry) return;

    setTimeout(async () => {
      try {
        Logger.info(`[ErrorHandler] Retry attempt ${currentAttempt}/${attempts} for:`, error.id);
        await error.retry!();
        Logger.info(`[ErrorHandler] Retry successful for:`, error.id);
      } catch (retryError) {
        Logger.warn(`[ErrorHandler] Retry ${currentAttempt} failed for:`, error.id, retryError);
        if (currentAttempt < attempts) {
          this.scheduleRetry(error, attempts, delay * 2, currentAttempt + 1); // Exponential backoff
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

export const handleAPIError = (error: Error, context?: string, retry?: () => void) =>
  errorHandler.handleError(error, {
    category: "api" as ErrorCategory,
    severity: "medium" as ErrorSeverity,
    context,
    retry,
  });

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
