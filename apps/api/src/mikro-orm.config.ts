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
		// Production runs compiled JS migrations from dist, while local tooling still uses TS sources.
		// pathTs is only included outside production: the production image ships dist only, and mikro-orm
		// calls ensureDir on the TS path at startup, which fails on a read-only container filesystem.
		path: "./dist/migrations",
		...(appConfig.app.isProduction ? {} : { pathTs: "./src/migrations" }),
	},
	debug: appConfig.database.debug,
	allowGlobalContext: appConfig.app.isTest,
	connect: process.env.OPENAPI_GENERATE !== "true",
};

export default config;
