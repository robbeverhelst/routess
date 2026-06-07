import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import { PlacesModule } from "../places/places.module";
import { RoutesController } from "./routes.controller";
import { RoutesService } from "./routes.service";

@Module({
	imports: [MikroOrmModule.forFeature([Route, User]), PlacesModule],
	controllers: [RoutesController],
	providers: [RoutesService],
})
export class RoutesModule {}
