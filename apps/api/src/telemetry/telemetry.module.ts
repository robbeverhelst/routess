import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Global, Module } from "@nestjs/common";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import { MetricsController } from "./metrics.controller";
import { MetricsInterceptor } from "./metrics.interceptor";
import { MetricsListener } from "./metrics.listener";
import { MetricsService } from "./metrics.service";
import { TracingInterceptor } from "./tracing.interceptor";

@Global()
@Module({
	imports: [MikroOrmModule.forFeature([Route, User])],
	controllers: [MetricsController],
	providers: [MetricsService, MetricsListener, MetricsInterceptor, TracingInterceptor],
	exports: [MetricsService, MetricsInterceptor, TracingInterceptor],
})
export class TelemetryModule {}
