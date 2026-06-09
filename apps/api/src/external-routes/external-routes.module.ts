import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { ExternalRoute } from "../entities/external-route.entity";
import { SeedSource } from "../entities/seed-source.entity";
import { ExternalRoutesController } from "./external-routes.controller";
import { ExternalRoutesService } from "./external-routes.service";

@Module({
	imports: [MikroOrmModule.forFeature([ExternalRoute, SeedSource])],
	controllers: [ExternalRoutesController],
	providers: [ExternalRoutesService],
	// Exported so RoutesService can union ExternalRoutes into Discover at read
	// time (the ODbL Produced Work, ADR 0033).
	exports: [ExternalRoutesService],
})
export class ExternalRoutesModule {}
