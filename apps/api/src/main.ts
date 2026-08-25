import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { configureApplication } from "./app/app-setup";
import { installProcessGuards } from "./app/process-guards";
import { getAppConfig, loadEnvironment } from "./config/app-config";
import { initializeOpenTelemetry } from "./telemetry/tracing";

export async function bootstrap() {
	installProcessGuards();
	loadEnvironment();
	const config = getAppConfig();
	initializeOpenTelemetry(config);
	const { AppModule } = await import("./app.module");

	const app = await NestFactory.create(AppModule, { bufferLogs: true });
	app.useLogger(app.get(Logger));
	configureApplication(app, config);

	await app.listen(config.app.port);
}

if (require.main === module) {
	void bootstrap();
}
