import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";

import { ExternalRoute } from "../entities/external-route.entity";
import { Route } from "../entities/route.entity";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { NodeNetworksService } from "../generation/node-networks.service";
import { CuesService } from "./cues.service";
import { RoutingEngine } from "./routing-engine";
import { RoutingController } from "./routing.controller";
import { RoutingService } from "./routing.service";
import { ValhallaEngine } from "./valhalla-engine";
import { ValhallaHttp } from "./valhalla-http";

@Module({
	imports: [MikroOrmModule.forFeature([Route, ExternalRoute]), EntitlementsModule],
	controllers: [RoutingController],
	// NodeNetworksService is provided here (not in GenerationModule) because
	// both generation anchor-fill and cue decoration read the node tiles, and
	// GenerationModule already imports this module.
	// ValhallaHttp stays unexported: other modules reach Valhalla only
	// through RoutingEngine.
	providers: [
		ValhallaHttp,
		ValhallaEngine,
		{ provide: RoutingEngine, useExisting: ValhallaEngine },
		RoutingService,
		CuesService,
		NodeNetworksService,
	],
	exports: [RoutingEngine, NodeNetworksService],
})
export class RoutingModule {}
