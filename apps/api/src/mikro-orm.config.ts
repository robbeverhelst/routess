import { ReflectMetadataProvider } from "@mikro-orm/decorators/legacy";
import { defineConfig } from "@mikro-orm/postgresql";
import { getAppConfig } from "./config/app-config";
import { Collection } from "./entities/collection.entity";
import { CollectionRoute } from "./entities/collection-route.entity";
import { Follow } from "./entities/follow.entity";
import { PersonalAccessToken } from "./entities/personal-access-token.entity";
import { Route } from "./entities/route.entity";
import { RouteShare } from "./entities/route-share.entity";
import { Session } from "./entities/session.entity";
import { User } from "./entities/user.entity";
import { UserAuthMethod } from "./entities/user-auth-method.entity";
import { VerificationToken } from "./entities/verification-token.entity";
import { MikroOrmMetricsLogger } from "./telemetry/mikro-orm-metrics.logger";

const appConfig = getAppConfig();

const config = defineConfig({
	metadataProvider: ReflectMetadataProvider,
	host: appConfig.database.host,
	port: appConfig.database.port,
	user: appConfig.database.user,
	password: appConfig.database.password,
	dbName: appConfig.database.name,
	entities: [
		User,
		Route,
		Session,
		UserAuthMethod,
		VerificationToken,
		PersonalAccessToken,
		Collection,
		CollectionRoute,
		Follow,
		RouteShare,
	],
	migrations: {
		// Production runs compiled JS migrations from dist, while local tooling still uses TS sources.
		// pathTs is only included outside production: the production image ships dist only, and mikro-orm
		// calls ensureDir on the TS path at startup, which fails on a read-only container filesystem.
		path: "./dist/migrations",
		...(appConfig.app.isProduction ? {} : { pathTs: "./src/migrations" }),
	},
	debug: appConfig.database.debug,
	loggerFactory: (options) => new MikroOrmMetricsLogger(options),
	allowGlobalContext: appConfig.app.isTest,
});

export default config;
