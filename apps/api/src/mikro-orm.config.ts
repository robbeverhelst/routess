import { Options } from "@mikro-orm/core";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { User } from "./entities/user.entity";
import { Route } from "./entities/route.entity";

const config: Options = {
  driver: PostgreSqlDriver,
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  dbName: process.env.DB_NAME || "maps_db",
  entities: [User, Route],
  migrations: {
    path: "./src/migrations",
    pathTs: "./src/migrations",
  },
  debug: process.env.NODE_ENV !== "production",
};

export default config;
