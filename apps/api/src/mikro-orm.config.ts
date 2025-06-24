import { Options } from "@mikro-orm/core";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";

// Import entities only in development/test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let entities: string[] | any[];
if (process.env.NODE_ENV === "production") {
  // In production, use entity discovery with JS files
  entities = ["./dist/src/entities/*.entity.js"];
} else {
  // In development/test, import entities directly
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { User } = require("./entities/user.entity");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Route } = require("./entities/route.entity");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Session } = require("./entities/session.entity");
  entities = [User, Route, Session];
}

const config: Options = {
  driver: PostgreSqlDriver,
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  dbName: process.env.DB_NAME || "maps_db",
  entities,
  migrations: {
    path: "./src/migrations",
    pathTs: "./src/migrations",
  },
  debug: process.env.NODE_ENV !== "production",
  allowGlobalContext: true, // Required for tests and simplified operations
};

export default config;
