import { Client } from "pg";
import { config } from "dotenv";
import { join } from "path";

// Load environment variables
config({ path: join(__dirname, "../../../.env") });

async function setupTestDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: "postgres", // Connect to default db to create test db
  });

  try {
    await client.connect();

    // Check if test database exists
    const result = await client.query("SELECT 1 FROM pg_database WHERE datname = 'maps_db_test'");

    if (result.rows.length === 0) {
      // Create test database
      await client.query("CREATE DATABASE maps_db_test");
      console.log("Test database created successfully");
    } else {
      console.log("Test database already exists");
    }
  } catch (error) {
    console.error("Error setting up test database:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  setupTestDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { setupTestDatabase };
