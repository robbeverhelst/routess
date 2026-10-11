import { Module } from "@nestjs/common";
import { RouteLibraryService } from "./route-library.service";

@Module({
	providers: [RouteLibraryService],
	exports: [RouteLibraryService],
})
export class RouteLibraryModule {}
