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
	migrations: {
		path: "./dist/migrations",
		pathTs: "./src/migrations",
	},
	debug: appConfig.database.debug,
	allowGlobalContext: appConfig.app.isTest,
	connect: process.env.OPENAPI_GENERATE !== "true",
};

export default config;
