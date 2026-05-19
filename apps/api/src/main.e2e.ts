import "reflect-metadata";
import { MikroORM } from "@mikro-orm/core";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { configureApplication } from "./app/app-setup";
import { getAppConfig, loadEnvironment } from "./config/app-config";
import config from "./mikro-orm.config";
import { initializeOpenTelemetry } from "./telemetry/tracing";

const MIGRATION_LOCK_ID = 7_268_873_770_002;

async function runMigrations(): Promise<void> {
	const orm = await MikroORM.init(config);
	const connection = orm.em.getConnection();
	try {
		await connection.execute("select pg_advisory_lock(?)", [MIGRATION_LOCK_ID]);
		await orm.getMigrator().up();
	} finally {
		await connection.execute("select pg_advisory_unlock(?)", [MIGRATION_LOCK_ID]).catch(() => undefined);
		await orm.close(true);
	}
}

export async function bootstrapTest() {
	loadEnvironment();
	const appConfig = getAppConfig();
	initializeOpenTelemetry(appConfig);
	await runMigrations();
	const { AppTestModule } = await import("./app.test.module");

	const app = await NestFactory.create(AppTestModule, { bufferLogs: true });
	app.useLogger(app.get(Logger));
	configureApplication(app, appConfig);

	await app.listen(appConfig.app.port);
}

if (require.main === module) {
	void bootstrapTest();
}
