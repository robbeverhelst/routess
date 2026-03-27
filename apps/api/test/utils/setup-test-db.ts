import { join } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";

// Load environment variables
config({ path: join(__dirname, "../../../.env") });

async function setupTestDatabase() {
	// In CI environment, we use the existing PostgreSQL service in the cluster
	if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
		console.log("CI environment detected - using cluster PostgreSQL service");
		console.log("DB_HOST:", process.env.DB_HOST || "NOT SET");
		console.log("DB_USER:", process.env.DB_USER || "NOT SET");
		console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "SET" : "NOT SET");
		// Still try to create the test database if it doesn't exist
	}

	const client = new Client({
		host: process.env.DB_HOST || "localhost",
		port: parseInt(process.env.DB_PORT || "5432", 10),
		user: process.env.DB_USER || "postgres",
		password: process.env.DB_PASSWORD || "postgres",
		database: "postgres", // Connect to default db to create test db
	});

	try {
		await client.connect();

		// Check if test database exists
		const result = await client.query("SELECT 1 FROM pg_database WHERE datname = 'routess_db_test'");

		if (result.rows.length === 0) {
			// Create test database
			await client.query("CREATE DATABASE routess_db_test");
			console.log("Test database created successfully");
		} else {
			console.log("Test database already exists");
		}
	} catch (error) {
		console.error("Error setting up test database:", error);
		// In development, this is a critical error
		// In CI, we'll handle this differently
		if (process.env.NODE_ENV === "test" && !(process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true")) {
			throw error;
		} else {
			console.log("Continuing without database setup...");
		}
	} finally {
		await client.end().catch(() => {
			// Ignore connection close errors in CI
		});
	}
}

// Run if called directly
if (require.main === module) {
	setupTestDatabase()
		.then(() => process.exit(0))
		.catch(() => process.exit(1));
}

export { setupTestDatabase };
