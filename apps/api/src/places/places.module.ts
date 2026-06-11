import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { ExternalRoute } from "../entities/external-route.entity";
import { Route } from "../entities/route.entity";
import { PlacesController } from "./places.controller";
import { PlacesService } from "./places.service";
import { RegionalHubsService } from "./regional-hubs.service";

@Module({
	imports: [MikroOrmModule.forFeature([Route, ExternalRoute])],
	controllers: [PlacesController],
	providers: [PlacesService, RegionalHubsService],
	exports: [PlacesService],
})
export class PlacesModule {}
