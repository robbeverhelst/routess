import { Module } from "@nestjs/common";
import { RoutingModule } from "../routing/routing.module";
import { GenerationController } from "./generation.controller";
import { GenerationService } from "./generation.service";
import { NodeNetworksService } from "./node-networks.service";

@Module({
	imports: [RoutingModule],
	controllers: [GenerationController],
	providers: [GenerationService, NodeNetworksService],
})
export class GenerationModule {}
