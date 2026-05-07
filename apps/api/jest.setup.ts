import { setupTestDatabase } from "./test/utils";

// Mock google-auth-library globally
jest.mock("google-auth-library");

// Set test environment
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.DB_NAME = "routess_db_test";

// In CI, the database connection variables are passed from GitHub secrets
// but jest.setup.ts runs early, so we need to ensure they're available
if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
}

// Setup test database before all tests
beforeAll(async () => {
	await setupTestDatabase();
});

// Increase test timeout for integration tests
jest.setTimeout(30000);
