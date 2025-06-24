import { Global, Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { MetricsService } from "./metrics.service";
import { MetricsInterceptor } from "./metrics.interceptor";
import { TracingInterceptor } from "./tracing.interceptor";
import { MetricsController } from "./metrics.controller";
import { DatabaseMetricsSubscriber } from "./database-metrics.subscriber";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";

@Global()
@Module({
  imports: [MikroOrmModule.forFeature([Route, User])],
  controllers: [MetricsController],
  providers: [MetricsService, MetricsInterceptor, TracingInterceptor, DatabaseMetricsSubscriber],
  exports: [MetricsService, MetricsInterceptor, TracingInterceptor, DatabaseMetricsSubscriber],
})
export class TelemetryModule {}
