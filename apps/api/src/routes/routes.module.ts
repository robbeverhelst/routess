import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import { PlacesModule } from "../places/places.module";
import { RoutingModule } from "../routing/routing.module";
import { RoutesController } from "./routes.controller";
import { RoutesService } from "./routes.service";
import { SurfaceCompositionService } from "./surface-composition.service";

@Module({
	imports: [MikroOrmModule.forFeature([Route, User]), PlacesModule, RoutingModule],
	controllers: [RoutesController],
	providers: [RoutesService, SurfaceCompositionService],
})
export class RoutesModule {}
