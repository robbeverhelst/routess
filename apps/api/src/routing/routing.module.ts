import { Module } from "@nestjs/common";
import { RoutingController } from "./routing.controller";
import { RoutingService } from "./routing.service";

@Module({
	controllers: [RoutingController],
	providers: [RoutingService],
})
export class RoutingModule {}
