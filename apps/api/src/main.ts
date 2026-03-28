import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { configureApplication } from "./app/app-setup";
import { getAppConfig, loadEnvironment } from "./config/app-config";
import { initializeOpenTelemetry } from "./telemetry/tracing";

async function bootstrap() {
	loadEnvironment();
	const config = getAppConfig();
	initializeOpenTelemetry(config);
	const { AppModule } = await import("./app.module");

	const app = await NestFactory.create(AppModule, { bufferLogs: true });
	app.useLogger(app.get(Logger));
	configureApplication(app, config);

	await app.listen(config.app.port);
}
bootstrap();
