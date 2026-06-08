import { randomUUID } from "node:crypto";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AdminModule } from "./admin/admin.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { AuthAwareThrottlerGuard } from "./auth/guards/auth-aware-throttler.guard";
import { CacheModule } from "./cache/cache.module";
import { RedisThrottlerStorage } from "./cache/redis-throttler.storage";
import { CollectionsModule } from "./collections/collections.module";
import type { AppConfig } from "./config/app-config";
import { APP_CONFIG, ConfigModule } from "./config/config.module";
import { GenerationModule } from "./generation/generation.module";
import { HealthModule } from "./health/health.module";
import config from "./mikro-orm.config";
import { ProfilesModule } from "./profiles/profiles.module";
import { RoutesModule } from "./routes/routes.module";
import { RoutingModule } from "./routing/routing.module";
import { SocialModule } from "./social/social.module";
import { MetricsInterceptor } from "./telemetry/metrics.interceptor";
import { RequestIdMiddleware, requestIdFromHeaders } from "./telemetry/request-id.middleware";
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
					// Assign the request id before any log binding is created, so every
					// line of a request (including completion) carries one consistent id.
					// RequestIdMiddleware reuses it and echoes it as X-Request-ID.
					genReqId: (req) => requestIdFromHeaders(req.headers) ?? randomUUID(),
					// Every log line carries the app version so Grafana/Loki can answer
					// "which release is affected".
					mixin: () => ({ version: appConfig.app.version }),
					// The req serializer below already strips bodies/headers down to
					// id/method/url; this list is defense-in-depth in case the
					// serializer is ever widened.
					redact: [
						"req.headers.authorization",
						"req.headers.cookie",
						"req.body.password",
						"req.body.currentPassword",
						"req.body.newPassword",
						"req.body.token",
					],
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
			imports: [ConfigModule, CacheModule],
			inject: [APP_CONFIG, RedisThrottlerStorage],
			// Redis-backed storage shares limits across replicas (ADR 0032);
			// without it each pod counted separately and limits were ~2x.
			useFactory: (appConfig: AppConfig, storage: RedisThrottlerStorage) => ({
				storage,
				throttlers: [
					{
						name: "global",
						ttl: 60000,
						limit: appConfig.app.isTest ? 1000 : 300,
					},
				],
			}),
		}),
		CacheModule,
		UsersModule,
		AuthModule,
		RoutesModule,
		CollectionsModule,
		ProfilesModule,
		SocialModule,
		RoutingModule,
		GenerationModule,
		HealthModule,
		TelemetryModule,
		AdminModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		{
			provide: APP_GUARD,
			useClass: AuthAwareThrottlerGuard,
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
