import type { Options } from "@mikro-orm/core";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { getAppConfig } from "./config/app-config";
import { Route } from "./entities/route.entity";
import { Session } from "./entities/session.entity";
import { User } from "./entities/user.entity";

const appConfig = getAppConfig();

const config: Options = {
	driver: PostgreSqlDriver,
	host: appConfig.database.host,
	port: appConfig.database.port,
	user: appConfig.database.user,
	password: appConfig.database.password,
	dbName: appConfig.database.name,
	entities: [User, Route, Session],
	entitiesTs: ["./src/entities/*.entity.ts"],
	preferTs: !appConfig.app.isProduction,
	migrations: {
		path: "./src/migrations",
		pathTs: "./src/migrations",
	},
	debug: appConfig.database.debug,
	allowGlobalContext: appConfig.app.isTest,
};

export default config;
