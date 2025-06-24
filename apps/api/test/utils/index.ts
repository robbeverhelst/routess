// Re-export all test utilities for cleaner imports
export * from "./test-utils";
export * from "./setup-test-db";
export * from "./setup-mocks";

// Export the new reusable auth utility
export { createTestUserWithAuth } from "./test-utils";
