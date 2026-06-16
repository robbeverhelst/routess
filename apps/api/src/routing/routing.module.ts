import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { ExternalRoute } from "../entities/external-route.entity";
import { Route } from "../entities/route.entity";
import { NodeNetworksService } from "../generation/node-networks.service";
import { CuesService } from "./cues.service";
import { RoutingController } from "./routing.controller";
import { RoutingService } from "./routing.service";

@Module({
	imports: [MikroOrmModule.forFeature([Route, ExternalRoute])],
	controllers: [RoutingController],
	// NodeNetworksService is provided here (not in GenerationModule) because
	// both generation anchor-fill and cue decoration read the node tiles, and
	// GenerationModule already imports this module.
	providers: [RoutingService, CuesService, NodeNetworksService],
	exports: [RoutingService, NodeNetworksService],
})
export class RoutingModule {}
