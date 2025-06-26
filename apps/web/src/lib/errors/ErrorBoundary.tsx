/**
 * React Error Boundary with standardized error handling
 */

import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { errorHandler } from "./error-handler";
import type { AppError } from "./types";
import { ErrorCategory, ErrorSeverity } from "./types";

interface Props {
  children: ReactNode;
  fallback?: (error: AppError, resetError: () => void) => ReactNode;
  context?: string;
  onError?: (error: AppError) => void;
}

interface State {
  hasError: boolean;
  error: AppError | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error: errorHandler.handleError(error, {
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.CRITICAL,
        context: "react_error_boundary",
      }),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const appError = errorHandler.handleError(error, {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.CRITICAL,
      context: this.props.context || "react_error_boundary",
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
    });

    this.setState({ error: appError });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(appError);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
interface DefaultErrorFallbackProps {
  error: AppError;
  resetError: () => void;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ error, resetError }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="mt-4 text-center">
          <h3 className="text-lg font-medium text-gray-900">Something went wrong</h3>
          <p className="mt-2 text-sm text-gray-500">
            {error.message || "An unexpected error occurred"}
          </p>

          {error.context && <p className="mt-1 text-xs text-gray-400">Context: {error.context}</p>}
        </div>

        <div className="mt-6 flex space-x-3">
          <button
            type="button"
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            onClick={resetError}
          >
            Try Again
          </button>

          <button
            type="button"
            className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>

        {process.env.NODE_ENV === "development" && error.originalError && (
          <details className="mt-4">
            <summary className="text-xs text-gray-500 cursor-pointer">
              Technical Details (Development)
            </summary>
            <pre className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto max-h-32">
              {error.originalError.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

/**
 * Higher-order component for wrapping components with error boundary
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: (error: AppError, resetError: () => void) => ReactNode;
    context?: string;
    onError?: (error: AppError) => void;
  },
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...options}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};
