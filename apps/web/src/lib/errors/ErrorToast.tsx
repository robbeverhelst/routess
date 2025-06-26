/**
 * Centralized error toast notification system
 */

import React, { useEffect, useState } from "react";
import { useErrorHandler } from "./useErrorHandler";
import type { AppError } from "./types";

interface ErrorToastProps {
  position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center";
  autoHideDuration?: number;
  maxVisible?: number;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  position = "top-right",
  autoHideDuration = 5000,
  maxVisible = 3,
}) => {
  const { errors, clearError } = useErrorHandler();
  const [visibleErrors, setVisibleErrors] = useState<AppError[]>([]);

  // Manage visible errors (limit and auto-hide)
  useEffect(() => {
    const newVisibleErrors = errors.slice(0, maxVisible);
    setVisibleErrors(newVisibleErrors);

    // Set up auto-hide timers
    newVisibleErrors.forEach((error) => {
      if (error.severity !== "critical") {
        setTimeout(() => {
          clearError(error.id);
        }, autoHideDuration);
      }
    });
  }, [errors, maxVisible, autoHideDuration, clearError]);

  const getPositionClasses = () => {
    const baseClasses = "fixed z-50 pointer-events-none";

    switch (position) {
      case "top-right":
        return `${baseClasses} top-4 right-4`;
      case "top-left":
        return `${baseClasses} top-4 left-4`;
      case "bottom-right":
        return `${baseClasses} bottom-4 right-4`;
      case "bottom-left":
        return `${baseClasses} bottom-8 left-8`;
      case "top-center":
        return `${baseClasses} top-4 left-1/2 transform -translate-x-1/2`;
      case "bottom-center":
        return `${baseClasses} bottom-4 left-1/2 transform -translate-x-1/2`;
      default:
        return `${baseClasses} top-4 right-4`;
    }
  };

  if (visibleErrors.length === 0) return null;

  return (
    <div className={getPositionClasses()}>
      <div className="space-y-2">
        {visibleErrors.map((error, index) => (
          <ErrorToastItem
            key={error.id}
            error={error}
            onClose={() => clearError(error.id)}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

interface ErrorToastItemProps {
  error: AppError;
  onClose: () => void;
  index: number;
}

const ErrorToastItem: React.FC<ErrorToastItemProps> = ({ error, onClose, index }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 150); // Wait for animation
  };

  const getSeverityStyles = () => {
    switch (error.severity) {
      case "low":
        return {
          bg: "bg-blue-50 border-blue-200",
          text: "text-blue-800",
          icon: "text-blue-500",
          iconPath: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        };
      case "medium":
        return {
          bg: "bg-yellow-50 border-yellow-200",
          text: "text-yellow-800",
          icon: "text-yellow-500",
          iconPath: "M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        };
      case "high":
        return {
          bg: "bg-orange-50 border-orange-200",
          text: "text-orange-800",
          icon: "text-orange-500",
          iconPath: "M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        };
      case "critical":
        return {
          bg: "bg-red-50 border-red-200",
          text: "text-red-800",
          icon: "text-red-500",
          iconPath: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
        };
      default:
        return {
          bg: "bg-gray-50 border-gray-200",
          text: "text-gray-800",
          icon: "text-gray-500",
          iconPath: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        };
    }
  };

  const styles = getSeverityStyles();

  return (
    <div
      className={`
        pointer-events-auto min-w-[400px] max-w-md w-full ${styles.bg} shadow-xl rounded-lg border-2
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isLeaving ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"}
      `}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className={`h-6 w-6 ${styles.icon}`}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d={styles.iconPath} />
            </svg>
          </div>

          <div className="ml-3 w-0 flex-1 pt-0.5">
            <div className="flex items-center justify-between">
              <p className={`text-base font-semibold ${styles.text} capitalize`}>
                {error.category} Error
              </p>
              {error.severity === "critical" && (
                <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
                  Critical
                </span>
              )}
            </div>

            <p className={`mt-1 text-base ${styles.text}`}>{error.message}</p>

            {error.context && <p className="mt-1 text-sm text-gray-500">{error.context}</p>}

            {error.retry && (
              <div className="mt-3 flex space-x-2">
                <button
                  type="button"
                  className="text-xs bg-white text-gray-700 px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  onClick={async () => {
                    try {
                      await error.retry!();
                      onClose();
                    } catch {
                      // Error will be handled by the retry mechanism
                    }
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          <div className="ml-4 flex-shrink-0 flex">
            <button
              type="button"
              className={`rounded-md inline-flex ${styles.text} hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500`}
              onClick={handleClose}
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
