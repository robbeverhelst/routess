import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { RoutesService } from "./routes.service";
import { RoutesController } from "./routes.controller";
import { Route } from "../entities/route.entity";

@Module({
  imports: [MikroOrmModule.forFeature([Route])],
  controllers: [RoutesController],
  providers: [RoutesService],
})
export class RoutesModule {}
