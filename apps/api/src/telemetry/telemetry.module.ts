import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Global, Module } from "@nestjs/common";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import { DatabaseMetricsSubscriber } from "./database-metrics.subscriber";
import { MetricsController } from "./metrics.controller";
import { MetricsInterceptor } from "./metrics.interceptor";
import { MetricsService } from "./metrics.service";
import { TracingInterceptor } from "./tracing.interceptor";

@Global()
@Module({
	imports: [MikroOrmModule.forFeature([Route, User])],
	controllers: [MetricsController],
	providers: [MetricsService, MetricsInterceptor, TracingInterceptor, DatabaseMetricsSubscriber],
	exports: [MetricsService, MetricsInterceptor, TracingInterceptor, DatabaseMetricsSubscriber],
})
export class TelemetryModule {}
