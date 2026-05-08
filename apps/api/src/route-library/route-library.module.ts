import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { Route } from "../entities/route.entity";
import { RouteLibraryService } from "./route-library.service";

@Module({
	imports: [MikroOrmModule.forFeature([Route])],
	providers: [RouteLibraryService],
	exports: [RouteLibraryService],
})
export class RouteLibraryModule {}
