import { Global, Module } from "@nestjs/common";
import { getAppConfig } from "./app-config";

export const APP_CONFIG = Symbol("APP_CONFIG");

@Global()
@Module({
	providers: [
		{
			provide: APP_CONFIG,
			useFactory: getAppConfig,
		},
	],
	exports: [APP_CONFIG],
})
export class ConfigModule {}
