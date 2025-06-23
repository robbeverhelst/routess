import { Global, Module } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { MetricsInterceptor } from "./metrics.interceptor";
import { TracingInterceptor } from "./tracing.interceptor";
import { MetricsController } from "./metrics.controller";
import { DatabaseMetricsSubscriber } from "./database-metrics.subscriber";

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsInterceptor, TracingInterceptor, DatabaseMetricsSubscriber],
  exports: [MetricsService, MetricsInterceptor, TracingInterceptor, DatabaseMetricsSubscriber],
})
export class TelemetryModule {}
