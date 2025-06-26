/**
 * Standardized error types and interfaces for the Maps application
 */

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum ErrorCategory {
  NETWORK = "network",
  API = "api",
  LOCATION = "location",
  ROUTING = "routing",
  MAP = "map",
  AUTH = "auth",
  VALIDATION = "validation",
  UNKNOWN = "unknown",
}

export interface AppError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: string;
  timestamp: Date;
  retry?: () => Promise<void> | void;
  originalError?: Error;
  metadata?: Record<string, unknown>;
}

export interface ErrorState {
  errors: AppError[];
  isDisplaying: boolean;
}

export interface ErrorHandlerOptions {
  showToUser?: boolean;
  logError?: boolean;
  reportError?: boolean;
  autoRetry?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}
