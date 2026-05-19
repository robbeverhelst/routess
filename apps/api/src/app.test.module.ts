import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { AppModule } from "./app.module";
import { RequestIdMiddleware } from "./telemetry/request-id.middleware";
import { TestSupportModule } from "./test-support/test-support.module";

@Module({
	imports: [AppModule, TestSupportModule.forRootIfSafe()],
})
export class AppTestModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(RequestIdMiddleware).forRoutes("*");
	}
}
