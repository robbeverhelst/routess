import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { RoutesModule } from "./routes/routes.module";
import { HealthModule } from "./health/health.module";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { MetricsInterceptor } from "./telemetry/metrics.interceptor";
import { TracingInterceptor } from "./telemetry/tracing.interceptor";
import { RequestIdMiddleware } from "./telemetry/request-id.middleware";
import config from "./mikro-orm.config";

@Module({
  imports: [
    MikroOrmModule.forRoot(config),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || "info",
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  singleLine: true,
                },
              }
            : undefined,
        redact: ["req.headers.authorization", "req.body.password"],
        serializers: {
          req: (req) => ({
            id: req.id || req.headers["x-request-id"],
            method: req.method,
            url: req.url,
            headers: req.headers,
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
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 60000, // 1 minute
        limit: 1000, // Very generous global limit
      },
    ]),
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
