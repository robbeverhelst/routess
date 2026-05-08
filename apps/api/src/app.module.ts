import { MikroOrmModule } from "@mikro-orm/nestjs";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import type { AppConfig } from "./config/app-config";
import { APP_CONFIG, ConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import config from "./mikro-orm.config";
import { RoutesModule } from "./routes/routes.module";
import { MetricsInterceptor } from "./telemetry/metrics.interceptor";
import { RequestIdMiddleware } from "./telemetry/request-id.middleware";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { TracingInterceptor } from "./telemetry/tracing.interceptor";
import { UsersModule } from "./users/users.module";

@Module({
	imports: [
		ConfigModule,
		EventEmitterModule.forRoot(),
		MikroOrmModule.forRoot(config),
		LoggerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [APP_CONFIG],
			useFactory: (appConfig: AppConfig) => ({
				pinoHttp: {
					level: process.env.LOG_LEVEL || (appConfig.app.isTest ? "silent" : "info"),
					redact: ["req.headers.authorization", "req.body.password"],
					serializers: {
						req: (req) => ({
							id: req.id || req.headers["x-request-id"],
							method: req.method,
							url: req.url,
						}),
						res: (res) => ({
							statusCode: res.statusCode,
						}),
					},
					customProps: (req) => ({
						requestId: req.id || req.headers["x-request-id"],
					}),
				},
			}),
		}),
		ThrottlerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [APP_CONFIG],
			useFactory: (appConfig: AppConfig) => [
				{
					name: "global",
					ttl: 60000,
					limit: appConfig.app.isTest ? 1000 : 300,
				},
			],
		}),
		UsersModule,
		AuthModule,
		RoutesModule,
		HealthModule,
		TelemetryModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: TracingInterceptor,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: MetricsInterceptor,
		},
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(RequestIdMiddleware).forRoutes("*");
	}
}
